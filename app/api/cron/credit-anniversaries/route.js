import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncEmployeeBalance } from '../../../../lib/sheetsSync';

export async function GET(req) {
  // 1. Security Check for CRON Secret (to prevent unauthorized triggers)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron] Unauthorized anniversary credit attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    console.log('[Cron] Checking contract anniversaries...');

    // 2. Fetch all leave balances from Supabase
    const { data: members, error: dbErr } = await supabase
      .from('leave_balances')
      .select('*');

    if (dbErr) {
      throw dbErr;
    }

    let creditedCount = 0;
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    for (const member of (members || [])) {
      const hireDateStr = member.hire_date;
      if (!hireDateStr) continue;

      const hireDateUTC = new Date(hireDateStr);
      if (isNaN(hireDateUTC.getTime())) continue;

      if (todayUTC < hireDateUTC) continue;

      // Calculate anniversaries up to todayUTC
      const anniversaries = [];
      const hireYear = hireDateUTC.getUTCFullYear();
      const currentYear = todayUTC.getUTCFullYear();

      for (let y = hireYear + 1; y <= currentYear; y++) {
        const annDate = new Date(Date.UTC(y, hireDateUTC.getUTCMonth(), hireDateUTC.getUTCDate()));
        if (annDate <= todayUTC) {
          anniversaries.push(annDate);
        }
      }

      const lastCreditedStr = member.last_anniversary_credited;
      let lastCreditedUTC = lastCreditedStr ? new Date(lastCreditedStr) : null;

      let toCredit = [];
      let updatedAny = false;
      let newLastAnniversary = member.last_anniversary_credited;

      if (!lastCreditedUTC) {
        // Initial setup for existing users
        const latestAnniversary = anniversaries.length > 0 ? anniversaries[anniversaries.length - 1] : null;
        if (latestAnniversary) {
          const isToday = latestAnniversary.getTime() === todayUTC.getTime();
          if (isToday) {
            toCredit.push(latestAnniversary);
          } else {
            newLastAnniversary = latestAnniversary.toISOString().split('T')[0];
            updatedAny = true;
          }
        } else {
          newLastAnniversary = hireDateStr;
          updatedAny = true;
        }
      } else {
        toCredit = anniversaries.filter(ann => ann > lastCreditedUTC);
      }

      let newInitial = Number(member.initial_balance || 0);
      let newRemaining = Number(member.remaining_balance || 0);

      if (toCredit.length > 0) {
        const creditAmount = toCredit.length * 30; // 30 days of CP per anniversary
        newInitial += creditAmount;
        newRemaining += creditAmount;
        newLastAnniversary = toCredit[toCredit.length - 1].toISOString().split('T')[0];
        updatedAny = true;
      }

      if (updatedAny) {
        const { error: updateErr } = await supabase
          .from('leave_balances')
          .update({
            initial_balance: newInitial,
            remaining_balance: newRemaining,
            last_anniversary_credited: newLastAnniversary
          })
          .eq('employee_id', member.employee_id);

        if (updateErr) {
          console.error(`[Cron] Failed to update balance for ${member.employee_email}:`, updateErr.message);
          continue;
        }

        // Sync to Google Sheets
        try {
          await syncEmployeeBalance(member.employee_id);
        } catch (syncErr) {
          console.error(`[Cron] Sheets sync failed for ${member.employee_email}:`, syncErr);
        }

        console.log(`[Cron] Credited contract anniversaries for ${member.employee_email}. New balance: ${newRemaining}`);
        creditedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked contract anniversaries. Credited ${creditedCount} users.`
    });

  } catch (error) {
    console.error('[Cron] Error crediting contract anniversaries:', error);
    return NextResponse.json(
      { error: 'Internal server error during contract anniversary check.' },
      { status: 500 }
    );
  }
}
