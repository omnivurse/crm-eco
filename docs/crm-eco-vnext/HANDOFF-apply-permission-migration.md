# HANDOFF — Apply permission migration (other machine)

**When you pick this up on the other machine, do this first.**

## Migration to apply

```
supabase/migrations/202607220001_has_org_permission.sql
```

What it adds (additive only — no data loss):

- Seeds `payables.read|create|approve|pay` into `crm_permissions`
- Creates `has_org_permission(org_id, key)`
- Creates `list_org_permissions(org_id)`
- Legacy org-role bridge so owners/admins keep full access

## Apply (PIF project)

1. Pull latest `main`
2. Confirm linked to the correct Supabase project (`sffisarikcreyyjzdjvb` / PIF)
3. Apply **only after you intend to write to that DB**:

```bash
supabase db push
# or, if ordering warns:
supabase db push --include-all
```

4. Smoke-check as an authenticated admin:

```sql
select public.list_org_permissions('<active-org-uuid>');
select public.has_org_permission('<active-org-uuid>', 'payables.approve');
```

## Important

- **Do not skip** if you want the RPC to be source of truth for `/api/permissions/me`.
- Until applied, the app still works via the **TypeScript org-role bridge** (fallback).
- Rollback notes are at the bottom of the migration file.

## Related code already on main after this commit

- `@crm-eco/ui/data-table` + payables pilot
- `@crm-eco/lib/permissions` + admin `PermissionsProvider`
- Specs: `docs/crm-eco-vnext/`, ADRs `0001` / `0002`
