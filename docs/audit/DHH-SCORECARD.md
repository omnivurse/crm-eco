# DHH Scorecard — Path to 100

**Project:** CRM ECO / DoubleHelixHub  
**Baseline audit:** [DHH-LOGIC-AUDIT-2026-06-15.md](./DHH-LOGIC-AUDIT-2026-06-15.md)  
**Updated:** 2026-06-13  

Six repair waves map to the six audit dimensions. **100** means every gate below is checked green and documented.

---

## Score tracker

| Dimension | Baseline | Current (est.) | Wave | Target gate |
|---|---:|---:|---|---|
| Production safety | 55 | **~95** | 1 | 0 BLOCKERs, ledger synced, secrets rotated, Hawkeye ≤7d |
| Tenant isolation (DB) | 74 | **~92** | 2 | B1=0, RLS gaps=0, cross-tenant probes pass |
| Tenant isolation (apps) | 68 | **~78** | 3 | 0 high-risk API routes, money/PHI writes org-scoped |
| Frontend/backend sync | 58 | **~72** | 4 | 0 BLOCKERs; fragile embeds fixed; types regen pending |
| Critical workflows | 64 | **~72** | 5 | Cron + automation live, commissions writable, lead convert idempotent |
| Architecture | 62 | **62** | 6 | Duplicate systems documented or retired (long horizon) |

---

## Wave 1 — Production Safety → 100

| Gate | Status |
|---|---|
| `.env.vercel` untracked, keys rotated | ✅ |
| Migration ledger synced (23/23) | ✅ |
| Duplicate timestamp `202606140002` fixed | ✅ |
| Hawkeye schema refresh ≤7 days | ⚠️ Refresh on each release |
| PITR / backup documented | ⚠️ Manual ops confirmation |

**Remaining:** Periodic Hawkeye refresh in CI; optional git history purge for old keys (`DHH-AUDIT-005` follow-up).

---

## Wave 2 — Tenant DB → 100

| Gate | Status |
|---|---|
| RLS enabled, 0 tables with zero policies | ✅ |
| B1 shared-email invisible members = 0 | ✅ |
| `crm_smart_search` RPC healthy | ✅ |
| Cross-tenant CI specs | ⚠️ Skips until `SUPABASE_TEST_*` secrets set |
| Reference catalog `USING(true)` | ⚠️ Accepted risk (`DHH-AUDIT-009`) |

**Remaining:** Enable staging cross-tenant CI (`DHH-AUDIT-013`); document accepted global rate tables.

---

## Wave 3 — Tenant Apps → 100

| Gate | Status |
|---|---|
| High-risk API routes (service role, no auth) | ✅ 0 |
| Admin invoice PDF IDOR | ✅ |
| Portal `getMemberForUser` shared-email | ✅ |
| Portal billing via member APIs | ✅ (`DHH-AUDIT-011`) |
| CRM money routes explicit org check | 🔄 In progress |
| Review routes (RLS-only CRM reads) | 91 — document or add `org_id` |

**Remaining:** Org guard on commission payout execute/approve; triage CRM review routes.

Run: `node scripts/wave3-tenant-apps.mjs`

---

## Wave 4 — Frontend/Backend Sync → 100

| Gate | Status |
|---|---|
| Hawkeye BLOCKERs | ✅ Cleared (001, 002) — re-verify after schema refresh |
| Generated types match prod | ⚠️ Regenerate after each migration batch |
| Portal/admin `(supabase as any)` on billing tables | ✅ Portal billing fixed |
| Fragile PostgREST embeds | Open (`DHH-AUDIT-014`) |
| JSONB ↔ indexed column bridges | 🔄 Leads/contacts/insurance bridges added |

**Remaining:** Fix pricing/needs embeds; regen types; Hawkeye baseline refresh.

---

## Wave 5 — Critical Workflows → 100

| Gate | Status |
|---|---|
| Lead → contact conversion | ✅ RPC + idempotent UI |
| Lead → member conversion | ✅ |
| `/api/automation/cron` scheduled | 🔄 This sprint |
| Commission payout INSERT/UPDATE RLS | 🔄 Migration prepared |
| Automation cron auth fail-closed | 🔄 This sprint |
| Dependent coverage periods | ✅ |

**Remaining:** Schedule automation cron; apply commission RLS migration (prod approval).

---

## Wave 6 — Architecture → 100

Long-horizon consolidation (duplicate commission ledgers, automation stacks, template stores). **Not blocking pilot ops.** Track in product audit carry-forward; score rises as subsystems merge or retire.

---

## Open issue register (quick ref)

| ID | Priority | Status |
|---|---|---|
| DHH-AUDIT-007 | P1 | 🔄 Automation cron schedule |
| DHH-AUDIT-008 | P1 | 🔄 Commission write RLS |
| DHH-AUDIT-009 | P2 | Accepted (document) |
| DHH-AUDIT-010 | P2 | Activity log partition policies |
| DHH-AUDIT-012 | P3 | org_id strangler |
| DHH-AUDIT-013 | P3 | CI cross-tenant secrets |
| DHH-AUDIT-014 | P2 | Fragile embeds |
| DHH-AUDIT-015 | P3 | FK covering indexes (migration ready) |

Full detail: [DHH-ISSUE-REGISTER.md](./DHH-ISSUE-REGISTER.md)

---

## Operator rhythm

```bash
# Wave 1
node scripts/wave1-production-safety.mjs --pending

# Wave 2 (needs PIFH_SUPABASE_DB_URL)
node scripts/wave2-tenant-isolation.mjs

# Wave 3 (static)
node scripts/wave3-tenant-apps.mjs

# Hawkeye (needs DB URL)
.audit/scripts/refresh-schema.sh && node .audit/scripts/crossref.mjs
```

**Prod writes** (migrations, backfills): rehearsal → explicit approval → apply → verify → watch window.
