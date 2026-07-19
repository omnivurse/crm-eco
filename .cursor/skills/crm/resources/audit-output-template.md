# CRM Audit Output Template

Use this format for auditing an existing CRM build.

## 1. Executive Verdict

- Overall status: APPROVED / APPROVED WITH CONDITIONS / NOT APPROVED
- CRM maturity score: 0-100
- SaaS readiness score: 0-100
- Production risk: LOW / MEDIUM / HIGH / CRITICAL
- Top 5 risks

## 2. Current-State Map

Document what exists today:

- Modules
- Routes/pages
- Database tables
- API/server actions
- Workflows/automations
- Permissions/RLS
- Reports/dashboards
- Integrations
- Admin settings

## 3. Intended CRM Model

State what the CRM should be:

- Primary customer object
- Lead model
- Account/company/household model
- Deal/opportunity model
- Service/ticket model
- Product/enrollment/subscription model
- Activity/timeline model
- Tenant/configuration model

## 4. Module Findings

For each module:

| Module | Current Status | Correct CRM Role | What Works | What Is Broken | Required Fix |
|---|---|---|---|---|---|

## 5. Source-of-Truth Findings

| Business Concept | Current Locations | Canonical Source | Conflict | Fix |
|---|---|---|---|---|

## 6. Duplicate Field Findings

| Duplicate Concept | Fields/Tables | Classification | Risk | Migration/Fix |
|---|---|---|---|---|

## 7. Vertical Slice Findings

| Feature | DB | RLS | API | Frontend Save | Frontend Read | Cache | Audit | Report | Tests | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|

## 8. Workflow/State-Machine Findings

| Process | States | Transitions | Required Fields | Automation | Audit | Problems | Fix |
|---|---|---|---|---|---|---|---|

## 9. Permissions/Tenant Findings

- Tenant isolation issues
- RLS risks
- Role/team visibility risks
- Field-level permissions
- Admin access risks
- Export/import risks

## 10. Reporting Findings

- Metric definitions
- Source tables
- Reconciliation issues
- Dashboard mismatches
- Date/status inconsistencies

## 11. Critical Breakpoints

List anything that can cause data corruption, tenant leakage, broken workflows, or incorrect reporting.

## 12. Required Fix Plan

Prioritize:

- P0 critical fixes
- P1 major fixes
- P2 important improvements
- P3 optional refinements

## 13. Safe Implementation Plan

For each fix:

- Discovery step
- Design
- Migration/backfill if needed
- Code changes
- Tests
- Verification
- Rollback

## 14. Acceptance Criteria

Define exact pass/fail criteria.

## 15. Final Verdict

One of:

- APPROVED
- APPROVED WITH CONDITIONS
- NOT APPROVED

Include why.
