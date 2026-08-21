import { calculateBusinessDays } from '../lib/utils.js';

function calculateDaysForRequest(start_date, end_date, start_time, end_time, leave_type) {
  let businessDays;
  let formattedLeaveType = leave_type;

  const isSingleDay = start_date === end_date;
  const hasCustomHours = start_time && end_time && (start_time !== '08:00' || end_time !== '17:00');

  if (isSingleDay && start_time && end_time) {
    const [startH, startM] = start_time.split(':').map(Number);
    const [endH, endM] = end_time.split(':').map(Number);
    const durationInHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

    if (durationInHours <= 0) {
      throw new Error("L'heure de fin doit être supérieure à l'heure de début.");
    }

    if (durationInHours < 1) {
      throw new Error("La durée minimale d'un congé ou d'une permission est de 1 heure.");
    }

    if (durationInHours < 8) {
      businessDays = durationInHours / 8;
      formattedLeaveType = `${leave_type} (${start_time} - ${end_time})`;
    } else {
      businessDays = calculateBusinessDays(start_date, end_date);
      if (hasCustomHours) {
        formattedLeaveType = `${leave_type} (${start_time} - ${end_time})`;
      }
    }
  } else {
    businessDays = calculateBusinessDays(start_date, end_date);
  }

  return { businessDays, leaveType: formattedLeaveType };
}

// Assertions helper
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${expected}, got ${actual})`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function expectError(fn, expectedMsg, message) {
  try {
    fn();
    console.error(`❌ FAIL: ${message} (Expected error "${expectedMsg}", but function succeeded)`);
    process.exit(1);
  } catch (err) {
    if (err.message.includes(expectedMsg)) {
      console.log(`✅ PASS: ${message} (Error caught: ${err.message})`);
    } else {
      console.error(`❌ FAIL: ${message} (Expected error containing "${expectedMsg}", got "${err.message}")`);
      process.exit(1);
    }
  }
}

console.log('--- Testing Hourly Leave Calculations ---');

// Test 1: Single day request with 2 hours (08:00 - 10:00)
const res1 = calculateDaysForRequest('2026-08-21', '2026-08-21', '08:00', '10:00', 'Permission');
assertEqual(res1.businessDays, 0.25, '2 hours = 0.25 days');
assertEqual(res1.leaveType, 'Permission (08:00 - 10:00)', 'Leave type has times appended');

// Test 2: Single day request with 1 hour (08:00 - 09:00)
const res2 = calculateDaysForRequest('2026-08-21', '2026-08-21', '08:00', '09:00', 'Permission');
assertEqual(res2.businessDays, 0.125, '1 hour = 0.125 days');
assertEqual(res2.leaveType, 'Permission (08:00 - 09:00)', 'Leave type has times appended');

// Test 3: Less than 1 hour (ex: 30 minutes) should throw error
expectError(
  () => calculateDaysForRequest('2026-08-21', '2026-08-21', '08:00', '08:30', 'Permission'),
  "La durée minimale d'un congé ou d'une permission est de 1 heure.",
  '30 minutes is rejected'
);

// Test 4: End time before start time should throw error
expectError(
  () => calculateDaysForRequest('2026-08-21', '2026-08-21', '10:00', '08:00', 'Permission'),
  "L'heure de fin doit être supérieure à l'heure de début.",
  'End time before start time is rejected'
);

// Test 5: Standard working hours (08:00 - 17:00, Friday rule)
// Note: 2026-08-21 is a Friday, so standard business days = 2.0 (Friday + Saturday)
const res5 = calculateDaysForRequest('2026-08-21', '2026-08-21', '08:00', '17:00', 'CP');
assertEqual(res5.businessDays, 2.0, 'Full day Friday = 2 days');
assertEqual(res5.leaveType, 'CP', 'Leave type has no times appended for standard hours');

// Test 6: Non-standard working hours that are >= 8 hours (08:00 - 16:30 = 8.5 hours)
const res6 = calculateDaysForRequest('2026-08-21', '2026-08-21', '08:00', '16:30', 'Permission');
assertEqual(res6.businessDays, 2.0, 'Full day on Friday count is used because duration >= 8h');
assertEqual(res6.leaveType, 'Permission (08:00 - 16:30)', 'Leave type has custom times appended');

// Test 7: Multi-day request
const res7 = calculateDaysForRequest('2026-08-20', '2026-08-21', '08:00', '17:00', 'CP');
assertEqual(res7.businessDays, 3.0, 'Thursday (1) + Friday (2) = 3 days');
assertEqual(res7.leaveType, 'CP', 'Multi-day request does not append times');

console.log('\n🎉 ALL HOURLY LEAVE CALCULATIONS TESTS PASSED SUCCESSFULLY! 🎉');
