# 20 — API Layer

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Foundation prompt.**

---

## Original Prompt (synthesized in package voice)

Standardize the **API layer**: one auth+tenant+permission wrapper for every route, consistent request validation (Zod), consistent error envelopes, rate limiting, idempotency for mutations, pagination conventions, audit hooks, and typed responses. Every endpoint documented. Webhooks (inbound/outbound) HMAC-verified.

---

## Current State

Consistent *ingredients*, inconsistent *recipe*.

- Admin: ~37 route handlers under `apps/admin/src/app/api/` (billing, commissions, cron, enroll, rates, reports, audit-logs, analytics, communications, price-changes, payouts, changes, auth, webhooks). CRM has ~296 routes under `apps/crm/src/app/api/`.
- Auth patterns are mixed: some routes use `requireAdminRole(supabase)` (`apps/admin/src/lib/auth.ts`), others inline `getActiveTenant()` + role-set checks, cron/webhooks differ again.
- Shared helpers exist: `requireAdminRole`, `getActiveTenant` (`lib/tenant.ts`), `getAdminProfile` (`lib/profile.ts`), `@crm-eco/lib/supabase/server`, `@crm-eco/lib/rate-limit`, `@crm-eco/lib/security/captcha`.
- Validation with Zod is used in places, not universally.

## Gap Analysis

| vNext area | Status |
|---|---|
| Auth/tenant helpers | Present (not uniformly applied) |
| Rate limiting | Present (`@crm-eco/lib/rate-limit`), selective |
| Single route wrapper | **Missing** |
| Zod validation everywhere | Partial |
| Consistent error envelope | Missing |
| Idempotency for mutations | Missing (also flagged in billing `05`) |
| Pagination convention | Inconsistent (ad hoc per list) |
| Audit hooks on mutations | Partial |
| Webhook HMAC | Missing |

## Build Notes

- Consolidation target (architecture review, Candidate 6): one **`withApi()` wrapper** = `{ auth, tenant, permission, validate(zod), rateLimit, audit }` composed once, applied to every route. Handlers receive a typed, authorized, validated context.
- Fold `requireAdminRole` + `getActiveTenant` + `requirePermission` (`16`) into that wrapper so there's exactly one enforcement path shared with the UI hook.
- Standardize pagination (cursor or `limit/offset`) so the shared list-view module (`02`) talks to every resource identically.
- Add idempotency-key handling for payment/mutation routes; add HMAC verification to the shared inbound webhook receiver (`09`).
