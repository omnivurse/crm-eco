# DHH Wave 4 — Frontend/Backend Sync Repair Playbook

**Project key:** DHH  
**Wave:** 4 of 6 (target: Frontend/backend sync 58 → 100)  
**Started:** 2026-06-13  
**Live CRM constraint:** Read-only discovery first; code-only fixes; no prod schema writes during business hours unless approved.

---

## Wave 4 scorecard

| Gate | Target | Status |
|---|---|---|
| Hawkeye BLOCKERs | 0 | ✅ 0 (2026-06-13 refresh) |
| Hawkeye new HIGH | 0 | ✅ 0 at fail threshold |
| Fragile PostgREST embeds | Replace with FK-safe or batch fetch | 🔄 In progress |
| Types vs prod schema | Regenerate after migration batches | Ongoing |
| `(supabase as any)` on money paths | Remove | Portal billing ✅ |

---

## Operator commands (read-only safe)

```bash
# 1. Refresh schema from live PIFH (READ ONLY)
export PIFH_SUPABASE_DB_URL='postgresql://...'
.audit/scripts/refresh-schema.sh

# 2. Inventory + crossref (no network)
node .audit/scripts/inventory.mjs
node .audit/scripts/crossref.mjs
node .audit/scripts/check-baseline.mjs

# 3. After fixes land, refresh baseline in same PR
AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs
```

---

## Fixes applied (Wave 4 start)

### W4-01 — Needs list embed (`DHH-AUDIT-014`)

**File:** `apps/crm/src/app/crm/needs/page.tsx`

**Before:** `crm_records!needs_member_id_fkey` — wrong target table (FK is `needs → members`).  
**After:** Flat `needs` query + batch `members` / `profiles` fetch (same pattern as command-center).

### W4-02 — Pricing estimate embed

**File:** `apps/crm/src/app/api/pricing/estimate/route.ts`

**Before:** `crm_records` + `members(state)` embed (no FK).  
**After:** `crm_records` only; `member_state` from JSONB `data`.

### W4-03 — Auth events / profiles embed

**File:** `apps/crm/src/lib/security/audit.ts`

**Before:** `profiles!auth_events_user_id_fkey` (FK is to `auth.users`).  
**After:** Fetch `auth_events`, then batch `profiles` by `user_id`.

---

## Remaining Wave 4 work

1. Regenerate `packages/lib/src/types/database.ts` from prod (when convenient — large diff)
2. Remove remaining `(supabase as any)` in admin commission paths
3. Accept + baseline document reference-catalog `USING(true)` policies (`DHH-AUDIT-009`)
4. Optional: `202606150001` FK indexes — performance, not sync (separate approval)

---

## Live CRM safety rules

- **No** prod DDL during active client sessions without approval
- **Prefer** batch-fetch over PostgREST embed hints
- **Verify** with Hawkeye crossref before merge
- **Deploy** during low-traffic window when changing query shapes on hot paths

---

## Next wave

When Hawkeye embed MEDIUMs are cleared and baseline refreshed → continue Wave 3 org guards + Wave 5 workflow verification.
