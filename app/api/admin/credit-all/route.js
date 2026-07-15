import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex, withRetry } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, formatSheetFloat } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    // Use mutex to serialize operation and prevent race conditions
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const updatedCount = rows.length;

      // Loop and update each row
      for (const row of rows) {
        const currentInitial = parseSheetFloat(row.get(LeaveBalancesColumns.initial_balance));
        const currentTaken = parseSheetFloat(row.get(LeaveBalancesColumns.taken_days));
        
        const newInitial = currentInitial + 2.5;
        const newRemaining = newInitial - currentTaken;

        row.set(LeaveBalancesColumns.initial_balance, formatSheetFloat(newInitial));
        row.set(LeaveBalancesColumns.remaining_balance, formatSheetFloat(newRemaining));

        // Save with retry
        await withRetry(() => row.save());
        
        // Tiny sleep (150ms) to respect Google API write limits
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      return {
        success: true,
        updated_count: updatedCount
      };
    });

    return NextResponse.json({
      message: `Crédit de +2,5 jours de congés payés (CP) effectué avec succès pour les ${result.updated_count} membres.`,
      updated_count: result.updated_count
    });

  } catch (error) {
    console.error('Error crediting all members:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors du crédit des membres.' },
      { status: 500 }
    );
  }
}
