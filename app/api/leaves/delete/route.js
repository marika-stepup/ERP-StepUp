import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncEmployeeBalance, deleteLeaveRequestFromSheets } from '../../../../lib/sheetsSync';

export async function POST(req) {
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'Identifiant de demande manquant.' }, { status: 400 });
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
      return NextResponse.json({ error: 'Non autorisé à supprimer cette demande.' }, { status: 403 });
    }

    // Check status permission
    const requestStatus = targetRequest.status;
    if (requestStatus !== 'En attente' && !isAdmin) {
      return NextResponse.json({ error: 'Seules les demandes en attente peuvent être supprimées.' }, { status: 400 });
    }

    const employeeId = targetRequest.employee_id;
    const businessDays = Number(targetRequest.business_days || 0);
    let balanceUpdated = false;

    // 2. If approved, restore employee balance
    if (requestStatus === 'Approuvé') {
      const leaveType = targetRequest.leave_type || '';
      const isNoDeduct = leaveType.toLowerCase().includes('sans solde') || 
                         leaveType.toLowerCase().includes('rattraper') || 
                         leaveType.toLowerCase().includes('maladie');

      if (!isNoDeduct) {
        // Fetch balance
        const { data: balance, error: balanceErr } = await supabase
          .from('leave_balances')
          .select('*')
          .eq('employee_id', employeeId)
          .maybeSingle();

        if (balanceErr) {
          throw balanceErr;
        }

        if (!balance) {
          return NextResponse.json({ error: `Aucun solde de congés trouvé pour l'employé lors de la suppression.` }, { status: 404 });
        }

        const isPermission = leaveType.toLowerCase().includes('perm');
        
        if (isPermission) {
          const newTaken = Number(balance.taken_perm || 0) - businessDays;
          const newRemaining = Number(balance.initial_perm || 0) - newTaken;

          const { error: updateErr } = await supabase
            .from('leave_balances')
            .update({ taken_perm: newTaken, remaining_perm: newRemaining })
            .eq('employee_id', employeeId);

          if (updateErr) {
            throw updateErr;
          }
        } else {
          const newTaken = Number(balance.taken_days || 0) - businessDays;
          const newRemaining = Number(balance.initial_balance || 0) - newTaken;

          const { error: updateErr } = await supabase
            .from('leave_balances')
            .update({ taken_days: newTaken, remaining_balance: newRemaining })
            .eq('employee_id', employeeId);

          if (updateErr) {
            throw updateErr;
          }
        }
        balanceUpdated = true;
      }
    }

    // 3. Delete the request from Supabase
    const { error: deleteErr } = await supabase
      .from('leave_requests')
      .delete()
      .eq('request_id', request_id);

    if (deleteErr) {
      throw deleteErr;
    }

    // 4. Sync updates to Google Sheets (awaited for reliability)
    try {
      await deleteLeaveRequestFromSheets(request_id);
      if (balanceUpdated) {
        await syncEmployeeBalance(employeeId);
      }
    } catch (syncErr) {
      console.error('[DeleteRoute] Sync to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({ message: 'Demande supprimée avec succès.' });

  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression.' },
      { status: 500 }
    );
  }
}
