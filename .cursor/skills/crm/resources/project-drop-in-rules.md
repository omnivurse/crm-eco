# Project Drop-In Rules

Paste these into a project-level AI coding rule file when building or auditing a CRM.

## CRM Master Architect Rule

When working on this project, treat it as a CRM/CRM-like SaaS platform. Before making CRM changes, classify the work as Discovery, Architecture, Build Planning, Audit/Repair, Vertical Slice Sync, Migration/Cleanup, or Production Gate.

Do not create new tables, columns, modules, statuses, custom fields, pipelines, or frontend screens until you inspect the existing source of truth.

Every CRM feature must prove:

- Canonical object ownership
- Tenant scope
- Permission model
- Database schema
- API/server action wiring
- Frontend form wiring
- Frontend display wiring
- Cache invalidation
- Workflow/state-machine rules
- Audit logging
- Reporting impact
- Tests

## Do Not Allow

- Duplicate fields for the same concept without migration plan.
- Hard-coded tenant-specific workflows in product code.
- Client-authoritative tenant IDs.
- Permissive RLS on tenant data.
- Frontend-only validation for business rules.
- Status strings as ungoverned business logic.
- Reports that read different fields than forms save.
- New custom modules when an existing object/relationship is correct.
- Production writes without explicit approval.

## Required Response for Coding Agent

For each proposed change, output:

1. Current-state discovery
2. Risk classification
3. Source-of-truth decision
4. Proposed design
5. Files/tables/APIs affected
6. Migration plan if needed
7. Frontend wiring plan
8. Permission/RLS plan
9. Audit log plan
10. Reporting impact
11. Tests
12. Rollback plan
13. Approval gate if production-impacting
