import { calculateBusinessDays } from '../lib/utils.js';

// Mock getProjectedBalance using the new logic we implemented in app/page.js
const getProjectedBalanceMock = (m, today, targetDate, allRequests) => {
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

  // 1. Monthly Accrual: Removed
  const todayMonthIndex = todayUTC.getUTCFullYear() * 12 + todayUTC.getUTCMonth();
  const targetMonthIndex = targetEndUTC.getUTCFullYear() * 12 + targetEndUTC.getUTCMonth();
  const monthsDiff = targetMonthIndex - todayMonthIndex;

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

  let overlapCP = 0;
  let overlapPerm = 0;

  const employeeReqs = allRequests.filter(req => req.employee_id === m.employee_id && req.status !== 'Refusé');

  employeeReqs.forEach(req => {
    const isNoDeduct = req.leave_type.toLowerCase().includes('sans solde') || 
                       req.leave_type.toLowerCase().includes('rattraper') || 
                       req.leave_type.toLowerCase().includes('maladie');
    if (isNoDeduct) return;

    const isPermission = req.leave_type.toLowerCase().includes('perm');

    // Calculate total business days of the request using current calculation rules
    let totalDays = 0;
    try {
      totalDays = calculateBusinessDays(req.start_date, req.end_date);
    } catch (e) {}

    if (totalDays > 0) {
      const reqBusinessDays = parseFloat(req.business_days || 0);

      if (req.status === 'Approuvé') {
        // Calculate portion after targetEnd
        const targetEndStr = `${targetEnd.getFullYear()}-${String(targetEnd.getMonth() + 1).padStart(2, '0')}-${String(targetEnd.getDate()).padStart(2, '0')}`;
        if (req.end_date > targetEndStr) {
          // Find start of the portion after targetEnd
          const nextDay = new Date(targetEnd);
          nextDay.setDate(targetEnd.getDate() + 1);
          const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
          
          const overlapStart = req.start_date > nextDayStr ? req.start_date : nextDayStr;
          let afterDays = 0;
          try {
            afterDays = calculateBusinessDays(overlapStart, req.end_date);
          } catch (e) {}
          
          const fraction = afterDays / totalDays;
          if (!isPermission) {
            overlapCP -= reqBusinessDays * fraction; // Subtracting negative overlap means adding back!
          } else {
            overlapPerm -= reqBusinessDays * fraction;
          }
        }
      } else if (req.status === 'En attente') {
        // Calculate portion before or on targetEnd
        const targetEndStr = `${targetEnd.getFullYear()}-${String(targetEnd.getMonth() + 1).padStart(2, '0')}-${String(targetEnd.getDate()).padStart(2, '0')}`;
        if (req.start_date <= targetEndStr) {
          const overlapEnd = req.end_date < targetEndStr ? req.end_date : targetEndStr;
          let beforeDays = 0;
          try {
            beforeDays = calculateBusinessDays(req.start_date, overlapEnd);
          } catch (e) {}
          
          const fraction = beforeDays / totalDays;
          if (isPermission) {
            overlapPerm += reqBusinessDays * fraction;
          } else {
            overlapCP += reqBusinessDays * fraction;
          }
        }
      }
    }
  });

  const projectedCP = m.remaining_balance + cpMonthly + cpAnniversary - overlapCP;
  const projectedPerm = m.remaining_perm - overlapPerm;

  return {
    cp: parseFloat(Math.max(0, projectedCP).toFixed(1)),
    perm: parseFloat(Math.max(0, projectedPerm).toFixed(1))
  };
};

// Test Suite
console.log('--- Running Projected Balance Unit Tests ---');

const dany = {
  employee_id: 'dany-1',
  remaining_balance: 26,
  remaining_perm: 5,
  hire_date: '2019-11-25'
};

const mamintsoavina = {
  employee_id: 'mamintsoavina-1',
  remaining_balance: 4,
  remaining_perm: 5,
  hire_date: '2023-10-15'
};

const today = new Date('2026-07-30'); // July 30, 2026

// Mock Database Requests
const requests = [
  {
    employee_id: 'dany-1',
    start_date: '2026-08-06',
    end_date: '2026-08-08',
    business_days: 3,
    status: 'En attente',
    leave_type: 'CP'
  },
  {
    employee_id: 'mamintsoavina-1',
    start_date: '2026-12-24',
    end_date: '2027-01-04',
    business_days: 10, // Database still has old 10 days stored
    status: 'Approuvé',
    leave_type: 'CP'
  }
];

// Test Dany's projections
console.log('\n--- Dany Projections ---');
const danyAug = getProjectedBalanceMock(dany, today, new Date('2026-08-15'), requests);
console.log('Dany August 2026:', danyAug); // Expected: 26 + 0 - 3 = 23

const danySept = getProjectedBalanceMock(dany, today, new Date('2026-09-15'), requests);
console.log('Dany September 2026:', danySept); // Expected: 26 + 0 - 3 = 23

// Test Mamintsoavina's projections
console.log('\n--- Mamintsoavina Projections ---');
const mamAug = getProjectedBalanceMock(mamintsoavina, today, new Date('2026-08-15'), requests);
console.log('Mamintsoavina August 2026:', mamAug); // Expected: 4 + 0 + 10 = 14

const mamDec = getProjectedBalanceMock(mamintsoavina, today, new Date('2026-12-15'), requests);
console.log('Mamintsoavina December 2026:', mamDec); // Expected: 4 + 30 + 10 * (1/6) = 35.67 (35.7)

const mamJan = getProjectedBalanceMock(mamintsoavina, today, new Date('2027-01-15'), requests);
console.log('Mamintsoavina January 2027:', mamJan); // Expected: 4 + 30 + 0 = 34
