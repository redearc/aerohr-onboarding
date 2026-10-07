"""
AeroHR AI Orchestration Service Verification Test
Tests endpoints directly against FastAPI TestClient or simulated HTTP payloads.
"""
from ai_service import (
    copilot_chat,
    scan_timesheet_anomalies,
    generate_manager_digest,
    ChatRequest,
    AnomalyScanRequest,
    TimesheetEntryModel,
    ManagerDigestRequest
)

def run_ai_service_tests():
    print("=== Running AeroHR AI Orchestration Service Tests ===\n")
    passed = 0
    failed = 0

    def assert_test(cond, msg):
        nonlocal passed, failed
        if cond:
            print(f"  ✅ PASS: {msg}")
            passed += 1
        else:
            print(f"  ❌ FAIL: {msg}")
            failed += 1

    # -------------------------------------------------------------------------
    # Test 1: Copilot Action Execution (Clock-In Intent)
    # -------------------------------------------------------------------------
    res1 = copilot_chat(ChatRequest(prompt="Please clock me in at HQ", user_role="employee"))
    assert_test(
        len(res1.action_cards) == 1 and res1.action_cards[0].action_type == "EXECUTE_PUNCH_IN",
        "Copilot extracts EXECUTE_PUNCH_IN action card from natural language"
    )

    # -------------------------------------------------------------------------
    # Test 2: Copilot Semantic Policy RAG (California Meal Break Search)
    # -------------------------------------------------------------------------
    res2 = copilot_chat(ChatRequest(prompt="What is our statutory California meal break policy?", user_role="employee"))
    assert_test(
        len(res2.citations) > 0 and "POL-CA-BREAKS-01" in res2.citations[0].policy_id,
        "Copilot returns grounded citation with policy ID POL-CA-BREAKS-01"
    )

    # -------------------------------------------------------------------------
    # Test 3: Timesheet Anomaly Detector (Clean & Auto-Approvable)
    # -------------------------------------------------------------------------
    res3 = scan_timesheet_anomalies(
        AnomalyScanRequest(
            employee_id="a1111111-1111-1111-1111-111111111111",
            period_start_date="2026-10-05",
            clocked_attendance_hours=40.0,
            timesheet_entries=[
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-05", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-06", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-07", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-08", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-09", hours=8.0, is_billable=True),
            ],
            budget_cap_hours=50.0
        )
    )
    assert_test(
        res3.is_auto_approvable is True and res3.variance_hours == 0.0,
        "Perfect 40h attendance-to-timesheet match is flagged as Auto-Approvable"
    )

    # -------------------------------------------------------------------------
    # Test 4: Timesheet Anomaly Detector (Flagged Hours Mismatch & Overtime)
    # -------------------------------------------------------------------------
    res4 = scan_timesheet_anomalies(
        AnomalyScanRequest(
            employee_id="a1111111-1111-1111-1111-111111111111",
            period_start_date="2026-10-05",
            clocked_attendance_hours=32.0, # Worked 32h
            timesheet_entries=[
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-05", hours=14.0, is_billable=True), # 14h single day!
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-06", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-07", hours=8.0, is_billable=True),
                TimesheetEntryModel(project_code="PROJ-ACM-01", date="2026-10-08", hours=8.0, is_billable=True),
            ], # Total 38h -> 6h variance vs 32h clocked!
            budget_cap_hours=50.0
        )
    )
    assert_test(
        res4.is_auto_approvable is False and any(a.anomaly_type == "ATTENDANCE_HOURS_MISMATCH" for a in res4.anomalies),
        "Detected ATTENDANCE_HOURS_MISMATCH anomaly and blocked auto-approval"
    )
    assert_test(
        any(a.anomaly_type == "EXCESSIVE_DAILY_DOUBLE_TIME" for a in res4.anomalies),
        "Detected 14.0h daily spike as EXCESSIVE_DAILY_DOUBLE_TIME"
    )

    # -------------------------------------------------------------------------
    # Test 5: Manager Digest Generation
    # -------------------------------------------------------------------------
    res5 = generate_manager_digest(
        ManagerDigestRequest(
            manager_name="Sarah Jenkins",
            team_name="Frontend Platform Team",
            total_team_members=6,
            total_hours_logged=238.0,
            billable_hours_ratio=0.88,
            pending_approvals_count=4,
            overtime_alerts_count=0
        )
    )
    assert_test(
        "Batch Approve" in res5.call_to_action and "238.0 hours" in res5.summary_markdown,
        "Generated Manager Digest with 1-click batch approval CTA"
    )

    print(f"\n=== Results: {passed} passed, {failed} failed ===")

if __name__ == "__main__":
    run_ai_service_tests()
