# Enrollment test harness

Layered test strategy for the enrollment correctness/hardening pilot. The
prioritized defect backlog these tests defend against lives in agent memory as
`enrollment-hardening-backlog`.

## Layer 1 — Pure unit / characterization ✅ (this folder)

Hermetic, no DB, no network. Run with:

```bash
npm run test --workspace=@crm-eco/lib
```

- `warnings.test.ts` — mandate-state + age-65 eligibility flags (fake timers).
- `rxPricing.test.ts` — deterministic mock pricing + `validateMedications`
  (Gemini client mocked).
- `enrollment-service.test.ts` — state-machine guards + RPC payload mapping
  (Supabase + audit mocked). Locks the `baseMonthlyCoat` typo for a safe rename.

These assert **current** behavior so the hardening fixes can refactor safely.

## Layer 2 — DB integration ⏳ (gated on a staging Supabase project)

Run against a disposable staging DB seeded from a prod backup. Targets:
- `create_enrollment_tx` atomicity + **idempotency** (backlog C1).
- Member **dedup** on (email, organization_id) (backlog C2).
- Billing-schedule + signup-commission **trigger idempotency** (`202605210005`).
- Payment-webhook **double-charge** guard (backlog H5).

## Layer 3 — RLS / tenant isolation ⏳ (gated on staging)

- Anonymous visitor **cannot** write core enrollment tables; public link
  tracking only via the intended `track_link_visit` path (backlog C3).
- Cross-tenant read/write isolation on every enrollment table.

## Layer 4 — End-to-end (Playwright) ⏳

Full wizard per entry point (`apps/website` public + `[slug]`, `apps/portal`,
`apps/crm`): happy path, resume, **double-submit**, payment failure, partial-
failure recovery. Extends the existing `tests/playwright/` harness.

> Layers 2–4 are intentionally **not** wired to production. They require the
> staging environment + the open decisions (canonical payment processor,
> whether anonymous self-enroll is supported, pilot tenant).
