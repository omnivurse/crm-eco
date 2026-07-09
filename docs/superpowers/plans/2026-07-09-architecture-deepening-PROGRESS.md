# Architecture Deepening — Progress

Updated: 2026-07-09

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Safe cleanup | **Done** | Deleted unused supabase middleware; folded live cancel; field registry started |
| 1 MembershipLifecycle | **Done** | Facade + cron/patch/view wired; README documents memberships seam |
| 2 Field registry | **Done** | Shared row/date/uuid keys; patch + hook + merge consume registry |
| 3 TenantResolver | **Partial** | Shared cookie/header constants exported; full CRM/Admin merge deferred |
| 4 PaymentProvider Auth.Net | **Done (app path)** | Adapter registered; admin retry uses seam; BillingService + edge fns remain Phase 4b |
| 5 Enroll submit unify | **Stub** | Flag helper + docs; full route extract deferred (money path) |

**Prod note:** Set `PAYMENT_PROVIDER=authorizenet` only after sandbox verification. Default remains `placeholder`.
