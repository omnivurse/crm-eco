# Frontend/API/Database Synchronization Audit

A CRM build is often broken because the UI appears complete while the data layer is incomplete, duplicated, or reading the wrong source.

## Vertical Slice Checklist

For each feature, verify:

1. Database table/column exists.
2. Column is the canonical source of truth.
3. Foreign keys and constraints are correct.
4. RLS/permissions allow correct users and block incorrect users.
5. API/server action reads the correct source.
6. API/server action writes the correct source.
7. Validation exists server-side.
8. Frontend form is wired to the correct action.
9. Frontend display reads from the same canonical source.
10. Cache invalidation/refetch works after save.
11. Error handling is visible and accurate.
12. Audit event is written.
13. Reports use the same source.
14. Tests cover save, display, reload, permission, and report behavior.

## Common Sync Failures

- Form saves to `members` but dashboard reads `contacts`.
- Edit modal writes local state only.
- Autosave writes partial data but manual save writes a different payload.
- API response transforms field names inconsistently.
- Frontend uses mock/static options after backend settings exist.
- React Query/SWR cache is not invalidated after mutation.
- Server action writes successfully but RLS blocks readback.
- Report query filters a different status field than the list view.
- Pipeline board groups by `status` while detail page uses `stage_id`.
- Search RPC uses old field names.
- Import populates staging table but UI reads production table.

## Audit Output Per Field

For each high-value field, produce:

| Field | UI Location | Save Action | DB Column/Table | Read Source | Report Source | Canonical? | Problems | Fix |
|---|---|---|---|---|---|---|---|---|

## Required Tests

- Create record and verify it appears in list.
- Edit field and verify detail page after reload.
- Edit field and verify dashboard/report update.
- Verify unauthorized user cannot read/write.
- Verify tenant A cannot see tenant B.
- Verify audit log records the change.
- Verify stale cache is invalidated.
- Verify required field validation is server-side.

## Repair Pattern

When a mismatch is found:

1. Identify canonical source.
2. Update API/server action to use canonical source.
3. Update frontend forms and displays.
4. Update reports/search.
5. Add migration/backfill only if necessary.
6. Add tests.
7. Add audit log events.
8. Mark old fields deprecated if needed.
