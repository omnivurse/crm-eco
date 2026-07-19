# Diagnostics: What Is Wrong in This CRM Build?

Use this checklist when asked to inspect an existing CRM and explain what is broken.

## Architecture Smells

- CRM is organized around pages instead of domain objects.
- New module creates new person/customer tables instead of reusing canonical contact/account.
- Business processes are hard-coded in components.
- Status strings drive critical workflow logic.
- Tenant-specific logic is committed directly into product code.
- No clear distinction between sales, service, enrollment, billing, and customer lifecycle.

## Data Model Smells

- Duplicate columns with overlapping meaning.
- Foreign keys missing between related modules.
- No assignment/ownership history.
- No activity timeline.
- No audit log.
- No import batch tracking.
- Custom fields added as random columns instead of governed definitions.
- Products/plans/prices stored as raw text.
- Dates with unclear meaning.
- Financial amounts stored in multiple places.

## Workflow Smells

- Stages can be skipped without rules.
- Required fields are enforced only in frontend.
- Closed/lost/won/active states are not terminal or protected.
- No clear conversion from lead to contact/account/deal/enrollment.
- Support cases have no SLA or escalation path.
- Automations create duplicates.
- Approval workflows are not auditable.

## Frontend Smells

- UI contains options not present in settings tables.
- Detail page and list page disagree.
- Save succeeds but reload loses data.
- Dashboard counts differ from table counts.
- Search finds data that filters do not.
- Edit modal has fields that do not exist in database.
- Admin settings update but user forms ignore them.

## API Smells

- Endpoints return too much data.
- Object-level authorization missing.
- API trusts client tenant ID.
- Search endpoints bypass normal permissions.
- Mutation endpoints accept mass-assignment payloads.
- Error messages leak internal details.
- No idempotency for imports/webhooks.

## Security/Tenant Smells

- No tenant key on core tables.
- RLS missing or permissive.
- Admin screens use service role without explicit authorization.
- Reports aggregate across tenants.
- Files/documents are shared by guessable URLs.
- External webhook can write without signature verification.

## Reporting Smells

- Reports read from denormalized fields with no refresh policy.
- Conversion rates cannot be reproduced from source records.
- Revenue totals do not reconcile with orders/subscriptions/enrollments.
- Pipeline amounts differ from dashboard amounts.
- Date filters use inconsistent date fields.
- Team performance reports ignore reassignment history.

## Integration Smells

- External IDs are not unique per tenant/system.
- Sync has no conflict strategy.
- Webhooks are not idempotent.
- Failed syncs disappear silently.
- External CRM field mapping is hard-coded.
- Integration credentials are not tenant-scoped.

## Production Smells

- No rollback plan.
- No seed/test data for lifecycle paths.
- No tenant isolation tests.
- No audit log tests.
- No import rollback/merge plan.
- No staging verification.
- Migrations rename/drop fields without dependency scan.

## Root-Cause Classification

When diagnosing a problem, classify it as one or more of:

- Domain model error
- Wrong source of truth
- Duplicate field drift
- Frontend/backend mismatch
- Permission/RLS issue
- Workflow/state-machine gap
- Reporting query mismatch
- Import/dedupe flaw
- Integration sync conflict
- Cache invalidation issue
- Missing migration/backfill
- Tenant configuration gap
- Production safety risk
