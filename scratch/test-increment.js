import { parseSheetFloat } from '../lib/sheetsColumns.js';

// Mock getProjectedBalance using the new logic we implemented in app/page.js
const getProjectedBalanceMock = (m, today, targetDate) => {
  const defaultRes = {
    cp: m.remaining_balance,
    perm: m.remaining_perm,
    cpBreakdown: '',
    permBreakdown: ''
  };

  if (!m.hire_date) return defaultRes;

  const parts = m.hire_date.split('-');
  if (parts.length !== 3) return defaultRes;
  const hireYear = parseInt(parts[0], 10);
  const hireMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
  const hireDay = parseInt(parts[2], 10);

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const targetEnd = new Date(year, month + 1, 0); // last day of target month

  let cpMonthly = 0;
  let cpAnniversary = 0;

  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const targetEndUTC = new Date(Date.UTC(targetEnd.getFullYear(), targetEnd.getMonth(), targetEnd.getDate()));

  // 1. Monthly Accrual: +2.5j per month (difference in months index)
  const todayMonthIndex = todayUTC.getUTCFullYear() * 12 + todayUTC.getUTCMonth();
  const targetMonthIndex = targetEndUTC.getUTCFullYear() * 12 + targetEndUTC.getUTCMonth();
  const monthsDiff = targetMonthIndex - todayMonthIndex;
  cpMonthly = monthsDiff * 2.5;

  // 2. Anniversary Accrual: +30j per contract anniversary
  if (targetEndUTC > todayUTC) {
    for (let y = todayUTC.getUTCFullYear(); y <= targetEndUTC.getUTCFullYear(); y++) {
      const ann = new Date(Date.UTC(y, hireMonth, hireDay));
      if (ann > todayUTC && ann <= targetEndUTC) {
        cpAnniversary += 30;
      }
    }
  } else if (targetEndUTC < todayUTC) {
    for (let y = targetEndUTC.getUTCFullYear(); y <= todayUTC.getUTCFullYear(); y++) {
      const ann = new Date(Date.UTC(y, hireMonth, hireDay));
      if (ann > targetEndUTC && ann <= todayUTC) {
        cpAnniversary -= 30;
      }
    }
  }

  const projectedCP = m.remaining_balance + cpMonthly + cpAnniversary;

  // Build human readable breakdown texts
  let cpMonthlyForBreakdown = 0;
  if (monthsDiff > 0) {
    cpMonthlyForBreakdown = 2.5;
  } else if (monthsDiff < 0) {
    cpMonthlyForBreakdown = -2.5;
  }

  let cpAnniversaryForBreakdown = 0;
  if (targetDate.getMonth() === hireMonth && targetDate.getFullYear() > hireYear) {
    if (monthsDiff > 0) {
      cpAnniversaryForBreakdown = 30;
    } else if (monthsDiff < 0) {
      cpAnniversaryForBreakdown = -30;
    }
  }

  const cpParts = [];
  if (cpMonthlyForBreakdown !== 0) cpParts.push(`${cpMonthlyForBreakdown > 0 ? '+' : ''}${cpMonthlyForBreakdown}j acquis`);
  if (cpAnniversaryForBreakdown !== 0) cpParts.push(`${cpAnniversaryForBreakdown > 0 ? '+' : ''}${cpAnniversaryForBreakdown}j anniv.`);

  return {
    cp: parseFloat(Math.max(0, projectedCP).toFixed(1)),
    cpBreakdown: cpParts.join(', ')
  };
};

// Test Suite
console.log('--- Testing Balance Projection Logic ---');

const m = {
  remaining_balance: 24, // Dany's actual remaining balance in the database (since July is credited)
  remaining_perm: 5,
  hire_date: '2019-11-25' // Dany's hire date
};

const today = new Date('2026-07-30'); // July 30, 2026

// Test 1: Project to February 2027
const targetFeb2027 = new Date('2027-02-15');
const resFeb2027 = getProjectedBalanceMock(m, today, targetFeb2027);
console.log('Projecting to Feb 2027:', resFeb2027);
// Expected:
// Months completed: Aug, Sept, Oct, Nov, Dec, Jan, Feb = 7 months -> 7 * 2.5 = 17.5j
// Anniversary: Nov 25, 2026 is between July 30, 2026 and Feb 28, 2027 -> 1 anniversary -> +30j
// Total CP = 24 (remaining) + 17.5 (monthly) + 30 (anniversary) = 71.5j
if (resFeb2027.cp === 71.5 && resFeb2027.cpBreakdown === '+2.5j acquis') {
  console.log('✅ Test 1 Passed (Feb 2027 projection: 71.5j, breakdown: "+2.5j acquis")');
} else {
  console.error(`❌ Test 1 Failed: expected 71.5 and "+2.5j acquis", got ${resFeb2027.cp} and "${resFeb2027.cpBreakdown}"`);
  process.exit(1);
}

// Test 2: Project to current month July 2026 (target date July 15, 2026)
const targetJuly2026 = new Date('2026-07-15');
const resJuly2026 = getProjectedBalanceMock(m, today, targetJuly2026);
console.log('Projecting to July 2026:', resJuly2026);
// Months difference = 0
// Expected: 0j acquis, 0j anniv. Total = 24j
if (resJuly2026.cp === 24 && resJuly2026.cpBreakdown === '') {
  console.log('✅ Test 2 Passed (July 2026 projection: 24j, breakdown: "")');
} else {
  console.error(`❌ Test 2 Failed: expected 24 and "", got ${resJuly2026.cp} and "${resJuly2026.cpBreakdown}"`);
  process.exit(1);
}

// Test 3: Project to August 2026
const targetAugust2026 = new Date('2026-08-15');
const resAugust2026 = getProjectedBalanceMock(m, today, targetAugust2026);
console.log('Projecting to August 2026:', resAugust2026);
// Months difference = 1 -> 1 * 2.5 = 2.5j
// Expected: +2.5j acquis, 0j anniv. Total = 24 + 2.5 = 26.5j
if (resAugust2026.cp === 26.5 && resAugust2026.cpBreakdown === '+2.5j acquis') {
  console.log('✅ Test 3 Passed (August 2026 projection: 26.5j, breakdown: "+2.5j acquis")');
} else {
  console.error(`❌ Test 3 Failed: expected 26.5 and "+2.5j acquis", got ${resAugust2026.cp} and "${resAugust2026.cpBreakdown}"`);
  process.exit(1);
}

// Test 4: Project to past month June 2026
const targetJune2026 = new Date('2026-06-15');
const resJune2026 = getProjectedBalanceMock(m, today, targetJune2026);
console.log('Projecting to June 2026:', resJune2026);
// Months difference = -1 -> -2.5j
// Expected: -2.5j acquis, 0j anniv. Total = 24 - 2.5 = 21.5j
if (resJune2026.cp === 21.5 && resJune2026.cpBreakdown === '-2.5j acquis') {
  console.log('✅ Test 4 Passed (June 2026 projection: 21.5j, breakdown: "-2.5j acquis")');
} else {
  console.error(`❌ Test 4 Failed: expected 21.5 and "-2.5j acquis", got ${resJune2026.cp} and "${resJune2026.cpBreakdown}"`);
  process.exit(1);
}

// Test 5: Project to anniversary month November 2026
const targetNov2026 = new Date('2026-11-15');
const resNov2026 = getProjectedBalanceMock(m, today, targetNov2026);
console.log('Projecting to November 2026:', resNov2026);
// Months difference = 4 -> 4 * 2.5 = 10j
// Anniversary Nov 25 is in this month -> +30j
// Expected: +2.5j acquis, +30j anniv. Total = 24 + 10 + 30 = 64j
if (resNov2026.cp === 64 && resNov2026.cpBreakdown === '+2.5j acquis, +30j anniv.') {
  console.log('✅ Test 5 Passed (November 2026 projection: 64j, breakdown: "+2.5j acquis, +30j anniv.")');
} else {
  console.error(`❌ Test 5 Failed: expected 64 and "+2.5j acquis, +30j anniv.", got ${resNov2026.cp} and "${resNov2026.cpBreakdown}"`);
  process.exit(1);
}

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
