# CRM Build Output Template

Use this format when designing a new CRM capability or module.

## 1. Objective

What business problem does this solve?

## 2. Users and Roles

Who uses this?

- Admin
- Manager
- Rep/advisor/agent
- Support/enrollment specialist
- Billing user
- Analyst
- External user if any

## 3. Objects and Source of Truth

| Object | Purpose | Canonical Table | Relationships | Notes |
|---|---|---|---|---|

## 4. Data Model

Include:

- Tables
- Columns
- Foreign keys
- Unique constraints
- Indexes
- Tenant keys
- Audit fields
- Custom field support if needed

## 5. Lifecycle / Pipeline

| State/Stage | Meaning | Entry Criteria | Required Fields | Allowed Next | Automation | Terminal |
|---|---|---|---|---|---|---|

## 6. Workflows and Automations

For each workflow:

- Trigger
- Conditions
- Actions
- Idempotency
- Audit event
- Failure behavior

## 7. Permissions

| Role | Create | Read | Update | Delete | Export | Configure | Notes |
|---|---|---|---|---|---|---|---|

## 8. UI / UX

Define:

- Navigation
- List views
- Detail page
- Create/edit forms
- Kanban/pipeline board
- Timeline
- Filters/search
- Bulk actions
- Admin settings

## 9. API / Server Actions

Define:

- Read endpoints/actions
- Create/update endpoints/actions
- Validation
- Authorization
- Error handling
- Idempotency
- Rate limits where needed

## 10. Reporting

Define:

- Dashboards
- Metrics
- Source tables
- Reconciliation queries
- Date fields
- Permission filters

## 11. Integrations

Define:

- External systems
- Object mappings
- Field mappings
- Sync direction
- Conflict rules
- Webhooks
- Error handling

## 12. Audit Logging

Define material actions and exact audit events.

## 13. Tests

Include:

- Unit tests
- Integration tests
- RLS/tenant tests
- UI tests
- Workflow tests
- Reporting reconciliation tests
- Import/sync tests if applicable

## 14. Migration Plan

If touching existing data:

- Discovery
- Additive migration
- Backfill
- Dual-read if needed
- Verification
- Deprecation
- Rollback

## 15. Release Plan

- Feature flag
- Staging verification
- Pilot tenant/user
- Monitoring
- Rollback
- Final approval gate
