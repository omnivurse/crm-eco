# DHH Wave 2 — Tenant DB Repair Playbook

**Project key:** DHH  
**Wave:** 2 of 6 (target: Tenant DB 74 → 100)  
**Started:** 2026-06-15  
**Operator:** Cursor agent + paired review

---

## Wave 2 scorecard

| Gate | Target | Status (2026-06-15) |
|---|---|---|
| RLS coverage | 0 tables with RLS on and zero policies | ✅ 0 gaps (incl. activity_log partitions) |
| Money/PHI tables | RLS + org/user-scoped policies | ✅ 8/8 probed |
| Enrollments cross-tenant | Staff policy org-scoped | ✅ `202605300012` live |
| B1 shared email | Members visible in CRM members module | ✅ **Applied** `202606170001` — 988 backfilled |
| Reference catalog HIGH | Document accept or tighten | ✅ **Accepted** (pricing catalogs) |
| CI cross-tenant specs | Staging Layer 3 in CI | ✅ Job added (skips until `SUPABASE_TEST_*` secrets set) |
| Search RPC (`crm_smart_search`) | `similarity()` on search_path | ✅ **Fixed** `202606170002` + code fallback (2026-06-15) |

---

## Live probe results (prod read-only)

### RLS gaps

**0** public tables with RLS enabled and no policies (activity_log partitions fixed in Wave 1 `202606140008`).

### Money / PHI core tables

| Table | RLS | Policies |
|---|---|---|
| members | on | 9 |
| enrollments | on | 8 |
| billing_transactions | on | 4 |
| dependents | on | 8 |
| crm_records | on | 7 |
| profiles | on | 6 |
| payment_profiles | on | 5 |
| needs | on | 8 |

### Enrollments staff read policy

`Staff can read enrollments` includes `organization_id = private.get_user_organization_id()` unless super_admin — cross-tenant leak closed.

### B1 — shared household email (`DHH-AUDIT-006`)

| Metric | Before | After `202606170001` |
|---|---|---|
| Members missing members-module `crm_record` | **988** | **0** |
| Active shared-email family groups | 15 | 15 (expected — now each has own record) |
| Duplicate `source_id` in members module | 0 | 0 |

**Migration:** `supabase/migrations/202606170001_fix_member_sync_family_email.sql`

- Re-scopes `idx_crm_records_unique_email` to exclude members module
- Adds `crm_records_members_source_uniq` on `(org_id, module_id, source_id)`
- Fixes `sync_member_to_crm_records()` ON CONFLICT to use per-member source_id
- Fixes `sync_member_to_crm()` email match to require name (stops contact ping-pong)
- Adds `idx_crm_records_contacts_linked_member` for sync performance
- Backfill: 988 rows via `UPDATE` with contacts trigger disabled during bulk

**Rehearsal:** Rolled-back txn on prod — `UPDATE 988`, `still_invisible = 0`.

### Reference catalog `USING(true)` (Hawkeye HIGH)

| Table | Policy | Decision |
|---|---|---|
| age_bands | age_bands_public_read | **Accept** — org-agnostic pricing catalog |
| benefit_tiers | benefit_tiers_public_read | **Accept** |
| tobacco_multipliers | tobacco_multipliers_auth_read | **Accept** |
| rating_areas | rating_areas_public_read | **Accept** |
| inactive_reasons | inactive_reasons_read_all | **Accept** — public read reference |

Documented in Hawkeye as intentional; not a tenant leak (no org_id column / global reference data).

### User-scoped tables (not org-scoped — OK)

`notes`, `saved_views`, `crm_recent_views`, etc. scope by `auth.uid()` / profile — acceptable when users are org-bound via `profiles`.

---

## Operator commands

```bash
# Full probe suite
PIFH_SUPABASE_DB_URL='postgresql://...' node scripts/wave2-tenant-isolation.mjs

# B1 regression check only
PIFH_SUPABASE_DB_URL='postgresql://...' node scripts/wave2-tenant-isolation.mjs --b1

# Cross-tenant spec (staging only — never prod)
npm test --workspace=@crm-eco/lib -- cross-tenant.db.spec
```

---

## Remaining Wave 2 work

1. ~~Wire `cross-tenant.db.spec.ts` into CI~~ — job in `.github/workflows/crm-health.yml`; add GitHub secrets `SUPABASE_TEST_URL`, `SUPABASE_TEST_SERVICE_ROLE_KEY`, `SUPABASE_TEST_ANON_KEY` (staging project only) to activate
2. ~~Expand probes to top-50 tenant tables~~ — in `scripts/wave2-tenant-isolation.mjs`
3. Optional: allow second family Contact per email (explicit product decision — B2 stops ping-pong but contacts module still email-deduped)

**Wave 2 gate:** Run `node scripts/wave2-tenant-isolation.mjs` — expect B1=0, RLS gaps=(none), crm_smart_search=OK.

---

## Rollback (B1 migration)

If rollback required:

1. Revert functions from `202605300015` archive definitions
2. Drop `crm_records_members_source_uniq`; restore original `idx_crm_records_unique_email` without members exclusion
3. Manually dedupe any duplicate members-module records created for shared emails (unlikely — source_id unique)

**Watch window:** 24h — monitor CRM members list load, member search by email, lead convert paths.

---

## Next wave

When scorecard gates are green → **Wave 3 — Tenant Apps** (app-layer isolation, API route audits).
