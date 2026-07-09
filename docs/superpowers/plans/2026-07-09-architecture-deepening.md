# Architecture Deepening Implementation Plan

> **For agentic workers:** Execute phases in order. Each phase must leave the repo green (typecheck/tests for touched modules). Prefer deepen-in-place over rewrites of already-deep modules (`executeCrmRecordPatch`, `SelfServeEnrollmentWizard`, `finalizeEnrollment`, `EnrollmentService`, admin `getActiveTenant`).

**Goal:** Concentrate membership lifecycle, CRM record write projection, tenant resolution, payment adapters, and enrollment completion behind deep modules with small interfaces — improving locality, leverage, and testability before client-note fixes.

**Architecture:** Additive deepenings: introduce one module interface per concern, migrate callers to thin adapters, delete shallow duplicates only after call sites move. No production schema/RLS changes in Phases 0–3. Phase 4–5 may touch billing/enrollment orchestration — dry-run and feature-flag where money moves.

**Tech Stack:** Next.js monorepo, `@crm-eco/lib`, `@crm-eco/enrollment`, Supabase, Vitest.

**Risk:** Tier 0 for Phases 0–2 (code-only). Tier 1+ for Phases 4–5 (billing/enrollment) — explicit approval before production deploy of payment wiring.

---

## File map (target)

| Concern | New / deepened module | Callers become adapters |
|---------|----------------------|-------------------------|
| Membership lifecycle | `apps/crm/src/lib/crm/membership-lifecycle/` | crons, patch, live view |
| Record field registry | `apps/crm/src/lib/crm/record-field-registry.ts` | patch, create, `useRecordFieldSave`, merge |
| Tenant | `packages/lib/src/tenant/` | crm/admin `tenant.ts` |
| Payment | `packages/lib/src/billing/adapters/authorizenet.ts` | billing-service, admin actions |
| Public enroll submit | `packages/lib/src/enrollment/submitPublicEnrollment.ts` | admin + portal submit routes |

---

## Phase 0 — Safe cleanup (shallow delete / merge)

**Goal:** Remove dead code and collapse trivial modules without changing behavior.

### Task 0.1: Remove unused Supabase middleware export

**Files:**
- Delete or deprecate: `packages/lib/src/supabase/middleware.ts`
- Modify: `packages/lib/package.json` (remove `./supabase/middleware` export)

- [x] Confirm zero imports of `@crm-eco/lib/supabase/middleware`
- [x] Remove export from `package.json`
- [x] Delete `middleware.ts` (or leave stub re-export with deprecation comment if external consumers exist — none in-repo)

### Task 0.2: Re-export coverage end-date keys from resolve-effective-end-date

**Files:**
- Modify: `apps/crm/src/lib/crm/resolve-effective-end-date.ts` (absorb constants from coverage-end-date-fields)
- Modify: `apps/crm/src/lib/crm/coverage-end-date-fields.ts` → thin re-export barrel
- Keep: `DynamicRecordForm` import path stable

- [ ] Move constants + `shouldShowEndDateFieldInSection` into `resolve-effective-end-date.ts` (or sibling `coverage-dates.ts` if file size hurts)
- [ ] Make `coverage-end-date-fields.ts` re-export only
- [ ] Run existing `resolve-effective-end-date.test.ts`

### Task 0.3: Fold live scheduled-cancel into scheduled-end-date-cancel

**Files:**
- Modify: `apps/crm/src/lib/crm/scheduled-end-date-cancel.ts` (add `applyScheduledEndDateCancelForRecordView`)
- Modify: `apps/crm/src/app/crm/r/[recordId]/page.tsx` import
- Delete: `apps/crm/src/lib/crm/scheduled-end-date-cancel-live.ts`

- [x] Move function body
- [x] Update import
- [x] Delete live file

### Task 0.4: Single source for row-column allowlist (prep for Phase 2)

**Files:**
- Create: `apps/crm/src/lib/crm/record-field-registry.ts` with `CRM_RECORD_ROW_COLUMN_KEYS`
- Modify: `record-patch-service.ts` to import keys
- Modify: `useRecordFieldSave.tsx` to import same keys

- [x] Export `CRM_RECORD_ROW_COLUMN_KEYS` (and date/uuid subsets if already duplicated)
- [x] Replace `CANONICAL_TOP_LEVEL_KEYS` / `KNOWN_ROW_COLUMNS` with shared export
- [x] No behavior change

**Phase 0 done when:** imports compile; end-date tests pass; no dead middleware export.

---

## Phase 1 — MembershipLifecycle module

**Goal:** One interface for CRM-record coverage transitions (pending→active, active→cancelled, age-65). Cron/patch/view become adapters.

### Task 1.1: Create module facade

**Files:**
- Create: `apps/crm/src/lib/crm/membership-lifecycle/index.ts`
- Create: `apps/crm/src/lib/crm/membership-lifecycle/types.ts`

**Interface (minimal):**
```ts
export type LifecycleTrigger = 'cron' | 'patch' | 'view';

export function evaluateScheduledCancel(record, today): { due: boolean; ... }
export function buildCancelUpdates(record, today): Record<string, unknown> | null
export function applyScheduledCancel(supabase, record, today): Promise<ScheduledCancelResult>
export function applyScheduledCancelOnView(recordId): Promise<...>
export function applyAge65OnView(recordId): Promise<...>
// re-export TERMINAL statuses, eligibility helpers
```

- [ ] Re-export from existing deep files (no logic move yet)
- [ ] Point cron `cancel-active-members`, patch, and record page at facade

### Task 1.2: Thin cancel cron

**Files:**
- Modify: `apps/crm/src/app/api/cron/cancel-active-members/route.ts`

- [ ] Import only from `membership-lifecycle`
- [ ] Keep pagination/auth in route (adapter)

### Task 1.3: Document crm_records vs memberships seam

**Files:**
- Create: `apps/crm/src/lib/crm/membership-lifecycle/README.md` (short)

- [ ] Note: `activate-due-memberships` (billing `memberships` table) is a **different** lifecycle — do not merge in Phase 1
- [ ] Note: `activate-pending-members` (CRM records) stays sibling; optional Task 1.4

### Task 1.4 (optional same phase): Facade for activate-pending

- [ ] Export `isEligibleForActivation` / apply helpers from `resolve-effective-start-date` via same folder
- [ ] Thin `activate-pending-members/route.ts` imports

**Phase 1 done when:** cancel cron + patch + view use facade; behavior unchanged; existing tests pass.

---

## Phase 2 — CrmRecordFieldRegistry (write projection)

**Goal:** One registry owns JSONB↔row mapping; merge/create/patch/client save consume it.

### Task 2.1: Expand registry

**Files:**
- Modify: `record-field-registry.ts`

Include:
- Row column keys + date/uuid subsets
- Keys synced from JSONB on patch (`CRM_DATA_JSONB_KEYS_SYNCED_TO_ROW_ON_PATCH` from form-defaults — import or move)
- Helper: `resolveFieldSaveTarget(field): 'row' | 'data'`

### Task 2.2: Wire merge + create + patch

**Files:**
- Modify: `merge-crm-data-json-to-row.ts` (use registry for date/uuid sets if duplicated)
- Modify: `record-create-service.ts` / `record-patch-service.ts` as needed

- [ ] Delete duplicate const blocks
- [ ] Keep merge logic deep inside merge file (registry = data, not orchestration)

### Task 2.3: Tests

- [ ] Unit test: registry target resolution for sample row vs data keys
- [ ] Existing merge + end-date tests still pass

**Phase 2 done when:** single allowlist; client + server agree on row vs data.

---

## Phase 3 — Shared TenantResolver

**Goal:** Extract shared membership-verified resolution; apps pass host-map adapters.

### Task 3.1: Package module

**Files:**
- Create: `packages/lib/src/tenant/types.ts`
- Create: `packages/lib/src/tenant/resolve-active-tenant.ts`
- Create: `packages/lib/src/tenant/index.ts`
- Export from `packages/lib/package.json`

### Task 3.2: Migrate CRM + Admin

**Files:**
- Modify: `apps/crm/src/lib/tenant.ts`
- Modify: `apps/admin/src/lib/tenant.ts`

- [ ] Shared: cookie/header names, membership verify, list tenants
- [ ] App-specific: `ROOT_DOMAINS`, Supabase client factory injection
- [ ] Portal stays separate (soft host resolve) — document only

**Phase 3 done when:** CRM + Admin call shared core; cookie `dh_active_org` unchanged.

---

## Phase 4 — PaymentProvider Authorize.Net adapter

**Goal:** Real second adapter; stop new code from importing Authorize.Net directly.

**PROD WRITE RISK: YES** for live charges — wire behind `PAYMENT_PROVIDER=authorizenet`; default remains placeholder until approved.

### Task 4.1: Adapter

**Files:**
- Create: `packages/lib/src/billing/adapters/authorizenet-payment-provider.ts`
- Modify: `payment-provider.ts` registry

- [ ] Wrap `createAuthorizeNetService` vault + charge
- [ ] Register `'authorizenet'`

### Task 4.2: Migrate admin billing actions + BillingService constructor

**Files:**
- Modify: `apps/admin/.../billing/actions.ts`
- Modify: `packages/lib/src/billing/billing-service.ts`

- [ ] Prefer `getPaymentProvider()` 
- [ ] Edge functions (`process-billing`) — **separate follow-up**; document as remaining leakage

**Phase 4 done when:** enrollment finalize + admin retry use seam; edge functions documented as Phase 4b.

---

## Phase 5 — Enrollment submit / completion unification

**Goal:** One public submit orchestrator; portal completion uses `finalizeEnrollment` when flag on.

### Task 5.1: Extract `submitPublicEnrollment`

**Files:**
- Create: `packages/lib/src/enrollment/submitPublicEnrollment.ts`
- Modify: admin + member-portal `api/enroll/submit/route.ts`

### Task 5.2: Portal authenticated submit

**Files:**
- Modify: `apps/member-portal/src/app/enroll/actions.ts`

- [ ] Replace inline `memberships.insert` with `finalizeEnrollment` when `ENROLLMENT_COMPLETION_ENABLED`
- [ ] Keep pending-approval behavior via flags

### Task 5.3: CRM wizard — document isolation (no merge this phase)

- [ ] ADR or short note: CRM advisor wizard is separate snapshot model; converge later

**Phase 5 done when:** twin submit routes share module; portal no longer forks membership insert when completion enabled.

---

## Explicitly out of scope (do not touch)

- `SelfServeEnrollmentWizard` UI rewrite
- `create_enrollment_tx` / `finalize_member_enrollment_tx` SQL redesign
- Merging billing `memberships` cron with CRM record cron (document seam only)
- Deleting deep merge / date resolution logic
- Client-note product fixes (next engagement after this plan)

---

## Execution order & commits

1. Phase 0 → commit  
2. Phase 1 → commit  
3. Phase 2 → commit  
4. Phase 3 → commit  
5. Phase 4 → commit (approval before prod env `PAYMENT_PROVIDER`)  
6. Phase 5 → commit  

Ask before each commit/push unless user already requested continuous commits.
