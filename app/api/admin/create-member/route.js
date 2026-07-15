import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseClient } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, formatSheetFloat } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { email, name, role, manager_name, initial_balance, initial_perm, password, service } = body;

    // Validation
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : email, name, password.' },
        { status: 400 }
      );
    }

    if (password.trim().length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      );
    }

    // Register user in Supabase Auth first
    const supabase = getSupabaseClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: role || 'employee'
        }
      }
    });

    if (signUpError) {
      console.error('Supabase signup error:', signUpError);
      return NextResponse.json(
        { error: `Erreur d'enregistrement dans Supabase : ${signUpError.message}` },
        { status: 400 }
      );
    }

    const employeeId = signUpData.user?.id;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Impossible d'obtenir l'ID de l'utilisateur créé dans Supabase." },
        { status: 500 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);

    // Use mutex to prevent duplicates during creation
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      // Check if email already exists
      const exists = rows.some(
        (row) => row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === email.toLowerCase()
      );

      if (exists) {
        return {
          error: `Un membre avec l'e-mail "${email}" existe déjà dans le système.`,
          status: 400
        };
      }

      await balancesSheet.addRow({
        [LeaveBalancesColumns.employee_id]: employeeId,
        [LeaveBalancesColumns.employee_name]: name,
        [LeaveBalancesColumns.employee_email]: email.toLowerCase(),
        [LeaveBalancesColumns.role]: role || 'employee',
        [LeaveBalancesColumns.initial_balance]: formatSheetFloat(initialCP),
        [LeaveBalancesColumns.taken_days]: formatSheetFloat(0),
        [LeaveBalancesColumns.remaining_balance]: formatSheetFloat(initialCP),
        [LeaveBalancesColumns.initial_perm]: formatSheetFloat(initialPermissions),
        [LeaveBalancesColumns.taken_perm]: formatSheetFloat(0),
        [LeaveBalancesColumns.remaining_perm]: formatSheetFloat(initialPermissions),
        [LeaveBalancesColumns.manager_name]: manager_name || 'Aucun',
        [LeaveBalancesColumns.service]: service || 'Non spécifié'
      });

      return {
        success: true,
        data: {
          employee_id: employeeId,
          employee_name: name,
          employee_email: email,
          role: role || 'employee',
          manager_name: manager_name || 'Aucun',
          initial_balance: initialCP,
          initial_perm: initialPermissions,
          service: service || 'Non spécifié'
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Nouveau membre créé avec succès.',
      member: result.data
    });

  } catch (error) {
    console.error('Error creating new member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la création du nouveau membre.' },
      { status: 500 }
    );
  }
}
