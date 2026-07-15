import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs } from '../../../../lib/sheetsColumns';
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

    // Deletion in Supabase first (using Service Role Client)
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

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(employee_id);
    if (deleteError) {
      console.error('Erreur lors de la suppression dans Supabase Auth:', deleteError);
      // If user is not found, we can proceed with sheet deletion to keep the system clean.
      // Otherwise, return error.
      if (deleteError.status !== 404 && !deleteError.message.includes('not found')) {
        return NextResponse.json(
          { error: `Erreur Supabase Auth: ${deleteError.message}` },
          { status: 500 }
        );
      }
    }

    // Use mutex to prevent race conditions during deletion
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee_id
      );

      if (!balanceRow) {
        return {
          error: `Membre avec l'identifiant "${employee_id}" introuvable.`,
          status: 404
        };
      }

      const employeeName = balanceRow.get(LeaveBalancesColumns.employee_name);
      
      // Delete the row from the Google Sheet
      await balanceRow.delete();

      return {
        success: true,
        employee_name: employeeName
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: `Le membre "${result.employee_name}" a été supprimé avec succès.`
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression du membre.' },
      { status: 500 }
    );
  }
}
