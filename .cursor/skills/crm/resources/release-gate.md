# CRM Release Gate

Use before deploying CRM changes.

## Gate 1: Scope

- What modules changed?
- What tables/columns changed?
- What API/server actions changed?
- What workflows changed?
- What reports changed?
- What permissions changed?
- What integrations changed?

## Gate 2: Data Integrity

- Source of truth confirmed.
- Duplicate fields addressed.
- Migrations tested.
- Backfills idempotent.
- No orphaned records.
- Reports reconcile.

## Gate 3: Tenant and Security

- RLS verified.
- No permissive tenant policies.
- Server-side authorization verified.
- Role/team access tested.
- Export/import permissions tested.
- Sensitive actions audited.

## Gate 4: Frontend/API Sync

- Forms write correct fields.
- Displays read correct fields.
- Cache invalidation works.
- Dashboard/list/detail agree.
- Error states tested.

## Gate 5: Workflow

- State transitions verified.
- Automations idempotent.
- Required fields enforced server-side.
- Notifications and tasks not duplicated.
- Failure path visible.

## Gate 6: Observability

- Audit events written.
- Errors logged safely.
- Sync/import failures visible.
- Critical metrics monitored.

## Gate 7: Rollback

- Rollback path documented.
- Feature flag available where appropriate.
- Data rollback/compensation plan exists.
- Support/admin communication prepared.

## Verdict

Only approve release when:

- P0 issues = 0
- P1 issues have owner and explicit approval
- Tenant isolation tests pass
- Reporting reconciliation passes
- No destructive production change is pending without explicit approval
