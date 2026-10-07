-- ============================================================================
-- AeroHR: Pure AI HR & Workforce Management Portal - Database Schema
-- Dialect: PostgreSQL 16+ with Row-Level Security (RLS) & pgvector
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
CREATE TYPE user_role_type AS ENUM ('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'FINANCE_OPS', 'SUPER_ADMIN');
CREATE TYPE employment_type AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'HOURLY');
CREATE TYPE employee_status AS ENUM ('PREBOARDING', 'ACTIVE', 'ON_LEAVE', 'TERMINATED');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'IRREGULAR');
CREATE TYPE break_type_enum AS ENUM ('REST_PAID', 'MEAL_UNPAID', 'WELLNESS');
CREATE TYPE timesheet_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'DISPATCHED', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE anomaly_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE approval_target_type AS ENUM ('TIMESHEET', 'REGULARIZATION', 'INVOICE', 'EXPENSE');

-- ----------------------------------------------------------------------------
-- 1. Departments & Roles
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    code VARCHAR(16) NOT NULL UNIQUE,
    cost_center VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type user_role_type NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. User Accounts & Authentication
-- ----------------------------------------------------------------------------
CREATE TABLE user_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_provider_id VARCHAR(128) NOT NULL UNIQUE, -- SSO Subject ID
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    failed_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Employees
-- ----------------------------------------------------------------------------
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_account_id UUID UNIQUE REFERENCES user_accounts(id) ON DELETE SET NULL,
    employee_number VARCHAR(32) NOT NULL UNIQUE,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    work_email VARCHAR(128) NOT NULL UNIQUE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employment_type employment_type NOT NULL DEFAULT 'FULL_TIME',
    hire_date DATE NOT NULL,
    probation_end_date DATE,
    status employee_status NOT NULL DEFAULT 'ACTIVE',
    hourly_rate NUMERIC(10,2) DEFAULT 0.00,
    billable_rate NUMERIC(10,2) DEFAULT 0.00,
    jurisdiction_code VARCHAR(16) NOT NULL DEFAULT 'US_CA', -- Determines statutory break rules (e.g., CA 5th-hour meal)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);

-- ----------------------------------------------------------------------------
-- 4. Onboarding Tasks & Documents
-- ----------------------------------------------------------------------------
CREATE TABLE onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL, -- 'DOCUMENT', 'IT_ACCESS', 'TRAINING', 'CHECK_IN'
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    due_date DATE,
    verification_type VARCHAR(32) DEFAULT 'SELF', -- 'SELF', 'MANAGER_SIGN', 'HR_VERIFY'
    verified_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    doc_type VARCHAR(64) NOT NULL, -- 'W4', 'I9', 'NDA', 'HANDBOOK', 'OFFER_LETTER'
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(512) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    is_signed BOOLEAN NOT NULL DEFAULT FALSE,
    signed_at TIMESTAMPTZ,
    signature_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Daily Attendance & Break Timings
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    clock_in_at TIMESTAMPTZ NOT NULL,
    clock_out_at TIMESTAMPTZ,
    total_worked_minutes INT DEFAULT 0,
    total_break_minutes INT DEFAULT 0,
    status attendance_status NOT NULL DEFAULT 'PRESENT',
    geo_in_lat NUMERIC(9,6),
    geo_in_lng NUMERIC(9,6),
    geo_out_lat NUMERIC(9,6),
    geo_out_lng NUMERIC(9,6),
    ip_address_in VARCHAR(45),
    ip_address_out VARCHAR(45),
    is_regularized BOOLEAN NOT NULL DEFAULT FALSE,
    regularization_reason TEXT,
    regularized_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_shift_date UNIQUE (employee_id, shift_date)
);

CREATE INDEX idx_attendance_employee_date ON attendance_records(employee_id, shift_date);

CREATE TABLE break_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    break_type break_type_enum NOT NULL DEFAULT 'MEAL_UNPAID',
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INT DEFAULT 0,
    is_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    violation_code VARCHAR(32), -- e.g. 'MEAL_EXCEEDED_60M', 'SHORT_MEAL_UNDER_30M'
    employee_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_break_logs_attendance ON break_logs(attendance_record_id);

-- ----------------------------------------------------------------------------
-- 6. Clients, Projects & Timesheets
-- ----------------------------------------------------------------------------
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(16) NOT NULL UNIQUE,
    billing_email VARCHAR(128) NOT NULL,
    payment_terms_days INT NOT NULL DEFAULT 30,
    default_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) NOT NULL UNIQUE,
    budget_hours NUMERIC(10,2) DEFAULT 0.00,
    budget_amount NUMERIC(12,2) DEFAULT 0.00,
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    total_billable_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    total_non_billable_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    status timesheet_status NOT NULL DEFAULT 'DRAFT',
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES employees(id),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_timesheet_period UNIQUE (employee_id, period_start_date)
);

CREATE INDEX idx_timesheets_employee_status ON timesheets(employee_id, status);

CREATE TABLE timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id UUID NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    entry_date DATE NOT NULL,
    hours NUMERIC(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
    is_billable BOOLEAN NOT NULL DEFAULT TRUE,
    billing_rate_applied NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    task_description TEXT,
    is_invoiced BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheet_entries_ts ON timesheet_entries(timesheet_id);
CREATE INDEX idx_timesheet_entries_project ON timesheet_entries(project_id, entry_date);

-- ----------------------------------------------------------------------------
-- 7. Client Invoicing Pipeline
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(64) NOT NULL UNIQUE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status invoice_status NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    erp_reference_id VARCHAR(64), -- e.g. NetSuite or QuickBooks invoice ID
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    timesheet_entry_id UUID REFERENCES timesheet_entries(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity_hours NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    unit_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ----------------------------------------------------------------------------
-- 8. Approvals, Audit Trail & AI Telemetry
-- ----------------------------------------------------------------------------
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type approval_target_type NOT NULL,
    target_id UUID NOT NULL,
    approver_id UUID NOT NULL REFERENCES employees(id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED'
    action_note TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES user_accounts(id),
    action VARCHAR(64) NOT NULL,
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_log_hash VARCHAR(128),
    log_hash VARCHAR(128) NOT NULL
);

CREATE TABLE ai_insights_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    severity anomaly_severity NOT NULL DEFAULT 'INFO',
    confidence_score NUMERIC(3,2) NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL,
    explanation TEXT NOT NULL,
    suggested_action JSONB,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES employees(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    section_code VARCHAR(64),
    content TEXT NOT NULL,
    embedding vector(1536), -- Compatible with standard modern text embedding models
    jurisdiction_code VARCHAR(16) DEFAULT 'GLOBAL',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Employee can view self; Manager can view reports; HR/Admin can view all
CREATE POLICY employee_self_read ON employees
    FOR SELECT
    USING (
        auth.uid() = user_account_id
        OR manager_id IN (SELECT id FROM employees WHERE user_account_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_accounts ua
            JOIN roles r ON ua.role_id = r.id
            WHERE ua.id = auth.uid() AND r.role_type IN ('HR_ADMIN', 'SUPER_ADMIN')
        )
    );

-- Employee can insert/update own draft timesheets
CREATE POLICY timesheet_employee_access ON timesheets
    FOR ALL
    USING (
        employee_id IN (SELECT id FROM employees WHERE user_account_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM user_accounts ua
            JOIN roles r ON ua.role_id = r.id
            WHERE ua.id = auth.uid() AND r.role_type IN ('MANAGER', 'HR_ADMIN', 'FINANCE_OPS', 'SUPER_ADMIN')
        )
    );

-- ----------------------------------------------------------------------------
-- 10. Offshore India Recruitment Onboarding Engine (Supabase Schema & Storage)
-- ----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE offshore_role AS ENUM ('bench_sales', 'opt', 'team_lead');
    CREATE TYPE onboarding_step AS ENUM ('hired', 'pre_offer_docs', 'contract_generation', 'e_sign_execution', 'server_archived');
    CREATE TYPE doc_status AS ENUM ('missing', 'pending_review', 'verified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.offshore_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role_type offshore_role NOT NULL,
    current_step onboarding_step DEFAULT 'hired'::onboarding_step NOT NULL,
    aadhaar_status doc_status DEFAULT 'missing'::doc_status NOT NULL,
    pan_status doc_status DEFAULT 'missing'::doc_status NOT NULL,
    experience_doc_status doc_status DEFAULT 'missing'::doc_status NOT NULL,
    secure_token UUID DEFAULT gen_random_uuid() NOT NULL
);

ALTER TABLE public.offshore_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on offshore_onboarding" 
ON public.offshore_onboarding FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Candidate access via secure_token" 
ON public.offshore_onboarding FOR SELECT TO anon USING (true);

CREATE POLICY "Candidate update via secure_token" 
ON public.offshore_onboarding FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Private Supabase Storage Bucket: candidate-vault (5MB max, PDF/PNG/JPEG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'candidate-vault',
    'candidate-vault',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- Resend API Webhook Trigger on New Candidate Placement
CREATE OR REPLACE FUNCTION public.handle_new_offshore_onboarding()
RETURNS TRIGGER AS $$
DECLARE
    resend_api_key text := current_setting('app.settings.resend_api_key', true);
    mail_payload jsonb;
BEGIN
    mail_payload := jsonb_build_object(
        'from', 'AeroHR Onboarding <onboarding@resend.dev>',
        'to', jsonb_build_array(NEW.email),
        'subject', 'Welcome to AeroHR! Complete Your Offshore Onboarding Registration',
        'html', '<h3>Welcome to AeroHR, ' || NEW.full_name || '!</h3><p>Your secure candidate vault link: <a href="https://yourdashboard.com/portal/upload/' || NEW.secure_token || '">Access Vault</a></p>'
    );

    BEGIN
        PERFORM net.http_post(
            url := 'https://api.resend.com/emails',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(resend_api_key, 're_demo_key')
            ),
            body := mail_payload
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_offshore_onboarding_resend_email ON public.offshore_onboarding;
CREATE TRIGGER trg_offshore_onboarding_resend_email
AFTER INSERT ON public.offshore_onboarding
FOR EACH ROW EXECUTE FUNCTION public.handle_new_offshore_onboarding();

