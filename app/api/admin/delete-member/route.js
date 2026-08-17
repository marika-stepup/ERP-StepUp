import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { deleteEmployeeBalanceFromSheets } from '../../../../lib/sheetsSync';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id } = body;

    // Validation
    if (!employee_id) {
      return NextResponse.json(
        { error: 'Champ obligatoire manquant : employee_id.' },
        { status: 400 }
      );
    }

    // 2. Initialize Supabase Admin client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "Configuration manquante : la clé SUPABASE_SERVICE_ROLE_KEY doit être définie dans le fichier .env.local pour supprimer l'utilisateur de Supabase Auth." },
        { status: 500 }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 3. Fetch employee profile first to get their name for response
    const { data: member, error: fetchErr } = await supabaseAdmin
      .from('leave_balances')
      .select('employee_name, employee_email')
      .eq('employee_id', employee_id)
      .maybeSingle();

    if (fetchErr) {
      throw fetchErr;
    }

    if (!member) {
      return NextResponse.json(
        { error: `Membre avec l'identifiant "${employee_id}" introuvable.` },
        { status: 404 }
      );
    }

    const employeeName = member.employee_name;

    // 4. Delete user from Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_id);
    if (deleteError) {
      console.error('Erreur lors de la suppression dans Supabase Auth:', deleteError);
      // Proceed if user already deleted in Auth, to clean up the DB
      if (deleteError.status !== 404 && !deleteError.message.includes('not found')) {
        return NextResponse.json(
          { error: `Erreur Supabase Auth: ${deleteError.message}` },
          { status: 500 }
        );
      }
    }

    // 5. Delete from leave_balances table (requests will cascade delete)
    const { error: dbDeleteErr } = await supabaseAdmin
      .from('leave_balances')
      .delete()
      .eq('employee_id', employee_id);

    if (dbDeleteErr) {
      throw dbDeleteErr;
    }

    // 6. Sync deletion to Google Sheets (awaited for reliability)
    try {
      await deleteEmployeeBalanceFromSheets(employee_id);
    } catch (syncErr) {
      console.error('[DeleteMember] Sync deletion to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({
      message: `Le membre "${employeeName}" a été supprimé avec succès.`
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression du membre.' },
      { status: 500 }
    );
  }
}
