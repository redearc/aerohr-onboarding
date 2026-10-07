/**
 * AeroHR Compliance Rules Engine Test Suite
 * Validates deterministic rules against California Labor Code & FLSA scenarios.
 */
const {
  evaluateMealBreakCompliance,
  calculateWorkforceHoursAndPay,
  reconcileTimesheetWithAttendance,
  evaluateApprovalRisk
} = require('./rules_engine.js');

function runTests() {
  console.log('=== Running AeroHR Rules Engine Test Suite ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Test 1: Compliant Meal Break (Started at 4h 30m, duration 35m)
  // -------------------------------------------------------------------------
  const shiftStart = new Date('2026-10-06T09:00:00Z');
  const mealStart = new Date('2026-10-06T13:30:00Z'); // 4.5 hours in
  const res1 = evaluateMealBreakCompliance({
    shiftStartTime: shiftStart.toISOString(),
    mealBreakStartTime: mealStart.toISOString(),
    mealBreakDurationMinutes: 35,
    shiftDurationHours: 8.0,
    jurisdiction: 'US_CA'
  });
  assert(res1.isCompliant === true && res1.penaltyHours === 0, 'On-time 35m meal break is 100% compliant');

  // -------------------------------------------------------------------------
  // Test 2: Late Meal Break (Started at 5h 15m -> CA 5th hour violation)
  // -------------------------------------------------------------------------
  const lateMealStart = new Date('2026-10-06T14:15:00Z'); // 5h 15m in (315m)
  const res2 = evaluateMealBreakCompliance({
    shiftStartTime: shiftStart.toISOString(),
    mealBreakStartTime: lateMealStart.toISOString(),
    mealBreakDurationMinutes: 30,
    shiftDurationHours: 8.0,
    jurisdiction: 'US_CA'
  });
  assert(res2.isCompliant === false && res2.penaltyHours === 1.0, 'Late meal break (>5h) triggers 1h statutory penalty');

  // -------------------------------------------------------------------------
  // Test 3: Short Meal Break (20 minutes < 30m required)
  // -------------------------------------------------------------------------
  const res3 = evaluateMealBreakCompliance({
    shiftStartTime: shiftStart.toISOString(),
    mealBreakStartTime: mealStart.toISOString(),
    mealBreakDurationMinutes: 20, // Too short!
    shiftDurationHours: 8.0,
    jurisdiction: 'US_CA'
  });
  assert(res3.isCompliant === false && res3.penaltyHours === 1.0, 'Short meal break (<30m) triggers 1h statutory penalty');

  // -------------------------------------------------------------------------
  // Test 4: California Daily Overtime & Double Time Calculations
  // Shift: Mon (10h), Tue (14h), Wed (8h), Thu (8h), Fri (4h) = 44h total
  // Mon: 8 regular, 2 overtime
  // Tue: 8 regular, 4 overtime, 2 double time
  // Wed: 8 regular
  // Thu: 8 regular
  // Fri: 4 regular -> wait, regular total: 8+8+8+8+4 = 36 <= 40
  // Overtime: 2 + 4 = 6
  // Double time: 2
  // Total: 36 regular, 6 overtime, 2 double time
  // -------------------------------------------------------------------------
  const payCalc = calculateWorkforceHoursAndPay([10, 14, 8, 8, 4], 50.00, 'US_CA');
  assert(payCalc.regularHours === 36.0, `Regular hours calculated: ${payCalc.regularHours} (expected 36)`);
  assert(payCalc.overtimeHours === 6.0, `Overtime hours (1.5x) calculated: ${payCalc.overtimeHours} (expected 6)`);
  assert(payCalc.doubleTimeHours === 2.0, `Double time hours (2.0x) calculated: ${payCalc.doubleTimeHours} (expected 2)`);
  // Pay: 36*50 ($1800) + 6*(50*1.5 = $450) + 2*(50*2 = $200) = $2450
  assert(payCalc.totalGrossPay === 2450.00, `Total gross pay: $${payCalc.totalGrossPay} (expected $2450)`);

  // -------------------------------------------------------------------------
  // Test 5: Timesheet Reconciler & Auto-Approval
  // -------------------------------------------------------------------------
  const reconPass = reconcileTimesheetWithAttendance(40.0, 40.2, 30);
  assert(reconPass.isWithinTolerance === true, '12m variance is within 30m tolerance threshold');

  const reconFail = reconcileTimesheetWithAttendance(40.0, 42.5, 30);
  assert(reconFail.isWithinTolerance === false && reconFail.anomalySeverity === 'HIGH', '150m variance flagged as HIGH anomaly');

  const riskLow = evaluateApprovalRisk({ overtimeHours: 0, varianceMinutes: 10, projectBudgetExceeded: false, hasUnexcusedMissedPunch: false });
  assert(riskLow.autoApprovable === true && riskLow.riskLevel === 'LOW_RISK', 'Clean timesheet is flagged for Auto-Approval');

  const riskHigh = evaluateApprovalRisk({ overtimeHours: 2, varianceMinutes: 0, projectBudgetExceeded: true, hasUnexcusedMissedPunch: false });
  assert(riskHigh.autoApprovable === false && riskHigh.riskLevel === 'HIGH_RISK', 'Budget overrun escalates to DEPARTMENT_HEAD');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
}

runTests();
