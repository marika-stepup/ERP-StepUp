import { calculateBusinessDays, isMadagascarHoliday } from '../lib/utils.js';

console.log('--- Friday Holidays Analysis in 2026 ---');

// Find all Fridays in 2026
const fridays = [];
for (let m = 0; m < 12; m++) {
  for (let d = 1; d <= 31; d++) {
    const date = new Date(Date.UTC(2026, m, d));
    if (date.getUTCMonth() !== m) continue;
    if (date.getUTCDay() === 5) { // Friday
      const dateStr = `2026-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (isMadagascarHoliday(dateStr)) {
        fridays.push(dateStr);
      }
    }
  }
}

console.log('Friday holidays in 2026:', fridays);

fridays.forEach(fridayStr => {
  console.log(`\nAnalyzing Friday holiday: ${fridayStr}`);
  
  // Test case 1: Friday holiday only
  const res1 = calculateBusinessDays(fridayStr, fridayStr);
  console.log(`  Leave on ${fridayStr} only: ${res1} days`);

  // Test case 2: Thursday before to Friday holiday
  const thurs = new Date(fridayStr);
  thurs.setUTCDate(thurs.getUTCDate() - 1);
  const thursStr = thurs.toISOString().split('T')[0];
  const res2 = calculateBusinessDays(thursStr, fridayStr);
  console.log(`  Leave from ${thursStr} (Thursday) to ${fridayStr} (Friday): ${res2} days`);

  // Test case 3: Friday holiday to Monday after
  const mon = new Date(fridayStr);
  mon.setUTCDate(mon.getUTCDate() + 3);
  const monStr = mon.toISOString().split('T')[0];
  const res3 = calculateBusinessDays(fridayStr, monStr);
  console.log(`  Leave from ${fridayStr} (Friday) to ${monStr} (Monday): ${res3} days`);

  // Test case 4: Thursday before to Monday after
  const res4 = calculateBusinessDays(thursStr, monStr);
  console.log(`  Leave from ${thursStr} (Thursday) to ${monStr} (Monday): ${res4} days`);
});
