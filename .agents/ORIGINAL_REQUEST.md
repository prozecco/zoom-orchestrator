# Original User Request

## 2026-07-14T16:55:05Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Perform a comprehensive system review and audit of the Telegram & Zoom Automated Approval System to ensure it is usable, bug-free, and production-ready, following the `system-review` methodology.

Working directory: f:\Antigravity Projects\Zoom Meeting Management client running natively inside Telegram
Integrity mode: development

## Requirements

### R1. Full System Audit
Conduct a comprehensive review covering Architecture, Security, Database, APIs, Frontend, and Performance according to the `system-review` skill checklist.

### R2. Review Report & Checklist
Produce a detailed `system_review_report.md` artifact. It must group findings by severity (Critical, High, Medium, Low) and include an updated environment variables checklist.

### R3. Immediate Code Fixes
Implement immediate code fixes for all identified CRITICAL and HIGH severity issues (e.g., PostgreSQL transaction aborts, status NULL corruption, broken Telegram file URLs).

### R4. Automated Verification Scripts
Create a basic test suite (e.g., a Python test script using `pytest` or `requests`) to programmatically verify the core API endpoints and database integrity constraints highlighted in the review.

## Acceptance Criteria

### Audit Reporting
- [ ] `system_review_report.md` is created and contains detailed sections for Architecture, Security, Database, API, Frontend, and Performance.
- [ ] The report explicitly flags any missing environment variables and missing dependencies.

### Code Fixes & Integrity
- [ ] All code changes addressing Critical/High issues pass Python syntax checks.
- [ ] Known common bugs from the checklist (e.g. `ALTER TABLE` in `init_db()` transaction, missing `client is not None` checks in Pyrogram, `?` parameter issues in Postgres) are checked and fixed if present.

### Test Suite
- [ ] A basic automated test script is created in the repository.
- [ ] The test script can run successfully (returning exit code 0 or explicitly logging issues) to verify that endpoints are reachable and critical fixes work.
