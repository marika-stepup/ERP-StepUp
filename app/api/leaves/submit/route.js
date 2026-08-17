import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { calculateBusinessDays, generateUUID } from '../../../../lib/utils';
import { syncLeaveRequest } from '../../../../lib/sheetsSync';

export async function POST(req) {
  // 1. Authenticate and verify role 'employee' (includes HR)
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { start_date, end_date, leave_type } = body;

    // Validation
    if (!start_date || !end_date || !leave_type) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : start_date, end_date, leave_type.' },
        { status: 400 }
      );
    }

    // 2. Calculate working days
    let businessDays;
    try {
      businessDays = calculateBusinessDays(start_date, end_date);
    } catch (dateErr) {
      return NextResponse.json({ error: dateErr.message }, { status: 400 });
    }

    if (businessDays <= 0) {
      return NextResponse.json(
        { error: 'La période demandée ne contient aucun jour ouvré.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 3. Fetch employee balance from Supabase
    const { data: balance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle();

    if (balanceError) {
      throw balanceError;
    }

    if (!balance) {
      return NextResponse.json(
        { error: `Aucun solde de congés trouvé pour l'employé : ${employee.email}. Veuillez contacter les RH.` },
        { status: 404 }
      );
    }

    // Check balance depending on leave type (Permission vs normal CP/RTT)
    const isPermission = leave_type.toLowerCase().includes('perm');
    const isNoDeduct = leave_type.toLowerCase().includes('sans solde') || 
                       leave_type.toLowerCase().includes('rattraper') || 
                       leave_type.toLowerCase().includes('maladie');
    
    if (!isNoDeduct) {
      const remainingBalance = isPermission 
        ? Number(balance.remaining_perm || 0)
        : Number(balance.remaining_balance || 0);

      if (remainingBalance < businessDays) {
        return NextResponse.json(
          { error: `Solde insuffisant. Demandé : ${businessDays} j, Disponible : ${remainingBalance} j.` },
          { status: 400 }
        );
      }
    }

    // 4. Check for duplicate / overlapping requests
    const { data: employeeRequests, error: requestsError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employee.id)
      .neq('status', 'Refusé');

    if (requestsError) {
      throw requestsError;
    }

    const hasOverlap = (employeeRequests || []).some(req => {
      // Both start_date and end_date in DB are ISO YYYY-MM-DD strings
      return (start_date <= req.end_date) && (end_date >= req.start_date);
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Vous avez déjà une demande en attente ou approuvée sur cette période.' },
        { status: 400 }
      );
    }

    // 5. Create new request row in Supabase
    const requestId = generateUUID();
    const nowStr = new Date().toISOString();
    const fullName = `${balance.employee_first_name} ${balance.employee_name}`.trim() || employee.name;

    const { error: insertError } = await supabase
      .from('leave_requests')
      .insert({
        request_id: requestId,
        employee_id: employee.id,
        employee_name: fullName,
        start_date,
        end_date,
        business_days: businessDays,
        leave_type,
        status: 'En attente',
        hr_comment: '',
        created_at: nowStr,
        updated_at: nowStr
      });

    if (insertError) {
      throw insertError;
    }

    // 6. Sync changes to Google Sheets in the background (awaited for reliability)
    try {
      await syncLeaveRequest(requestId);
    } catch (syncErr) {
      console.error('[SubmitRoute] Sync to Google Sheets failed:', syncErr);
      // We don't crash the request if Sheets sync fails, to keep the app working.
    }

    return NextResponse.json({
      message: 'Demande de congés soumise avec succès.',
      request: {
        request_id: requestId,
        employee_id: employee.id,
        employee_name: fullName,
        start_date,
        end_date,
        business_days: businessDays,
        leave_type,
        status: 'En attente',
        created_at: nowStr
      }
    });

  } catch (error) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la soumission de la demande de congés.' },
      { status: 500 }
    );
  }
}
