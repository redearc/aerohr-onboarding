# AeroHR — Pure AI Workforce Operating System

> **A modern, AI-first employee self-service and workforce-management portal for mid-size companies (100–2,500 employees).**

Built around the core philosophy that self-service should be the fastest path to completing HR tasks, not just submitting forms.

---

## 📁 Repository Structure

* **[`AI_HR_PORTAL_PRODUCT_PLAN.md`](./AI_HR_PORTAL_PRODUCT_PLAN.md)**: The complete 16-section strategic product plan, covering product vision, core modules, AI capabilities, 4-zone UX design, user journeys, role matrices, system architecture, workflow engine, analytics, compliance, and a 16-week delivery roadmap.
* **[`index.html`](./index.html)**: Interactive, standalone Single Page Application prototype implementing the 4-zone dashboard, role switching across 4 personas, live shift punch clock, California break compliance timers, weekly timesheet allocation grid, onboarding e-sign hub, client invoicing pipeline, and ambient Aero Copilot.
* **[`ai_service.py`](./ai_service.py)**: Python FastAPI AI Orchestration Microservice providing semantic policy RAG with citations, real-time timesheet anomaly detection, function-calling action routers, and manager executive digests.
* **[`test_ai_service.py`](./test_ai_service.py)**: Automated verification tests for the AI orchestration service.
* **[`rules_engine.js`](./rules_engine.js)**: Deterministic Compliance & Labor Rules Engine implementing California Labor Code § 512 meal/rest break rules, statutory penalty calculations, FLSA daily/weekly overtime multipliers, attendance vs. timesheet discrepancy detection, and auto-approval risk scoring.
* **[`test_rules_engine.js`](./test_rules_engine.js)**: Test verification suite for statutory labor rules and calculations.
* **[`schema.sql`](./schema.sql)**: Production PostgreSQL 16 schema featuring Row-Level Security (RLS) policies, enums, relational foreign keys, cryptographic audit tables, and `pgvector` policy embeddings.
* **[`seed.sql`](./seed.sql)**: Realistic database seed data covering departments, roles, employee records, active client projects, timesheets, and HR policy knowledge chunks for RAG.
* **[`docker-compose.yml`](./docker-compose.yml)**: Multi-container setup orchestrating PostgreSQL 16 (with pgvector), Redis 7, backend API, and Python AI microservices.
* **[`Dockerfile.ai`](./Dockerfile.ai)** & **[`requirements.txt`](./requirements.txt)**: Container build configurations for the AI microservice.
* **[`api-specs.yaml`](./api-specs.yaml)**: OpenAPI 3.1 specification for all attendance, break, timesheet, invoice, and AI orchestration endpoints.

---

## 🚀 How to Run the Interactive Web Prototype

Because `index.html` is completely self-contained with modern CSS and vanilla ES6 JavaScript, you can open and run it immediately in your browser:

### Option 1: macOS Terminal Command
```bash
open index.html
```

### Option 2: Double-Click in Finder
Simply double-click [`index.html`](./index.html) in your macOS Finder window to launch it in Google Chrome, Safari, or your default browser.

---

## 💡 Five Core Jobs Handled in the Workspace

1. **New Employee Onboarding**: Guided milestone progression, identity verification, cryptographic document e-signing (W-4, I-9), and IT provisioning.
2. **Daily Attendance**: 1-tap clock-in/clock-out, live shift duration timer, and soft geo/device verification.
3. **Employee Break Timings**: 15m paid rest and 30m/60m unpaid meal break tracking, live countdown timers, and statutory threshold compliance warnings (e.g., California 5th-hour meal break rule).
4. **Timesheet Submission**: Project & client allocation grid, AI calendar sync pre-fill, overtime detection, and Friday 1-click submission.
5. **Client Invoicing**: Automatic conversion of approved timesheets into draft client invoices with rate card calculation, line-item auditing, and ERP export.

---

## 🤖 The 4-Zone Role-Aware Dashboard

* **Zone 1 (Pending Actions)**: SLA countdown badges and high-priority items requiring immediate input.
* **Zone 2 (In-Progress Items)**: Live shift clock, active break countdown, and weekly hours progress meter.
* **Zone 3 (Recommended Tasks)**: Proactive AI nudges, calendar event imports, and milestone syncs.
* **Zone 4 (Ambient AI Copilot)**: Global `Cmd+K` command panel with natural-language execution privileges and RAG policy retrieval.
