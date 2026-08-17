import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncLeaveRequest, syncEmployeeBalance } from '../../../../lib/sheetsSync';

export async function POST(req) {
  // 1. Authenticate and verify role 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { request_id, action, hr_comment } = body;

    // Validate inputs
    if (!request_id || !action) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : request_id, action.' },
        { status: 400 }
      );
    }

    const normalizedAction = action.trim().toLowerCase();
    const isApprove = ['approuver', 'approve'].includes(normalizedAction);
    const isReject = ['refuser', 'reject'].includes(normalizedAction);

    if (!isApprove && !isReject) {
      return NextResponse.json(
        { error: "Action invalide. Utilisez 'Approuver' ou 'Refuser'." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch the target request
    const { data: targetRequest, error: reqError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('request_id', request_id)
      .maybeSingle();

    if (reqError) {
      throw reqError;
    }

    if (!targetRequest) {
      return NextResponse.json(
        { error: `Demande de congés avec l'identifiant "${request_id}" introuvable.` },
        { status: 404 }
      );
    }

    if (targetRequest.status !== 'En attente') {
      return NextResponse.json(
        { error: `Cette demande a déjà été traitée. Statut actuel : ${targetRequest.status}.` },
        { status: 400 }
      );
    }

    const employeeId = targetRequest.employee_id;
    const businessDays = Number(targetRequest.business_days || 0);
    const leaveType = targetRequest.leave_type || '';
    const nowStr = new Date().toISOString();

    // 3. Fetch employee profile and manager details
    const { data: requesterProfile, error: reqProfileErr } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (reqProfileErr) {
      throw reqProfileErr;
    }

    if (!requesterProfile) {
      return NextResponse.json(
        { error: `Aucun solde de congés trouvé pour l'identifiant employé : ${employeeId}.` },
        { status: 404 }
      );
    }

    // 4. Check manager hierarchy constraint
    const managerName = (requesterProfile.manager_name || '').trim();
    
    // Fetch logged-in user details to match name
    const { data: currentUserProfile, error: currentProfileErr } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', auth.user.id)
      .maybeSingle();

    if (currentProfileErr) {
      throw currentProfileErr;
    }

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: `Utilisateur actuel non trouvé dans la liste des membres.` },
        { status: 403 }
      );
    }

    const currentFirstName = (currentUserProfile.employee_first_name || '').trim();
    const currentLastName = (currentUserProfile.employee_name || '').trim();
    const currentFullName1 = `${currentFirstName} ${currentLastName}`;
    const currentFullName2 = `${currentLastName} ${currentFirstName}`;

    const matchesManager = 
      managerName.toLowerCase() === currentFirstName.toLowerCase() ||
      managerName.toLowerCase() === currentLastName.toLowerCase() ||
      managerName.toLowerCase() === currentFullName1.toLowerCase() ||
      managerName.toLowerCase() === currentFullName2.toLowerCase();

    if (!managerName || managerName === 'Aucun' || !matchesManager) {
      return NextResponse.json(
        { error: `Accès refusé. Seul le N+1 (Manager) de l'employé (${managerName}) est autorisé à approuver ou refuser cette demande.` },
        { status: 403 }
      );
    }

    // 5. Process validation action
    if (isApprove) {
      const isPermission = leaveType.toLowerCase().includes('perm');
      const isNoDeduct = leaveType.toLowerCase().includes('sans solde') || 
                         leaveType.toLowerCase().includes('rattraper') || 
                         leaveType.toLowerCase().includes('maladie');

      if (!isNoDeduct) {
        const initialVal = isPermission ? Number(requesterProfile.initial_perm || 0) : Number(requesterProfile.initial_balance || 0);
        const takenVal = isPermission ? Number(requesterProfile.taken_perm || 0) : Number(requesterProfile.taken_days || 0);
        const remainingVal = isPermission ? Number(requesterProfile.remaining_perm || 0) : Number(requesterProfile.remaining_balance || 0);

        if (remainingVal < businessDays) {
          return NextResponse.json(
            { error: `Impossible d'approuver la demande. L'employé dispose de seulement ${remainingVal} jours restants, demandés ${businessDays} jours.` },
            { status: 400 }
          );
        }

        const newTaken = takenVal + businessDays;
        const newRemaining = initialVal - newTaken;

        // Update balance in Supabase
        const balanceUpdatePayload = isPermission 
          ? { taken_perm: newTaken, remaining_perm: newRemaining }
          : { taken_days: newTaken, remaining_balance: newRemaining };

        const { error: balanceUpdateErr } = await supabase
          .from('leave_balances')
          .update(balanceUpdatePayload)
          .eq('employee_id', employeeId);

        if (balanceUpdateErr) {
          throw balanceUpdateErr;
        }
      }

      // Update request status in Supabase
      const { error: reqUpdateErr } = await supabase
        .from('leave_requests')
        .update({
          status: 'Approuvé',
          hr_comment: hr_comment || 'Approuvé',
          updated_at: nowStr
        })
        .eq('request_id', request_id);

      if (reqUpdateErr) {
        throw reqUpdateErr;
      }

      // Sync to Google Sheets (awaited for reliability)
      try {
        await syncLeaveRequest(request_id);
        if (!isNoDeduct) {
          await syncEmployeeBalance(employeeId);
        }
      } catch (syncErr) {
        console.error('[ValidateRoute] Syncing to Google Sheets failed:', syncErr);
      }

      return NextResponse.json({
        message: 'La demande de congés a été approuvée avec succès.',
        data: {
          request_id,
          employee_id: employeeId,
          business_days: businessDays,
          status: 'Approuvé'
        }
      });

    } else {
      // Reject request
      const { error: reqUpdateErr } = await supabase
        .from('leave_requests')
        .update({
          status: 'Refusé',
          hr_comment: hr_comment || 'Refusé',
          updated_at: nowStr
        })
        .eq('request_id', request_id);

      if (reqUpdateErr) {
        throw reqUpdateErr;
      }

      // Sync to Google Sheets
      try {
        await syncLeaveRequest(request_id);
      } catch (syncErr) {
        console.error('[ValidateRoute] Syncing to Google Sheets failed:', syncErr);
      }

      return NextResponse.json({
        message: 'La demande de congés a été refusée avec succès.',
        data: {
          request_id,
          employee_id: employeeId,
          business_days: businessDays,
          status: 'Refusé'
        }
      });
    }

  } catch (error) {
    console.error('Error validating leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la validation de la demande de congés.' },
      { status: 500 }
    );
  }
}
