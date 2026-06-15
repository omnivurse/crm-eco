# DHH Wave 3 — Tenant Apps Repair Playbook

**Project key:** DHH  
**Wave:** 3 of 6 (target: Tenant Apps 68 → 100)  
**Started:** 2026-06-15  

---

## Deploy verification (2026-06-15)

| Check | Result |
|---|---|
| `https://crm.doublehelixhub.com` | HTTP 200, `server: Vercel` |
| `GET /api/crm/search?q=test` | `401 Unauthorized` (route live, auth enforced) |
| PIFH deploy gate (push `f1cb3145`) | success |
| CRM health workflow | success |
| `crm_smart_search` RPC on prod | OK (`search_path=public, extensions`) |
| Vercel MCP | 403 (CLI not authed — manual dashboard OK) |

Search fix is live on DB + deployed app.

---

## Wave 3 scorecard

| Gate | Target | Status |
|---|---|---|
| Admin API tenant guards | Service-role routes require tenant + auth | **In progress** — invoice PDF IDOR fixed |
| Portal billing | No wrong-member link on shared email | **Fixed** — billing page uses member APIs + `getMemberForUser` |
| CRM API org scoping | Explicit `org_id` / profile org on writes | Review (282 routes — RLS backstop) |
| Static API audit | Automated route classifier | ✅ `scripts/wave3-tenant-apps.mjs` |
| Admin `tenantSupabase` parity | Document CRM explicit-filter pattern | Documented (T-04) |

---

## App-layer patterns

| App | Tenant model | Guard pattern |
|---|---|---|
| **Admin** | Multi-org switcher + cookie | `requireActiveTenant()`, `tenantSupabase()`, `fromTenant()` auto-filter |
| **CRM** | Single org per staff profile | `getAuthProfile()` + `.eq('org_id', profile.organization_id)` per route |
| **Portal** | Member via profile → member | `getMemberForUser()`, `requireActiveMembership()`, RLS |
| **Website** | Public + optional auth | Landing slug → org stamp on enroll |
| **Advisor portal** | Advisor profile org | Same as CRM (small surface) |

---

## Fixes applied (Wave 3 start)

### W3-01 — Admin invoice PDF IDOR (P0)

**File:** `apps/admin/src/app/api/invoices/[id]/pdf/route.ts`

**Before:** Service role fetched any invoice by UUID — cross-tenant read.  
**After:** `requireActiveTenant()` + authenticated query with `.eq('organization_id', tenant.organizationId)`. Service role used only for edge function invoke after ownership verified.

### W3-02 — Portal shared-email member resolve (P1)

**File:** `packages/lib/src/members/memberPortal.ts`

**Before:** Email fallback used `.maybeSingle()` — fails or picks wrong member when household shares email (post-B1).  
**After:** Fetch up to 5 matches; single match wins; multiple matches disambiguate by `profile.full_name` vs member name; ambiguous → `null` (fail closed).

---

## Operator commands

```bash
# Static API route audit (no network)
node scripts/wave3-tenant-apps.mjs
node scripts/wave3-tenant-apps.mjs --json

# Prod CRM smoke (no auth — expect 401)
curl -s "https://crm.doublehelixhub.com/api/crm/search?q=Jacob"
```

### W3-03 — Portal billing via member APIs (P2)

**File:** `apps/portal/src/app/billing/page.tsx`

**Before:** Client-side Supabase queries with `(supabase as any)` for `payment_profiles` / `billing_schedules`; member resolved via `profiles.member_id` only (shared-email gap).

**After:** Loads billing data through `/api/member/*` routes backed by `requireActiveMembership()` + `getMemberForUser()`.

### W3-04 — Wave 3 audit script accuracy

**File:** `scripts/wave3-tenant-apps.mjs`

Detects `@/lib/data` delegation, `getActiveTenant`, `getAdminProfile`, and `getMemberForUser` so false-positive “review” counts drop.

---

## Remaining Wave 3 work

1. Triage remaining `review` CRM routes — explicit `org_id` on writes where RLS-only is insufficient
2. Commission write RLS (`DHH-AUDIT-008`) — admin payout approval paths (RPC-backed; verify UI)
3. Optional: shared CRM org guard helper (mirror admin `fromTenant` for `org_id` tables)

---

## Next wave

When app-layer gates are green → **Wave 4 — Frontend/backend sync** (JSONB field mapping, type regeneration).
