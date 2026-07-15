import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, formatSheetFloat } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id, type, value } = body;

    // Validation
    if (!employee_id || !type || value === undefined) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, type, value.' },
        { status: 400 }
      );
    }

    const normalizedType = type.toLowerCase();
    if (normalizedType !== 'cp' && normalizedType !== 'perm') {
      return NextResponse.json(
        { error: "Type invalide. Utilisez 'cp' ou 'perm'." },
        { status: 400 }
      );
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return NextResponse.json(
        { error: 'La valeur doit être un nombre positif valide.' },
        { status: 400 }
      );
    }

    // Use mutex to serialize changes and prevent race conditions
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee_id || 
                 row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employee_id.toLowerCase()
      );

      if (!balanceRow) {
        return {
          error: `Membre avec l'identifiant ou l'e-mail "${employee_id}" introuvable.`,
          status: 404
        };
      }

      if (normalizedType === 'cp') {
        const currentTaken = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_days));
        const newRemaining = numericValue - currentTaken;

        balanceRow.set(LeaveBalancesColumns.initial_balance, formatSheetFloat(numericValue));
        balanceRow.set(LeaveBalancesColumns.remaining_balance, formatSheetFloat(newRemaining));
        await balanceRow.save();

        return {
          success: true,
          data: {
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
            type: 'cp',
            initial_balance: numericValue,
            remaining_balance: newRemaining
          }
        };
      } else {
        const currentTaken = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_perm));
        const newRemaining = numericValue - currentTaken;

        balanceRow.set(LeaveBalancesColumns.initial_perm, formatSheetFloat(numericValue));
        balanceRow.set(LeaveBalancesColumns.remaining_perm, formatSheetFloat(newRemaining));
        await balanceRow.save();

        return {
          success: true,
          data: {
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
            type: 'perm',
            initial_perm: numericValue,
            remaining_perm: newRemaining
          }
        };
      }
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Solde du membre ajusté avec succès.',
      balance: result.data
    });

  } catch (error) {
    console.error('Error adjusting balance:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de l\'ajustement du solde.' },
      { status: 500 }
    );
  }
}
