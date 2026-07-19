# Audit Severity Model

## P0 / Critical

Blocks production or SaaS rollout.

Examples:

- Cross-tenant data exposure.
- Missing RLS on tenant data.
- Production destructive migration without approval.
- Frontend writes to wrong tenant/object.
- Financial or enrollment reports materially wrong.
- Authentication/authorization bypass.

## P1 / High

Must fix before broad release.

Examples:

- Duplicate source-of-truth fields causing inconsistent records.
- Required business rules enforced only in frontend.
- Workflow automations create duplicates.
- Lead conversion creates duplicate contacts.
- Reports do not reconcile.
- Admin settings ignored by product UI.

## P2 / Medium

Should fix before scale.

Examples:

- Missing indexes for key list/report queries.
- Weak data quality dashboard.
- Incomplete audit details.
- Manual-only configuration that should be tenant configurable.
- Sync failures not surfaced well.

## P3 / Low

Improvement or polish.

Examples:

- UI labels inconsistent.
- Better empty states needed.
- Additional saved views.
- More dashboard filters.

## Informational

Context, future consideration, or documentation issue.
