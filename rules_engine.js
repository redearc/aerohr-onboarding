/**
 * AeroHR Deterministic Compliance & Labor Rules Engine
 * Enforces FLSA, California Labor Code, and workforce compliance deterministically.
 */

// ----------------------------------------------------------------------------
// 1. Statutory Meal & Rest Break Compliance (California Labor Code § 512)
// ----------------------------------------------------------------------------
function evaluateMealBreakCompliance(shift) {
  const { shiftStartTime, mealBreakStartTime, mealBreakDurationMinutes, shiftDurationHours, jurisdiction = 'US_CA' } = shift;

  if (jurisdiction !== 'US_CA') {
    return { isCompliant: true, penaltyHours: 0, reason: 'Jurisdiction does not mandate statutory meal premium penalties.' };
  }

  // Shifts under 5 hours do not mandate a meal break
  if (shiftDurationHours <= 5.0) {
    return { isCompliant: true, penaltyHours: 0, reason: 'Shift duration <= 5 hours; no statutory meal break required.' };
  }

  // If shift > 5 hours, meal break must start before the end of the 5th hour (300 minutes)
  const shiftStart = new Date(shiftStartTime).getTime();
  if (!mealBreakStartTime) {
    return {
      isCompliant: false,
      penaltyHours: 1.0,
      violationCode: 'MISSED_MEAL_BREAK',
      reason: 'No meal break was recorded for a shift exceeding 5 hours. Statutory 1-hour premium pay incurred.'
    };
  }

  const mealStart = new Date(mealBreakStartTime).getTime();
  const minutesWorkedBeforeMeal = (mealStart - shiftStart) / (1000 * 60);

  if (minutesWorkedBeforeMeal > 300) { // 5 hours = 300 minutes
    return {
      isCompliant: false,
      penaltyHours: 1.0,
      violationCode: 'LATE_MEAL_BREAK_PAST_5TH_HOUR',
      reason: `Meal break began at ${Math.round(minutesWorkedBeforeMeal)}m, exceeding the 300-minute statutory window. 1-hour premium pay incurred.`
    };
  }

  // Meal break must be at least 30 uninterrupted minutes
  if (mealBreakDurationMinutes < 30) {
    return {
      isCompliant: false,
      penaltyHours: 1.0,
      violationCode: 'SHORT_MEAL_BREAK',
      reason: `Meal break was only ${mealBreakDurationMinutes} minutes (minimum 30 minutes required). 1-hour premium pay incurred.`
    };
  }

  return {
    isCompliant: true,
    penaltyHours: 0,
    violationCode: null,
    reason: 'Compliant statutory meal break.'
  };
}

// ----------------------------------------------------------------------------
// 2. Overtime Multiplier Engine (FLSA & California Rules)
// ----------------------------------------------------------------------------
function calculateWorkforceHoursAndPay(dailyHoursArray, baseHourlyRate, jurisdiction = 'US_CA') {
  let regularHours = 0;
  let overtimeHours = 0; // 1.5x
  let doubleTimeHours = 0; // 2.0x

  if (jurisdiction === 'US_CA') {
    // California daily rules:
    // First 8 hours = regular
    // Hours 8 to 12 = 1.5x overtime
    // Hours over 12 = 2.0x double time
    // Also, any weekly hours > 40 count as overtime
    dailyHoursArray.forEach(dailyHours => {
      if (dailyHours <= 8.0) {
        regularHours += dailyHours;
      } else if (dailyHours <= 12.0) {
        regularHours += 8.0;
        overtimeHours += (dailyHours - 8.0);
      } else {
        regularHours += 8.0;
        overtimeHours += 4.0;
        doubleTimeHours += (dailyHours - 12.0);
      }
    });

    // Re-check weekly regular threshold (max 40 regular hours per week)
    if (regularHours > 40.0) {
      const excess = regularHours - 40.0;
      regularHours = 40.0;
      overtimeHours += excess;
    }
  } else {
    // Standard FLSA weekly overtime (>40 hours = 1.5x)
    const totalWeeklyHours = dailyHoursArray.reduce((acc, h) => acc + h, 0);
    if (totalWeeklyHours <= 40.0) {
      regularHours = totalWeeklyHours;
    } else {
      regularHours = 40.0;
      overtimeHours = totalWeeklyHours - 40.0;
    }
  }

  const regularPay = regularHours * baseHourlyRate;
  const overtimePay = overtimeHours * (baseHourlyRate * 1.5);
  const doubleTimePay = doubleTimeHours * (baseHourlyRate * 2.0);
  const totalGrossPay = regularPay + overtimePay + doubleTimePay;

  return {
    regularHours,
    overtimeHours,
    doubleTimeHours,
    totalHours: regularHours + overtimeHours + doubleTimeHours,
    baseHourlyRate,
    regularPay,
    overtimePay,
    doubleTimePay,
    totalGrossPay
  };
}

// ----------------------------------------------------------------------------
// 3. Attendance vs. Timesheet Discrepancy Analyzer
// ----------------------------------------------------------------------------
function reconcileTimesheetWithAttendance(clockedHours, allocatedTimesheetHours, toleranceMinutes = 30) {
  const diffMinutes = Math.abs(clockedHours - allocatedTimesheetHours) * 60;
  const isWithinTolerance = diffMinutes <= toleranceMinutes;

  return {
    clockedHours,
    allocatedTimesheetHours,
    varianceMinutes: Math.round(diffMinutes),
    isWithinTolerance,
    anomalySeverity: isWithinTolerance ? 'INFO' : (diffMinutes > 120 ? 'HIGH' : 'MEDIUM'),
    warningMessage: isWithinTolerance 
      ? 'Allocated timesheet hours match clocked attendance within acceptable variance.'
      : `Discrepancy of ${Math.round(diffMinutes)} minutes detected between attendance and project timesheet.`
  };
}

// ----------------------------------------------------------------------------
// 4. Auto-Approval Risk Evaluator
// ----------------------------------------------------------------------------
function evaluateApprovalRisk(timesheet) {
  const { overtimeHours, varianceMinutes, projectBudgetExceeded, hasUnexcusedMissedPunch } = timesheet;

  if (hasUnexcusedMissedPunch || projectBudgetExceeded) {
    return {
      riskLevel: 'HIGH_RISK',
      autoApprovable: false,
      routingTarget: 'DEPARTMENT_HEAD',
      reason: 'Requires senior approval due to budget overrun or unexcused missed punch.'
    };
  }

  if (overtimeHours > 0 || varianceMinutes > 30) {
    return {
      riskLevel: 'MEDIUM_RISK',
      autoApprovable: false,
      routingTarget: 'DIRECT_MANAGER',
      reason: 'Overtime hours or variance requires direct manager sign-off.'
    };
  }

  return {
    riskLevel: 'LOW_RISK',
    autoApprovable: true,
    routingTarget: 'AUTO_APPROVAL_SYSTEM',
    reason: 'Zero overtime, full attendance match, and within project budget. Verified safe for auto-approval.'
  };
}

// Export for Node / CommonJS and ES environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluateMealBreakCompliance,
    calculateWorkforceHoursAndPay,
    reconcileTimesheetWithAttendance,
    evaluateApprovalRisk
  };
}
