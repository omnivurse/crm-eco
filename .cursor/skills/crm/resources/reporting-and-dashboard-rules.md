# Reporting and Dashboard Rules

CRM reporting must reconcile to canonical source data.

## Reporting Principles

- Every metric must have a definition.
- Every metric must identify source tables and fields.
- Date filters must specify which date is used.
- Status/stage filters must use stable IDs, not labels alone.
- Reports must respect tenant and permission scope.
- Financial metrics must reconcile to canonical commercial objects.
- Counts should be reproducible by query.

## Core CRM Reports

### Sales Reports

- Leads by source/status/owner
- Speed to lead
- Lead conversion rate
- Pipeline by stage
- Pipeline by owner/team
- Forecast by period/category
- Won/lost deals
- Lost reasons
- Activity by rep
- Revenue by product/source

### Service Reports

- Open tickets by status/priority
- SLA breaches
- Average time to first response
- Average time to resolution
- Tickets by category
- Escalations
- Customer satisfaction

### Enrollment/Subscription Reports

- Applications/enrollments by status
- Effective dates
- Product/plan distribution
- Active/inactive/cancelled counts
- Renewal/cancellation trends
- Billing exceptions

### Data Quality Reports

- Duplicate contacts/accounts
- Missing required fields
- Invalid email/phone
- Records without owner
- Records stuck in stage
- Orphaned records
- Failed imports
- Failed syncs

### Admin/Security Reports

- User activity
- Permission changes
- Exports
- Bulk updates
- Integration failures
- Cross-tenant access denials
- Audit log anomalies

## Metric Definition Template

For each dashboard metric:

- Name
- Business meaning
- Source table(s)
- Source field(s)
- Filters
- Date field
- Grouping
- Permission scope
- Refresh cadence
- Reconciliation query
- Known exclusions

## Dashboard Anti-Patterns

- Dashboard numbers built from frontend state.
- Different screens use different date fields.
- Stage labels used instead of stage IDs.
- Tenant filters applied in UI only.
- Reports exclude records silently.
- Revenue uses quote amount when closed-won order amount exists.
- Active customer count uses contact status instead of active subscription/enrollment.

## Reconciliation Requirement

For every critical report, provide a reconciliation query or equivalent test.

Example:

```text
The active enrollment count must equal the count of enrollments where organization_id = current tenant, status = active, effective_date <= today, and cancellation_date is null or future. It must not be derived from contact.status unless contact.status is a documented denormalized projection of enrollment state.
```
