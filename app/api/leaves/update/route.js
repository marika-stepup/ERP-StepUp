import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { calculateBusinessDays } from '../../../../lib/utils';
import { syncLeaveRequest, syncEmployeeBalance } from '../../../../lib/sheetsSync';

export async function POST(req) {
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { request_id, start_date, end_date, leave_type } = body;

    if (!request_id || !start_date || !end_date || !leave_type) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    let businessDays;
    try {
      businessDays = calculateBusinessDays(start_date, end_date);
    } catch (dateErr) {
      return NextResponse.json({ error: dateErr.message }, { status: 400 });
    }

    if (businessDays <= 0) {
      return NextResponse.json({ error: 'La période ne contient aucun jour ouvré.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch request from Supabase
    const { data: targetRequest, error: reqErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('request_id', request_id)
      .maybeSingle();

    if (reqErr) {
      throw reqErr;
    }

    if (!targetRequest) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }

    // Check ownership & admin permission
    const isOwner = targetRequest.employee_id === employee.id;
    const isAdmin = employee.role === 'hr';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à modifier cette demande.' }, { status: 403 });
    }

    // Check status permission
    const requestStatus = targetRequest.status;
    if (requestStatus !== 'En attente' && !isAdmin) {
      return NextResponse.json({ error: 'Seules les demandes en attente peuvent être modifiées.' }, { status: 400 });
    }

    const employeeId = targetRequest.employee_id;

    // 2. Fetch employee balance
    const { data: balance, error: balanceErr } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (balanceErr) {
      throw balanceErr;
    }

    if (!balance) {
      return NextResponse.json({ error: 'Aucun solde de congés trouvé pour cet employé.' }, { status: 404 });
    }

    const oldLeaveType = targetRequest.leave_type || '';
    const oldBusinessDays = Number(targetRequest.business_days || 0);

    let tempCPInitial = Number(balance.initial_balance || 0);
    let tempCPTaken = Number(balance.taken_days || 0);
    let tempCPRemaining = Number(balance.remaining_balance || 0);
    let tempPermInitial = Number(balance.initial_perm || 0);
    let tempPermTaken = Number(balance.taken_perm || 0);
    let tempPermRemaining = Number(balance.remaining_perm || 0);

    // If request was approved, revert old days locally in memory to calculate new balances correctly
    if (requestStatus === 'Approuvé') {
      const oldIsNoDeduct = oldLeaveType.toLowerCase().includes('sans solde') || 
                            oldLeaveType.toLowerCase().includes('rattraper') || 
                            oldLeaveType.toLowerCase().includes('maladie');
      if (!oldIsNoDeduct) {
        const oldIsPermission = oldLeaveType.toLowerCase().includes('perm');
        if (oldIsPermission) {
          tempPermTaken -= oldBusinessDays;
          tempPermRemaining = tempPermInitial - tempPermTaken;
        } else {
          tempCPTaken -= oldBusinessDays;
          tempCPRemaining = tempCPInitial - tempCPTaken;
        }
      }
    }

    // Evaluate balance for the new request
    const isNoDeduct = leave_type.toLowerCase().includes('sans solde') || 
                       leave_type.toLowerCase().includes('rattraper') || 
                       leave_type.toLowerCase().includes('maladie');

    let balanceUpdated = false;

    if (!isNoDeduct) {
      const isPermission = leave_type.toLowerCase().includes('perm');
      const remainingVal = isPermission ? tempPermRemaining : tempCPRemaining;

      if (remainingVal < businessDays) {
        return NextResponse.json(
          { error: `Solde insuffisant. Demandé : ${businessDays} j, Disponible : ${remainingVal} j.` },
          { status: 400 }
        );
      }

      if (requestStatus === 'Approuvé') {
        if (isPermission) {
          tempPermTaken += businessDays;
          tempPermRemaining = tempPermInitial - tempPermTaken;
        } else {
          tempCPTaken += businessDays;
          tempCPRemaining = tempCPInitial - tempCPTaken;
        }
      }
    }

    // Apply database updates for balance if the request was approved or old request was approved
    if (requestStatus === 'Approuvé') {
      const { error: balanceUpdateErr } = await supabase
        .from('leave_balances')
        .update({
          taken_days: tempCPTaken,
          remaining_balance: tempCPRemaining,
          taken_perm: tempPermTaken,
          remaining_perm: tempPermRemaining
        })
        .eq('employee_id', employeeId);

      if (balanceUpdateErr) {
        throw balanceUpdateErr;
      }
      balanceUpdated = true;
    }

    // 3. Check overlap with other requests of the same employee
    const { data: otherRequests, error: otherReqErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .neq('request_id', request_id)
      .neq('status', 'Refusé');

    if (otherReqErr) {
      throw otherReqErr;
    }

    const hasOverlap = (otherRequests || []).some(req => {
      return (start_date <= req.end_date) && (end_date >= req.start_date);
    });

    if (hasOverlap) {
      // Rollback balance update in case of overlap error
      if (balanceUpdated) {
        await supabase
          .from('leave_balances')
          .update({
            taken_days: balance.taken_days,
            remaining_balance: balance.remaining_balance,
            taken_perm: balance.taken_perm,
            remaining_perm: balance.remaining_perm
          })
          .eq('employee_id', employeeId);
      }
      return NextResponse.json(
        { error: 'Vous avez déjà une demande en attente ou approuvée sur cette période.' },
        { status: 400 }
      );
    }

    // 4. Update request row
    const nowStr = new Date().toISOString();
    const { error: updateReqErr } = await supabase
      .from('leave_requests')
      .update({
        start_date,
        end_date,
        business_days: businessDays,
        leave_type,
        updated_at: nowStr
      })
      .eq('request_id', request_id);

    if (updateReqErr) {
      throw updateReqErr;
    }

    // 5. Sync updates to Google Sheets (awaited for reliability)
    try {
      await syncLeaveRequest(request_id);
      if (balanceUpdated) {
        await syncEmployeeBalance(employeeId);
      }
    } catch (syncErr) {
      console.error('[UpdateRoute] Sync to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({ message: 'Demande modifiée avec succès.' });

  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la modification.' },
      { status: 500 }
    );
  }
}
