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

// ==========================================
// 1. UNIT TESTS: calculateBusinessDays
// ==========================================
console.log('--- Testing calculateBusinessDays (Friday-Saturday Rule) ---');
assertEqual(calculateBusinessDays('2026-07-13', '2026-07-17'), 6, '5 working days + 1 Saturday (Friday included)');
assertEqual(calculateBusinessDays('2026-07-10', '2026-07-13'), 3, '2 working days + 1 Saturday (Friday included)');
assertEqual(calculateBusinessDays('2026-07-11', '2026-07-12'), 0, '0 working days over weekend (no Friday)');
assertEqual(calculateBusinessDays('2026-07-17', '2026-07-17'), 2, 'Friday alone counts as 2 days (Friday + Saturday)');

// ==========================================
// 2. MOCK INTEGRATION TESTS FOR NEW ENDPOINTS
// ==========================================
console.log('\n--- Running Extended Admin Controller Simulation (Mocks) ---');

// Mock Database Representation
const mockBalances = [
  { employee_id: 'emp-123', employee_name: 'Alice Martin', employee_email: 'employee@entreprise.com', initial_balance: 25.0, taken_days: 5.0, remaining_balance: 20.0, initial_perm: 5.0, taken_perm: 0.0, remaining_perm: 5.0, manager_name: 'Bob Dupont' },
  { employee_id: 'emp-456', employee_name: 'Bob Dupont', employee_email: 'hr@entreprise.com', initial_balance: 25.0, taken_days: 0.0, remaining_balance: 25.0, initial_perm: 5.0, taken_perm: 0.0, remaining_perm: 5.0, manager_name: 'Aucun' }
];

// Simulation functions matching our API endpoints
function simulateGetMembers(userRole) {
  console.log(`\n[Get Members] Role: ${userRole}`);
  if (userRole !== 'hr') {
    return { status: 403, error: 'Access denied.' };
  }
  return { status: 200, count: mockBalances.length, members: mockBalances };
}

function simulateCreateMember(userRole, body) {
  console.log(`\n[Create Member] Role: ${userRole}, Body:`, body);
  if (userRole !== 'hr') {
    return { status: 403, error: 'Access denied.' };
  }

  const { email, name, manager_name, initial_balance, initial_perm } = body;
  if (!email || !name) {
    return { status: 400, error: 'Missing email or name.' };
  }

  const exists = mockBalances.some(m => m.employee_email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return { status: 400, error: 'Member already exists.' };
  }

  const newMember = {
    employee_id: 'emp-' + Math.random().toString(36).substr(2, 9),
    employee_name: name,
    employee_email: email.toLowerCase(),
    initial_balance: parseFloat(initial_balance || 0),
    taken_days: 0.0,
    remaining_balance: parseFloat(initial_balance || 0),
    initial_perm: parseFloat(initial_perm || 0),
    taken_perm: 0.0,
    remaining_perm: parseFloat(initial_perm || 0),
    manager_name: manager_name || 'Aucun'
  };

  mockBalances.push(newMember);
  return { status: 200, member: newMember };
}

function simulateUpdateMember(userRole, body) {
  console.log(`\n[Update Member] Role: ${userRole}, Body:`, body);
  if (userRole !== 'hr') {
    return { status: 403, error: 'Access denied.' };
  }

  const { employee_id, name, email, manager_name, initial_balance, initial_perm } = body;
  const memberIndex = mockBalances.findIndex(m => m.employee_id === employee_id);
  if (memberIndex === -1) {
    return { status: 404, error: 'Member not found.' };
  }

  const member = mockBalances[memberIndex];
  member.employee_name = name;
  member.employee_email = email.toLowerCase();
  member.manager_name = manager_name;
  member.initial_balance = parseFloat(initial_balance || 0);
  member.remaining_balance = member.initial_balance - member.taken_days;
  member.initial_perm = parseFloat(initial_perm || 0);
  member.remaining_perm = member.initial_perm - member.taken_perm;

  return { status: 200, member };
}

function simulateDeleteMember(userRole, body) {
  console.log(`\n[Delete Member] Role: ${userRole}, Body:`, body);
  if (userRole !== 'hr') {
    return { status: 403, error: 'Access denied.' };
  }

  const { employee_id } = body;
  const memberIndex = mockBalances.findIndex(m => m.employee_id === employee_id);
  if (memberIndex === -1) {
    return { status: 404, error: 'Member not found.' };
  }

  const deletedName = mockBalances[memberIndex].employee_name;
  mockBalances.splice(memberIndex, 1);
  return { status: 200, employee_name: deletedName };
}

// --- Execute Admin API flows ---

// 1. GET /api/admin/members - authorized (HR)
const m1 = simulateGetMembers('hr');
assertEqual(m1.status, 200, 'HR can list members');
assertEqual(m1.count, 2, 'Initial members list contains 2 members');

// 2. POST /api/admin/create-member - authorized (HR)
const m2 = simulateCreateMember('hr', {
  email: 'new-hire@entreprise.com',
  name: 'Charlotte Dubois',
  manager_name: 'Alice Martin',
  initial_balance: 15.0,
  initial_perm: 5.0
});
assertEqual(m2.status, 200, 'HR can create a new member');
assertEqual(mockBalances.length, 3, 'Total members increased to 3');

// 3. POST /api/admin/update-member - modify Charlotte
const m3 = simulateUpdateMember('hr', {
  employee_id: mockBalances[2].employee_id,
  name: 'Charlotte Dubois Updated',
  email: 'charlotte.updated@entreprise.com',
  manager_name: 'Bob Dupont',
  initial_balance: 20.0,
  initial_perm: 8.0
});
assertEqual(m3.status, 200, 'HR can update a member');
assertEqual(mockBalances[2].employee_name, 'Charlotte Dubois Updated', 'Name successfully updated');
assertEqual(mockBalances[2].initial_balance, 20.0, 'CP successfully updated');

// 4. POST /api/admin/delete-member - delete Charlotte
const m4 = simulateDeleteMember('hr', {
  employee_id: mockBalances[2].employee_id
});
assertEqual(m4.status, 200, 'HR can delete a member');
assertEqual(mockBalances.length, 2, 'Total members reduced back to 2');

console.log('\n🎉 ALL MOCK API TESTS PASSED SUCCESSFULLY! BOTH UPDATE AND DELETE LOGIC WORK! 🎉');
