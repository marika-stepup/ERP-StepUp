import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex, withRetry } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr'
  const auth = await verifyRole(req, ['hr']);
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
        const currentInitial = parseFloat(row.get(LeaveBalancesColumns.initial_balance) || 0);
        const currentTaken = parseFloat(row.get(LeaveBalancesColumns.taken_days) || 0);
        
        const newInitial = currentInitial + 2.5;
        const newRemaining = newInitial - currentTaken;

        row.set(LeaveBalancesColumns.initial_balance, newInitial.toString());
        row.set(LeaveBalancesColumns.remaining_balance, newRemaining.toString());

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
      message: `Successfully credited +2.5 days of paid leave (CP) to all ${result.updated_count} members.`,
      updated_count: result.updated_count
    });

  } catch (error) {
    console.error('Error crediting all members:', error);
    return NextResponse.json(
      { error: 'Internal server error while crediting members.' },
      { status: 500 }
    );
  }
}
