# DHH Logic Audit — Phase 1, 2 & 5

**Project:** CRM ECO / DoubleHelixHub  
**Project key:** `DHH`  
**Date:** 2026-06-15  
**Auditor mode:** Read-only (no file, schema, or production data changes)  
**Scope:** All 6 apps + shared packages  

---

## Executive Summary

This is the first execution of the scoped DHH audit (Phases 1, 2, 5, 7). It combines:

- Fresh **Hawkeye** code inventory (2026-06-15)
- Schema snapshot from `.audit/schema/` (PIFH prod, frozen **2026-05-22**)
- Static workflow tracing for 10 critical flows
- Prior product audit cross-reference ([CRM-ECO-Product-Audit-2026-06-01.md](./CRM-ECO-Product-Audit-2026-06-01.md))

### Overall health (this pass)

| Dimension | Score | Notes |
|---|---:|---|
| Architecture | **62/100** | Strong generic `crm_records` engine; duplicate subsystems remain |
| Tenant isolation (DB) | **74/100** | RLS on ~354 tables; org-scoped core; legacy `org_id` duality |
| Tenant isolation (apps) | **68/100** | Admin org-switch is solid; CRM is single-org profile; portal relies on RLS |
| Frontend/backend sync | **58/100** | 2 Hawkeye BLOCKERs; JSONB custom fields add drift risk |
| Critical workflows | **64/100** | Lead create/convert/patch are well-guarded; portal billing has schema drift |
| Production safety | **55/100** | 22 unapplied repo migrations; schema snapshot stale vs code |

**Verdict:** Safe to continue feature work **after** resolving the two BLOCKER drift items and refreshing the live schema snapshot. The platform is a capable multi-tenant CRM pilot with real DB isolation, but not yet a fully productized white-label SaaS.

### Method limits

- **No live DB refresh** — `PIFH_SUPABASE_DB_URL` not available in this session. Tenant matrix and Hawkeye cross-ref use the May 22 schema dump.
- **Phase 3 (field-by-field) and Phase 4 (modal lifecycle)** deferred to a follow-up module sprint.
- **Olyron Core** explicitly excluded per client scope.

---

## Phase 1 — Project Inventory

### Apps & packages

| Area | Name | Location | Purpose | Primary tables | Risk |
|---|---|---|---|---|---|
| App | CRM (staff) | `apps/crm` | Sales/ops CRM, inbox, automation, reports | `crm_records`, `crm_modules`, `inbox_*`, `crm_workflows` | Medium — largest surface |
| App | Portal (member) | `apps/portal` | Member self-service, billing, dependents, enroll | `members`, `enrollments`, `billing_*`, `dependents` | Medium — PHI/money |
| App | Admin | `apps/admin` | Back-office billing, commissions, agents, ops | `billing_transactions`, `commission_*`, `job_runs` | High — money writes |
| App | Advisor portal | `apps/advisor-portal` | Advisor-facing lightweight portal | `profiles`, `crm_records`, `members` | Low — small surface |
| App | Website | `apps/website` | Public marketing + enrollment entry | `enrollments`, `landing_pages`, `plans` | Medium — public flows |
| App | DoubleHelixHub | `apps/doublehelixhub` | Branded shell (minimal) | `crm_records` (1 ref) | Low |
| Package | `@crm-eco/lib` | `packages/lib` | Shared Supabase helpers, types, enrollment, members | 55 tables referenced | High — shared truth |
| Package | `@crm-eco/ui` | `packages/ui` | Design system | — | Low |
| Package | `@crm-eco/enrollment` | `packages/enrollment` | Enrollment domain logic + DB specs | `enrollments`, `members` | High |
| Package | `@crm-eco/rates` | `packages/rates` | Rating/pricing helpers | `plans`, rate tables | Medium |

**Route counts:** CRM 230 pages / 282 API routes · Portal 50 / 19 · Admin 107 / 34 · Advisor 10 / 0 · Website 14 / 0 · DHH 8 / 1

### Hawkeye scan summary (2026-06-15)

| Metric | Value |
|---|---:|
| Files scanned | 1,855 |
| Files with Supabase calls | 825 |
| `.from()` calls | 2,766 |
| Unique tables referenced in code | 402 |
| `.rpc()` calls | 150 |
| Dynamic table refs (unauditable) | 567 |

### Module inventory (by app)

| Module | Route / entry | Main components | Key tables | Status |
|---|---|---|---|---|
| Leads | `/crm/leads` | Module list engine, `RecordDetailShellV2` | `crm_records`, `crm_modules` | **Correct** (generic engine) |
| Contacts | `/crm/contacts` | Same engine | `crm_records` | **Correct** |
| Deals / pipeline | `/crm/pipeline` | `PipelineBoard`, stage API | `crm_records`, `crm_deal_stages` | **Partial** — stages API exists, settings UI deferred |
| Members (CRM) | `/crm/members` | `MembersListClient`, record shell | `members`, `crm_records` | **Partial** — list capped, shared-email edge case |
| Inbox | `/crm/inbox` | Conversation list, thread | `inbox_conversations`, `sent_emails` | **Partial** — SMS path split from inbox |
| Enrollment (CRM) | `/crm/enrollment` | Wizard actions | `enrollments`, `enrollment_steps` | **Partial** — some public 404 dead-ends |
| Reports | `/crm/reports/*` | Builder, scheduled | `crm_reports`, MVs | **Partial** — charts/export/scheduler gaps |
| Admin billing | `/billing/*` | NACHA, declined, processors | `billing_transactions`, `payment_profiles` | **Active** — high money impact |
| Admin commissions | `/commissions/*` | Runs, payouts, summary | `commission_transactions` | **Broken writes** — SELECT-only RLS (prior audit) |
| Portal dashboard | `/` | `MemberDashboardShell` | `members`, `memberships`, `needs` | **Correct** — uses `@crm-eco/lib` |
| Portal billing | `/billing` | Client page + dependents | `billing_transactions`, `dependents`, `dependent_coverage_periods` | **At risk** — table drift BLOCKER |
| Portal dependents | `/dependents` | Server actions | `dependents`, `dependent_coverage_periods` | **At risk** — same drift |
| Public enroll | `/enroll` (website + portal) | Enrollment wizard | `enrollments`, `plans` | **Partial** — 404 after agreement (prior audit) |

### Database inventory (live snapshot, May 22)

| Metric | Count |
|---|---:|
| Public tables | 484 |
| Columns | 7,797 |
| RLS policies | 2,114 |
| Functions | 540 |
| Foreign keys | 1,077 |
| Indexes | 2,784 |
| Edge functions | (not in Hawkeye — manual review) |

### Frontend data access — top tables by reference count

| Rank | Table | Code refs | Primary consumers |
|---:|---|---:|---|
| 1 | `profiles` | 182 | All apps — auth context |
| 2 | `crm_records` | 176 | CRM engine |
| 3 | `enrollments` | 106 | CRM, portal, website, admin |
| 4 | `members` | 94 | Portal, admin, CRM |
| 5 | `advisors` | 86 | CRM, admin, portal |
| 6 | `crm_modules` | 65 | CRM config |
| 7 | `crm_tasks` | 57 | CRM tasks |
| 8 | `billing_transactions` | 33 | Portal billing, admin |
| 9 | `dependents` | 17 | Portal, CRM coverage |
| 10 | `dependent_coverage_periods` | 15 | Portal, CRM — **BLOCKER: not in May 22 schema** |

Full per-app table breakdown is in `.audit/code/tables.csv` (regenerated 2026-06-15).

---

## Phase 2 — Tenant / Org Isolation Matrix

**Scope:** Top 50 tables by code references + all money/PHI tables.  
**Evidence:** `.audit/schema/columns.csv`, `rls_enabled.csv`, `rls_policies.csv` (May 22).  
**Frontend filter column:** Derived from Hawkeye `filters.csv` — spot-check only at this phase.

### Key patterns

1. **Canonical scope field:** `organization_id` on money/PHI tables; CRM engine still uses **`org_id`** on `crm_records` and related config (strangler migration in progress).
2. **RLS:** Enabled on the vast majority of tenant tables; policies keyed on `profiles` / `auth.uid()`, not JWT metadata.
3. **Admin multi-org:** `organization_members` + cookie-based active tenant (`switchTenant` server action) with membership validation.
4. **CRM single-org:** Staff CRM resolves one `profiles.organization_id` per login — no in-app org switcher (by design for PIFH staff).
5. **Portal member scope:** Resolves member via `profiles.member_id` or email fallback **within** `profile.organization_id` — relies on RLS for cross-member protection.

### Isolation matrix (abbreviated — full table in appendix)

| Table | Scope | Required field | Present? | RLS | Scope fields | Risk |
|---|---|---|---|---|---|---|
| `crm_records` | organization | org_id | Partial (legacy name) | t (multiple) | org_id, owner_id | **MEDIUM** |
| `profiles` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `members` | organization | organization_id | Yes | t | organization_id | LOW |
| `enrollments` | organization | organization_id | Yes | t | organization_id | LOW |
| `billing_transactions` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `billing_schedules` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `payment_profiles` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `dependents` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `dependent_coverage_periods` | organization | organization_id | **MISSING IN SNAPSHOT** | — | — | **HIGH** |
| `commission_transactions` | organization | organization_id | Yes | t (SELECT-heavy) | organization_id | **MEDIUM** |
| `needs` | organization | organization_id | Yes | t | organization_id, member_id | LOW |
| `organizations` | global | — | — | t | — | LOW |
| `plans` | organization | organization_id | Yes | t | organization_id | LOW |
| `age_bands` | global/reference | — | — | t + **USING(true)** read | — | **MEDIUM** |

See [DHH-PHASE2-TENANT-MATRIX-FULL.md](./DHH-PHASE2-TENANT-MATRIX-FULL.md) for all 58 rows.

### Tenant flags requiring follow-up

| ID | Finding | Priority |
|---|---|---|
| T-01 | `dependent_coverage_periods` referenced in code but absent from May 22 schema — migration `202606130001` not applied on prod at snapshot time | P1 |
| T-02 | 9 reference-catalog policies use `USING (true)` for authenticated/public read (age bands, tiers, etc.) — intentional for pricing but widens read surface | P2 |
| T-03 | 8 `activity_log_*` partitions have RLS enabled, zero policies — client reads return empty | P2 |
| T-04 | Admin `tenant-supabase.ts` auto-injects `organization_id` filter; CRM relies on explicit `.eq('org_id', …)` per query — inconsistent pattern | P3 |
| T-05 | Portal `getMemberForUser` email fallback could link wrong member if duplicate emails exist in org (known B1 from prior audit) | P1 |

---

## Phase 5 — Critical Workflow Audit

Ten end-to-end workflows traced through code. **Expected** = generic SaaS-correct behavior. **Actual** = evidence from repository.

### Workflow matrix

| # | Workflow | Trigger | Tables | Key files | Expected | Actual | Risk |
|---|---|---|---|---|---|---|---|
| W1 | **Lead create** | User submits create form / API | `crm_records`, `crm_modules` | `record-create-service.ts`, `POST /api/crm/records` | Org-scoped insert, dup check, workflows | ✅ Validates `org_id === profile.organization_id`, RPC dup check, merges JSONB → columns, fires `on_create` workflows | LOW |
| W2 | **Lead create (legacy dialog)** | `CreateLeadDialog` | `crm_records` | `create-lead-dialog.tsx` | Same as W1 | ✅ Uses `postCrmRecord` → shared create service; dup warning on email | LOW |
| W3 | **Lead → contact convert** | API POST | `crm_records`, RPC | `convert-to-contact/route.ts` | Atomic convert, insurance field carry | ✅ Service-role RPC `convert_lead_to_contact`; role-gated; ⚠️ calls missing RPC `repair_converted_contact_insurance_data` (non-fatal warn) | **MEDIUM** |
| W4 | **Lead → member convert** | API POST | `crm_records`, `members`, RPC | `convert/route.ts` | Admin/manager only, audit trail | ✅ RPC `convert_lead_to_member` via service role; passes `profile.id` for audit FK | LOW |
| W5 | **Record save (inline/form)** | PATCH API | `crm_records` | `record-patch-service.ts`, `PATCH /api/crm/records/[id]` | Optimistic lock, org guard, PHI log | ✅ Idempotency wrapper, `x-if-updated-at`, org match, merges JSONB, workflows on update | LOW |
| W6 | **Org switch (admin)** | Switcher dropdown | `organization_members`, cookie | `switch-tenant.ts`, `OrganizationSwitcher.tsx` | Verify membership before switch | ✅ Validates active `organization_members` row, sets cookie, revalidates layout | LOW |
| W7 | **Org context (CRM staff)** | Login / middleware | `profiles` | `middleware.ts`, `getAuthProfile()` | Single org from profile | ✅ No switcher — uses `profiles.organization_id`; middleware enforces CRM role | LOW |
| W8 | **Portal member resolve** | Page load | `profiles`, `members` | `memberPortal.ts` | Member scoped to user's org | ✅ Fast path `member_id`; fallback matches email **within org**; self-heals profile link | **MEDIUM** (B1 edge) |
| W9 | **Portal billing load** | `/billing` client fetch | `billing_transactions`, `payment_profiles`, `billing_schedules`, `dependents`, `dependent_coverage_periods` | `billing/page.tsx` | Show history + next payment + family coverage | ✅ Filters by `member_id` from profile; ⚠️ `dependent_coverage_periods` may 404 if migration not applied; `(supabase as any)` casts on payment tables | **MEDIUM** |
| W10 | **Portal dependent add/remove** | Server actions | `dependents`, `dependent_coverage_periods`, billing recalc | `dependents/actions.ts`, `packages/lib/.../dependentCoverage.ts` | Period history + billing recalc | ⚠️ Same schema drift as W9; logic in shared lib is sound if table exists | **MEDIUM** |

### Workflow detail — highest-risk paths

#### W3 — Lead → contact conversion

```
UI → POST /api/crm/leads/convert-to-contact
  → getAuthProfile() (crm role check)
  → service-role supabase.rpc('convert_lead_to_contact')
  → optional rpc('repair_converted_contact_insurance_data')  ← BLOCKER if RPC missing
```

- **Good:** Conversion is atomic in DB RPC, not multi-step client writes.
- **Gap:** Repair RPC referenced in code but Hawkeye reports it missing from May 22 schema. Conversion succeeds; insurance field repair silently fails.

#### W5 — Record PATCH

```
UI inline edit → PATCH /api/crm/records/[id]
  → withIdempotency(rawBody)
  → executeCrmRecordPatch()
     → org_id guard on existing row
     → merge JSONB patch → top-level columns (premium, dates, advisor_id, …)
     → blueprint validation (optional)
     → PHI field logging
     → on_update workflows + scoring (async)
```

- **Good:** Single patch service shared by API and server actions — avoids duplicate save logic.
- **Gap:** Custom fields live in JSONB `data`; Hawkeye cannot statically prove every UI field maps to a real column.

#### W9/W10 — Portal billing & dependents

- Reads are member-scoped via `profiles.member_id` — correct pattern.
- **No explicit `organization_id` filter** on billing queries — acceptable if RLS enforces member ownership (verify with cross-tenant spec).
- **Schema drift:** `dependent_coverage_periods` is central to recent feature work but not in the May 22 schema snapshot.

---

## Appendix — Related artifacts

| Artifact | Path |
|---|---|
| Full tenant matrix (58 rows) | [DHH-PHASE2-TENANT-MATRIX-FULL.md](./DHH-PHASE2-TENANT-MATRIX-FULL.md) |
| Issue register (Phase 7) | [DHH-ISSUE-REGISTER.md](./DHH-ISSUE-REGISTER.md) |
| Hawkeye findings JSON | `.audit/reports/findings.json` |
| Prior product audit | [CRM-ECO-Product-Audit-2026-06-01.md](./CRM-ECO-Product-Audit-2026-06-01.md) |
| Hawkeye operator guide | [README.md](./README.md) |

---

## Recommended next steps (audit-only — no action taken)

1. **Refresh schema snapshot** — run `.audit/scripts/refresh-schema.sh` against prod read-only URL and re-run crossref.
2. **Apply pending migrations** — especially `202606130001` (dependent coverage) after rehearsal.
3. **Triage issue register** — start with `DHH-AUDIT-001` and `DHH-AUDIT-002` (BLOCKERs).
4. **Phase 3 sprint** — `crm_records` JSONB field sync for leads/contacts/deals/members modules.
5. **Phase 4 sprint** — modal lifecycle for top 20 modals by usage (create lead, convert, enrollment, billing).
