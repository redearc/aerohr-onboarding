-- ============================================================================
-- AeroHR: Seed Data for Local Development, Testing & Verification
-- ============================================================================

-- 1. Departments
INSERT INTO departments (id, name, code, cost_center) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Engineering', 'ENG', 'CC-ENG-100'),
    ('22222222-2222-2222-2222-222222222222', 'People Operations', 'HR', 'CC-HR-200'),
    ('33333333-3333-3333-3333-333333333333', 'Finance & Accounting', 'FIN', 'CC-FIN-300'),
    ('44444444-4444-4444-4444-444444444444', 'Product Design', 'PROD', 'CC-PROD-400')
ON CONFLICT (code) DO NOTHING;

-- 2. Roles
INSERT INTO roles (id, role_type, description) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EMPLOYEE', 'Standard employee self-service access'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'MANAGER', 'Team attendance, approvals, and performance oversight'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'HR_ADMIN', 'Onboarding management, compliance, and employee records'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'FINANCE_OPS', 'Rate card management, timesheet auditing, and invoicing'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'SUPER_ADMIN', 'Full system configuration, security keys, and audit logs')
ON CONFLICT (role_type) DO NOTHING;

-- 3. User Accounts
INSERT INTO user_accounts (id, auth_provider_id, role_id, mfa_enabled) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'auth0|alex_chen_emp', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'auth0|sarah_jenkins_mgr', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'auth0|marcus_vance_hr', 'cccccccc-cccc-cccc-cccc-cccccccccccc', TRUE),
    ('d0000000-0000-0000-0000-000000000004', 'auth0|elena_rostova_fin', 'dddddddd-dddd-dddd-dddd-dddddddddddd', TRUE)
ON CONFLICT (auth_provider_id) DO NOTHING;

-- 4. Employees
-- Sarah Jenkins (Manager)
INSERT INTO employees (id, user_account_id, employee_number, first_name, last_name, work_email, department_id, manager_id, employment_type, hire_date, status, hourly_rate, billable_rate, jurisdiction_code) VALUES
    ('b1111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000002', 'EMP-1002', 'Sarah', 'Jenkins', 'sarah.jenkins@aerohr.internal', '11111111-1111-1111-1111-111111111111', NULL, 'FULL_TIME', '2022-03-15', 'ACTIVE', 95.00, 220.00, 'US_CA')
ON CONFLICT (work_email) DO NOTHING;

-- Alex Chen (Employee, reporting to Sarah Jenkins)
INSERT INTO employees (id, user_account_id, employee_number, first_name, last_name, work_email, department_id, manager_id, employment_type, hire_date, status, hourly_rate, billable_rate, jurisdiction_code) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'EMP-1045', 'Alex', 'Chen', 'alex.chen@aerohr.internal', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'FULL_TIME', '2026-09-12', 'ACTIVE', 70.00, 150.00, 'US_CA')
ON CONFLICT (work_email) DO NOTHING;

-- Marcus Vance (HR Admin)
INSERT INTO employees (id, user_account_id, employee_number, first_name, last_name, work_email, department_id, manager_id, employment_type, hire_date, status, hourly_rate, billable_rate, jurisdiction_code) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000003', 'EMP-1010', 'Marcus', 'Vance', 'marcus.vance@aerohr.internal', '22222222-2222-2222-2222-222222222222', NULL, 'FULL_TIME', '2021-08-01', 'ACTIVE', 65.00, 0.00, 'US_CA')
ON CONFLICT (work_email) DO NOTHING;

-- Elena Rostova (Finance Ops)
INSERT INTO employees (id, user_account_id, employee_number, first_name, last_name, work_email, department_id, manager_id, employment_type, hire_date, status, hourly_rate, billable_rate, jurisdiction_code) VALUES
    ('d1111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000004', 'EMP-1015', 'Elena', 'Rostova', 'elena.rostova@aerohr.internal', '33333333-3333-3333-3333-333333333333', NULL, 'FULL_TIME', '2023-01-10', 'ACTIVE', 75.00, 0.00, 'US_CA')
ON CONFLICT (work_email) DO NOTHING;

-- 5. Clients & Projects
INSERT INTO clients (id, name, code, billing_email, payment_terms_days, default_currency, is_active) VALUES
    ('77777777-7777-7777-7777-777777777771', 'Acme Corporation', 'ACM', 'ap@acmecorp.com', 30, 'USD', TRUE),
    ('77777777-7777-7777-7777-777777777772', 'Beta Technologies', 'BETA', 'accounting@betatech.io', 30, 'USD', TRUE),
    ('77777777-7777-7777-7777-777777777773', 'Stellar AI Labs', 'STLR', 'finance@stellarai.com', 15, 'USD', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO projects (id, client_id, name, code, budget_hours, budget_amount, is_billable, is_active) VALUES
    ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'Acme Modern Frontend Portal', 'PROJ-ACM-01', 500.00, 75000.00, TRUE, TRUE),
    ('88888888-8888-8888-8888-888888888882', '77777777-7777-7777-7777-777777777772', 'Beta Mobile App Migration', 'PROJ-BETA-03', 350.00, 52500.00, TRUE, TRUE),
    ('88888888-8888-8888-8888-888888888883', '77777777-7777-7777-7777-777777777771', 'Internal Architecture & Standups', 'PROJ-INT-OPS', 1000.00, 0.00, FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 6. Timesheet for Alex Chen (Week 41)
INSERT INTO timesheets (id, employee_id, period_start_date, period_end_date, total_billable_hours, total_non_billable_hours, status, submitted_at) VALUES
    ('99999999-9999-9999-9999-999999999991', 'a1111111-1111-1111-1111-111111111111', '2026-10-05', '2026-10-11', 34.00, 6.00, 'DRAFT', NULL)
ON CONFLICT (employee_id, period_start_date) DO NOTHING;

INSERT INTO timesheet_entries (id, timesheet_id, project_id, entry_date, hours, is_billable, billing_rate_applied, task_description) VALUES
    (gen_random_uuid(), '99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888881', '2026-10-05', 4.0, TRUE, 150.00, 'Design system token implementation'),
    (gen_random_uuid(), '99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888882', '2026-10-05', 3.0, TRUE, 150.00, 'Navigation stack refactor'),
    (gen_random_uuid(), '99999999-9999-9999-9999-999999999991', '88888888-8888-8888-8888-888888888883', '2026-10-05', 1.0, FALSE, 0.00, 'Weekly team sprint planning')
ON CONFLICT DO NOTHING;

-- 7. Policy Knowledge Base for RAG Copilot
INSERT INTO policy_knowledge_embeddings (id, title, section_code, content, jurisdiction_code) VALUES
    (
        gen_random_uuid(),
        'California Meal and Rest Break Compliance',
        'POL-CA-BREAKS-01',
        'Under California Labor Code § 512, an employer must provide an unpaid, uninterrupted meal break of at least 30 minutes for shifts exceeding 5 hours, starting before the end of the 5th hour. If the employee works more than 10 hours, a second 30-minute meal break is required. Non-compliance results in 1 hour of regular pay penalty (meal break premium pay). Non-exempt employees also receive one 10-minute paid rest break for every 4 hours worked.',
        'US_CA'
    ),
    (
        gen_random_uuid(),
        'Annual Wellness & Home Office Stipend',
        'POL-BENEFITS-WELLNESS',
        'Employees are entitled to a $500 annual wellness and fitness stipend. Eligible expenses include gym memberships, yoga classes, athletic equipment, ergonomic desk accessories, and meditation apps. Claims must be submitted via AeroHR with itemized receipts within 60 days of purchase.',
        'GLOBAL'
    ),
    (
        gen_random_uuid(),
        'Timesheet Submission & Friday Lock',
        'POL-OPS-TIMESHEET',
        'All hourly and salaried billable employees must submit their weekly timesheets by Friday at 5:00 PM local time. People Managers have until Monday at 12:00 PM to review and batch-approve. Invoices and payroll are generated based exclusively on approved hours.',
        'GLOBAL'
    );
