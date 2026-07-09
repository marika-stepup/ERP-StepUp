import { calculateBusinessDays } from '../lib/utils.js';

// --- Test Utilities ---
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function assertThrows(fn, message) {
  try {
    fn();
    console.error(`❌ FAIL: ${message} (Expected to throw but succeeded)`);
    process.exit(1);
  } catch (e) {
    console.log(`✅ PASS: ${message} (Threw: "${e.message}")`);
  }
}

// ==========================================
// 1. UNIT TESTS: calculateBusinessDays
// ==========================================
console.log('--- Testing calculateBusinessDays ---');

// Standard week (Monday to Friday)
assertEqual(calculateBusinessDays('2026-07-13', '2026-07-17'), 5, '5 working days in a week');

// Weekend crossing (Friday to Monday)
assertEqual(calculateBusinessDays('2026-07-10', '2026-07-13'), 2, '2 working days between Friday and Monday');

// Weekend only (Saturday to Sunday)
assertEqual(calculateBusinessDays('2026-07-11', '2026-07-12'), 0, '0 working days over a weekend');

// Single weekend day
assertEqual(calculateBusinessDays('2026-07-12', '2026-07-12'), 0, '0 working days for Sunday');

// Single working day (Wednesday)
assertEqual(calculateBusinessDays('2026-07-15', '2026-07-15'), 1, '1 working day for a Wednesday');

// Inverted dates error
assertThrows(() => {
  calculateBusinessDays('2026-07-15', '2026-07-14');
}, 'Should throw error when start date is after end date');

// Invalid date string
assertThrows(() => {
  calculateBusinessDays('invalid-date', '2026-07-15');
}, 'Should throw error on invalid date formats');


// ==========================================
// 2. MOCK INTEGRATION TESTS FOR CONTROLLERS
// ==========================================
console.log('\n--- Running Controller Simulation (Mocks) ---');

// Simple mock implementation of the database & authentication for route verification
const mockBalances = [
  { employee_id: 'emp-123', employee_name: 'Alice Martin', initial_balance: 25.0, taken_days: 5.0, remaining_balance: 20.0 },
  { employee_id: 'emp-456', employee_name: 'Bob Dupont', initial_balance: 10.0, taken_days: 9.0, remaining_balance: 1.0 }
];

const mockRequests = [];

// Simulation of submit handler logic
function simulateSubmitLeave(userRole, userId, requestBody) {
  console.log(`\n[Submit Request] User: ${userId} (${userRole})`);
  
  // 1. Role validation
  if (userRole !== 'employee') {
    return { status: 403, error: `Access denied. Role "${userRole}" is not authorized.` };
  }

  const { start_date, end_date, leave_type } = requestBody;
  if (!start_date || !end_date || !leave_type) {
    return { status: 400, error: 'Missing required fields.' };
  }

  // 2. Business days calculation
  let businessDays;
  try {
    businessDays = calculateBusinessDays(start_date, end_date);
  } catch (err) {
    return { status: 400, error: err.message };
  }

  if (businessDays <= 0) {
    return { status: 400, error: 'No business days in range.' };
  }

  // 3. Balance verification
  const balance = mockBalances.find(b => b.employee_id === userId);
  if (!balance) {
    return { status: 404, error: 'No balance record found.' };
  }

  if (balance.remaining_balance < businessDays) {
    return { 
      status: 400, 
      error: `Insufficient balance. Requested: ${businessDays}, Available: ${balance.remaining_balance}` 
    };
  }

  // 4. Create request
  const newRequest = {
    request_id: 'req-' + Math.random().toString(36).substr(2, 9),
    employee_id: userId,
    employee_name: balance.employee_name,
    start_date,
    end_date,
    business_days: businessDays,
    leave_type,
    status: 'Pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    hr_comment: ''
  };

  mockRequests.push(newRequest);
  return { status: 200, message: 'Submitted', request: newRequest };
}

// Simulation of pending handler logic
function simulateGetPending(userRole) {
  console.log(`\n[Get Pending] Role: ${userRole}`);
  if (userRole !== 'hr') {
    return { status: 403, error: `Access denied. Role "${userRole}" is not authorized.` };
  }

  const pending = mockRequests.filter(r => r.status === 'Pending');
  return { status: 200, count: pending.length, requests: pending };
}

// Simulation of validation handler logic
function simulateValidateLeave(userRole, requestBody) {
  console.log(`\n[Validate Request] Role: ${userRole}, Body:`, requestBody);
  if (userRole !== 'hr') {
    return { status: 403, error: `Access denied. Role "${userRole}" is not authorized.` };
  }

  const { request_id, action, hr_comment } = requestBody;
  if (!request_id || !action) {
    return { status: 400, error: 'Missing parameters.' };
  }

  const request = mockRequests.find(r => r.request_id === request_id);
  if (!request) {
    return { status: 404, error: 'Request not found.' };
  }

  if (request.status !== 'Pending') {
    return { status: 400, error: 'Request already processed.' };
  }

  if (action === 'Approuver') {
    const balance = mockBalances.find(b => b.employee_id === request.employee_id);
    if (!balance) {
      return { status: 404, error: 'Balance record not found.' };
    }

    if (balance.remaining_balance < request.business_days) {
      return { status: 400, error: 'Insufficient balance on approval time.' };
    }

    // Update balance
    balance.taken_days += request.business_days;
    balance.remaining_balance -= request.business_days;

    // Update request
    request.status = 'Approved';
    request.hr_comment = hr_comment || 'Approved by HR';
    request.updated_at = new Date().toISOString();

    return { status: 200, message: 'Approved', request, balance };
  } else if (action === 'Refuser') {
    request.status = 'Rejected';
    request.hr_comment = hr_comment || 'Rejected by HR';
    request.updated_at = new Date().toISOString();

    return { status: 200, message: 'Rejected', request };
  } else {
    return { status: 400, error: 'Invalid action.' };
  }
}

// --- Execute simulation flow ---

// 1. Employee Alice submits a valid request (5 working days)
const res1 = simulateSubmitLeave('employee', 'emp-123', {
  start_date: '2026-07-13',
  end_date: '2026-07-17',
  leave_type: 'CP'
});
assertEqual(res1.status, 200, 'Alice submits a 5-day request');
assertEqual(res1.request.business_days, 5, 'Calculated business days is 5');
assertEqual(res1.request.status, 'Pending', 'Status is initially Pending');

// 2. Employee Bob submits an invalid request (wants 5 days, but only has 1 day)
const res2 = simulateSubmitLeave('employee', 'emp-456', {
  start_date: '2026-07-13',
  end_date: '2026-07-17',
  leave_type: 'CP'
});
assertEqual(res2.status, 400, 'Bob request fails due to insufficient balance');

// 3. HR lists pending requests (should see Alice's request)
const res3 = simulateGetPending('hr');
assertEqual(res3.status, 200, 'HR retrieves pending list');
assertEqual(res3.count, 1, 'HR finds 1 pending request');
assertEqual(res3.requests[0].employee_name, 'Alice Martin', 'Pending request belongs to Alice');

// 4. Employee Alice tries to retrieve pending requests (should be forbidden)
const res4 = simulateGetPending('employee');
assertEqual(res4.status, 403, 'Employee cannot list pending requests');

// 5. HR approves Alice's request
const aliceRequestId = res1.request.request_id;
const res5 = simulateValidateLeave('hr', {
  request_id: aliceRequestId,
  action: 'Approuver',
  hr_comment: 'Bonnes vacances!'
});
assertEqual(res5.status, 200, 'HR successfully approves request');
assertEqual(res5.balance.taken_days, 10.0, 'Alice taken_days increased to 10.0');
assertEqual(res5.balance.remaining_balance, 15.0, 'Alice remaining_balance decreased to 15.0');
assertEqual(res5.request.status, 'Approved', 'Alice request status is updated to Approved');

// 6. HR tries to validate the same request again
const res6 = simulateValidateLeave('hr', {
  request_id: aliceRequestId,
  action: 'Approuver'
});
assertEqual(res6.status, 400, 'Re-validating already processed request fails');

console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! BUSINESS LOGIC IS SOLID! 🎉');
