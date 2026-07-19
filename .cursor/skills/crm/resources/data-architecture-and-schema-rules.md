# Data Architecture and Schema Rules

A CRM database must preserve truth, relationships, state history, auditability, reporting trust, and tenant isolation.

## Naming Standards

Use consistent object names:

- `contacts`, not mixed `contacts`, `people`, `persons` unless each has defined meaning.
- `accounts` or `companies`, not both unless a domain distinction exists.
- `deals` or `opportunities`, not both unless one is external mapping.
- `tickets` or `cases`, not both unless separated by service domain.
- `organization_id` or `tenant_id`, not both without a documented convention.

Use `_id` suffix for foreign keys.
Use `_at` suffix for timestamps.
Use `_date` for date-only fields.
Use boolean names starting with `is_`, `has_`, `can_`, or `requires_`.
Use reference tables for governed enums/stages/statuses instead of uncontrolled text.

## Required Constraints

Every production CRM table should be reviewed for:

- Primary key
- Tenant key where applicable
- Foreign keys
- Unique constraints
- Not-null constraints for required fields
- Check constraints for safe values
- Indexes for common filters
- Created/updated timestamps
- Created_by/updated_by where relevant
- Soft delete or archival policy
- Audit events for material changes

## Duplicate Field Detection

Search for competing concepts:

- Status: `status`, `lead_status`, `stage`, `state`, `lifecycle_stage`, `member_status`
- Owner: `owner_id`, `assigned_to`, `advisor_id`, `sales_rep_id`, `user_id`
- Dates: `start_date`, `effective_date`, `activation_date`, `enrollment_date`, `coverage_start_date`
- Money: `amount`, `monthly_amount`, `premium`, `price`, `rate`, `total`, `billing_amount`
- Names: `name`, `full_name`, `first_name`, `last_name`, `display_name`
- Organization: `org_id`, `organization_id`, `tenant_id`, `account_id`, `company_id`, `group_id`

Classify each duplicate as:

- Canonical
- Alias to migrate
- Derived value
- Legacy/deprecated
- Import staging
- External mapping
- Incorrect duplication
- Vertical-specific extension

## Wrong-Table Detection

A value may be stranded on the wrong object when:

- A date exists on an enrollment but the contact filter expects it on contacts.
- A billing amount exists on a quote but dashboard reads subscription.
- A status exists on member profile but pipeline board reads deal stage.
- A product lives on a deal but active customer view reads enrollment products.
- An owner exists on lead but converted contact has no owner lineage.

When found, do not simply copy fields. Decide the canonical object and implement lineage/migration safely.

## Custom Field Architecture

Use custom field definitions for tenant-specific fields.

Recommended tables:

- `custom_field_definitions`
- `custom_field_options`
- `custom_field_values`
- `object_layouts`
- `object_layout_sections`
- `object_layout_fields`

Rules:

- Core fields remain first-class columns.
- Custom fields are tenant-scoped.
- Data types are enforced.
- Option values use stable IDs.
- Reporting-enabled custom fields may need indexed/materialized projection.
- Custom fields cannot bypass permissions.

## Migration Safety

For schema cleanup:

1. Discover actual live usage.
2. Map canonical source of truth.
3. Add new columns/tables if needed.
4. Backfill safely.
5. Dual-read or compatibility view where needed.
6. Update API/frontend.
7. Verify reports.
8. Deprecate old field.
9. Remove only after explicit approval and retention window.

Never delete or rename production fields without proving no active dependency.

## Indexing Rules

Common CRM indexes:

- `(organization_id, created_at)`
- `(organization_id, status)`
- `(organization_id, owner_id)`
- `(organization_id, pipeline_id, stage_id)`
- `(organization_id, email)` where appropriate
- `(organization_id, external_system, external_id)`
- `(organization_id, object_type, object_id)` for activities/audit

## Reporting Architecture

Do not build reporting directly from uncontrolled UI state.

Use:

- Canonical tables for source values.
- Stable status/stage IDs.
- Analytics views for derived metrics.
- Materialized views only when refresh behavior is documented.
- Reconciliation queries for financial/conversion numbers.

## Schema Audit Prompt Pattern

```text
Audit the CRM schema read-only. Identify all tables, columns, foreign keys, RLS policies, indexes, views, RPCs, and frontend references related to [module]. Map canonical source of truth for every field. Identify duplicate/conflicting fields, wrong-table values, missing constraints, missing indexes, tenant isolation risks, and frontend/backend mismatches. Do not write migrations yet. Produce a safe migration and verification plan.
```
