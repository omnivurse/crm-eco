# CRM Test Plan

Every CRM build or repair must include tests that prove the full workflow works.

## Core Test Types

### Domain Tests

- Lead conversion creates/links correct contact/account/deal.
- Stage transitions enforce required fields.
- Closed states behave as terminal when intended.
- Owner assignment follows rules.
- Product/plan selection creates correct downstream records.

### Database Tests

- Required constraints exist.
- Foreign keys prevent orphaned records.
- Unique constraints prevent duplicates where expected.
- Indexes support core list/report queries.
- Backfills are idempotent.

### RLS / Tenant Tests

- Tenant A cannot read tenant B.
- Tenant A cannot write tenant B.
- Reports are tenant-filtered.
- Search is tenant-filtered.
- Background jobs resolve tenant context.

### API Tests

- Object-level authorization.
- Field validation.
- Mass-assignment protection.
- Idempotency for imports/webhooks.
- Error responses are safe.

### Frontend Tests

- Create/save/reload works.
- Edit/save/reload works.
- List/detail/dashboard agree.
- Cache invalidation works.
- Required fields show correct errors.
- Permission restrictions are enforced in UI and API.

### Workflow Tests

- Trigger fires once.
- Conditions respected.
- Action succeeds.
- Audit event written.
- Failure is visible.
- Loop prevention works.

### Reporting Tests

- Dashboard counts reconcile with source query.
- Date filters use documented date field.
- Status/stage filters use stable IDs.
- Role/tenant filters apply.

### Import/Integration Tests

- Duplicate detection.
- Preview counts.
- Row-level errors.
- External ID mapping.
- Conflict handling.
- Webhook idempotency.
- Retry/dead-letter behavior.

## Minimum Acceptance Criteria

No CRM feature is accepted unless:

- It works after page reload.
- It works for the correct tenant only.
- It enforces permissions server-side.
- It writes audit logs for material changes.
- It appears in reports correctly or is explicitly excluded.
- It has tests for the main happy path and one failure path.
