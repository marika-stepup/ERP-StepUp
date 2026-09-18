import { getSupabaseAdmin } from './supabaseAuth.js';
import { syncEmployeeBalance } from './sheetsSync.js';

/**
 * Checks and automatically credits contract anniversary leave days (+30 days of CP per year)
 * for a specific employee or all employees in the database.
 * 
 * @param {string|null} targetEmployeeId - Optional employee ID to check only one user. If null, checks all users.
 * @returns {Promise<{ creditedCount: number, creditedUsers: Array<{ email: string, name: string, addedDays: number, newBalance: number }> }>}
 */
export async function checkAndCreditAnniversaries(targetEmployeeId = null) {
  try {
    const supabase = getSupabaseAdmin();
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    let query = supabase.from('leave_balances').select('*');
    if (targetEmployeeId) {
      query = query.eq('employee_id', targetEmployeeId);
    }

    const { data: members, error: dbErr } = await query;
    if (dbErr) {
      console.error('[AnniversaryService] Database error fetching balances:', dbErr);
      return { creditedCount: 0, creditedUsers: [] };
    }

    if (!members || members.length === 0) {
      return { creditedCount: 0, creditedUsers: [] };
    }

    let creditedCount = 0;
    const creditedUsers = [];

    for (const member of members) {
      const hireDateStr = member.hire_date;
      if (!hireDateStr) continue;

      const hireDateUTC = new Date(hireDateStr);
      if (isNaN(hireDateUTC.getTime())) continue;

      // Cannot have anniversary if hire date is in the future
      if (todayUTC < hireDateUTC) continue;

      const hireYear = hireDateUTC.getUTCFullYear();
      const currentYear = todayUTC.getUTCFullYear();

      // All anniversary dates from hireYear + 1 up to todayUTC
      const anniversaries = [];
      for (let y = hireYear + 1; y <= currentYear; y++) {
        const annDate = new Date(Date.UTC(y, hireDateUTC.getUTCMonth(), hireDateUTC.getUTCDate()));
        if (annDate <= todayUTC) {
          anniversaries.push(annDate);
        }
      }

      const lastCreditedStr = member.last_anniversary_credited;
      const lastCreditedUTC = lastCreditedStr ? new Date(lastCreditedStr) : null;

      let toCredit = [];
      let updatedAny = false;
      let newLastAnniversary = member.last_anniversary_credited;

      if (!lastCreditedUTC) {
        // Initial setup for users without last_anniversary_credited
        const latestAnniversary = anniversaries.length > 0 ? anniversaries[anniversaries.length - 1] : null;
        if (latestAnniversary) {
          // Check if anniversary is today or occurred recently
          const isToday = latestAnniversary.getTime() === todayUTC.getTime();
          if (isToday) {
            toCredit.push(latestAnniversary);
          } else {
            // Baseline date set to the latest past anniversary
            newLastAnniversary = latestAnniversary.toISOString().split('T')[0];
            updatedAny = true;
          }
        } else {
          // No past anniversaries yet (tenure < 1 year)
          newLastAnniversary = hireDateStr;
          updatedAny = true;
        }
      } else {
        // Filter anniversaries strictly after the last credited anniversary date
        toCredit = anniversaries.filter(ann => ann > lastCreditedUTC);
      }

      let newInitial = Number(member.initial_balance || 0);
      let newRemaining = Number(member.remaining_balance || 0);

      if (toCredit.length > 0) {
        const creditAmount = toCredit.length * 30; // +30 days CP per anniversary
        newInitial += creditAmount;
        newRemaining += creditAmount;
        newLastAnniversary = toCredit[toCredit.length - 1].toISOString().split('T')[0];
        updatedAny = true;

        creditedUsers.push({
          employee_id: member.employee_id,
          email: member.employee_email,
          name: `${member.employee_first_name || ''} ${member.employee_name || ''}`.trim(),
          addedDays: creditAmount,
          newBalance: newRemaining
        });
        creditedCount++;
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
          console.error(`[AnniversaryService] Failed to update balance for ${member.employee_email}:`, updateErr.message);
          continue;
        }

        // Sync to Google Sheets
        try {
          await syncEmployeeBalance(member.employee_id);
        } catch (syncErr) {
          console.error(`[AnniversaryService] Sheets sync failed for ${member.employee_email}:`, syncErr);
        }

        if (toCredit.length > 0) {
          console.log(`[AnniversaryService] Credited ${toCredit.length * 30}j to ${member.employee_email} (New balance: ${newRemaining}, Last anniversary: ${newLastAnniversary})`);
        }
      }
    }

    return { creditedCount, creditedUsers };
  } catch (error) {
    console.error('[AnniversaryService] Error during contract anniversary check:', error);
    return { creditedCount: 0, creditedUsers: [] };
  }
}
