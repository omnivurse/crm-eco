# CONTEXT — CRM-ECO Domain Glossary

This file is the shared domain vocabulary for the CRM-ECO monorepo. Architecture
reviews, ADRs, and design conversations should use these terms exactly. When a new
concept earns a name, add it here rather than inventing a synonym elsewhere.

The architecture vocabulary (module, interface, depth, seam, adapter, leverage,
locality) comes from the `/codebase-design` skill; the terms below name the
**domain** those structures serve.

---

## Core entities

- **Organization (Tenant)** — the top-level isolation boundary. Every domain row
  carries `organization_id`; RLS enforces that a caller only sees their tenant's
  rows. In this codebase "org", "tenant", and "organization" are the same thing.
  Membership lives in `organization_members` (role + plan + branding). Production
  tenant is PIFH.

- **Member** — a person enrolled in a health-sharing program. Stored in the
  `members` table (admin) and mirrored into `crm_records` (module = members) on the
  CRM side. A member has a household, dependents, coverage, billing, and documents.

- **Dependent** — a spouse or child attached to a member's household. Priced and
  (optionally) coverage-tracked separately from the primary member.

- **Agent (Producer / Advisor)** — a person who enrolls members and earns
  commissions. "Agent", "Producer", and "Advisor" are used interchangeably across
  legacy Zoho data and the current schema (`advisors` table, `advisor_id` FKs).
  Agents form a **hierarchy** (upline/downline) that drives override commissions.

- **Plan / Product** — a health-sharing offering with a rate structure. Admin
  "products" UI reads/writes the `plans` table; `plans` carries priced/coverage
  detail (`monthly_share`, `iua_amount`, `max_annual_share`). Authoritative rate
  cards live in `plan_rate_sets` / `plan_rate_entries` / `plan_fees`, quoted
  through `@crm-eco/rates`.

- **MSA Rate Card** — a tiered-household rate matrix for Medical Savings Account
  style sharing: coverage tier × age band × IUA × **Market Segment**. Codes look
  like `PIFH-MSA-IND-1250` / `PIFH-MSA-GRP-2500`. Seed + DB cards are marked
  `provisional` until partnership (doctor/nurse) costs and wellness lab panel
  amounts are finalized.

- **Market Segment** — `individual` or `group`. Selects which MSA rate column
  applies and which **Age Rating Basis** the engine uses.

- **Age Rating Basis** — how the engine picks the age band for a household:
  `primary` (Group: employee age) or `older_of_couple` (Individual: max of
  member and spouse ages for Member+Spouse / Family tiers).

- **Enrollment Contribution** — one-time fee to join PIFH membership (list
  amount configurable; proposed $800). Not the monthly share. Stored as a
  `plan_fees` line (`enrollment-contribution`) and org `system_settings`
  (`enrollment_contribution_*`).

- **Founding Member Waiver** — optional reduction of the Enrollment Contribution
  for early members (proposed $650 waive against $800 list, cap 250). Always
  adjustable or fully waivable via settings; split metadata (referring / admin /
  partner / PIFH) is recorded but not auto-disbursed by the rate engine.

- **IUA (Initial Unshareable Amount)** — the member's per-incident responsibility
  before sharing begins (a deductible-equivalent). MSA tiers: $1,250 / $2,500 /
  $5,000.

- **Enrollment** — the process and record of a member joining a plan. Lives in
  `enrollments` with `enrollment_steps` and `enrollment_audit_log`. Terminal
  states: draft → in_progress → submitted → approved/rejected/cancelled.

- **Adult Intake** — health-share demographic overlap collected in the public /
  self-serve enrollment wizard intake step (`AdultIntake` in
  `@crm-eco/enrollment`): identity, multi-phone + leave-message consents,
  preferred contact, email consent, address, emergency contact, relationship
  status, referral. Persisted via `projectAdultIntakeToMember` /
  `projectAdultIntakeToCustomFields` onto `members` + enrollment
  `custom_fields`. Medical overlap (PCP, chronic conditions, meds, tobacco) is
  **not** on Adult Intake — it seeds the questionnaire template
  `adult_medical_overlap` (`ADULT_MEDICAL_OVERLAP_QUESTIONS`). Therapy-only
  clinical packs are out of scope.

- **Membership** — the active ongoing relationship after an approved enrollment
  (`memberships` table: billing_amount, status, effective/end dates).

- **Need (Sharing Request / Claim)** — a medical expense submitted for sharing.
  The health-sharing analogue of an insurance claim. Never call it a "claim" in
  member-facing copy; internally the actuarial docs use "need".

- **Sharing** — the act of members collectively funding an approved Need. The
  domain is "medical cost sharing", explicitly **not insurance**.

- **Commission** — money earned by an agent on an enrollment. Types: signup,
  monthly, override (paid up the hierarchy). Flows through `commissions` →
  `commission_ledger` → `commission_payouts` / `commission_payment_batches`.

- **Billing** — recurring collection of member contributions. `billing_schedules`
  drive `billing_transactions`; failures land in `billing_failures`. Payment rails:
  Authorize.Net (active), Stripe (adapter, inactive), NACHA/ACH.

---

## Platform / cross-cutting concepts

- **Command Center** — the tabbed detail view for a Member (and the pattern we want
  every major entity to follow): one record, many aspect tabs (overview, billing,
  documents, activity, audit, notes, tasks). See
  `apps/admin/src/components/members/` and `lib/member-command/types.ts`.

- **IdentityActionsHeader** — the shared layout module in `@crm-eco/ui` for entity
  and page chrome: identity (title/meta) on the left, actions on the right, with an
  overflow-safe flex contract (`min-w-0 flex-1` identity, wrap-under-breakpoint
  actions). App PageHeaders and record detail shells are thin branded adapters over
  this seam. Not a domain entity — platform chrome.

- **Module** (domain sense) — a top-level navigable area: Members, Agents, Billing,
  Commissions, Payables, Invoices, Ops, Reports, Communications, Documents,
  Notifications, Enrollments, Products, Organizations, Settings. (Distinct from the
  `/codebase-design` architectural "module".)

- **Automation Engine** — the CRM-side workflow/rules runtime
  (`apps/crm/src/lib/automation/`): triggers, conditions, actions, assignment,
  scoring, sequences, approvals, blueprints. Not yet platform-wide.

- **Audit** — three layers today: unified enterprise audit
  (`@crm-eco/lib/audit` → `unified_audit_logs`, hash-chained), PHI access audit
  (CRM-only → `phi_access_log`), and partitioned activity log
  (`@crm-eco/lib/activity-log`).

- **Records model** — the Zoho-style flexible entity store on the CRM side:
  `crm_records` (+ `crm_modules`, `crm_fields`, `crm_views`, `crm_layouts`).
  Contrasts with the strongly-typed admin tables (`members`, `advisors`, etc.).

- **Entity Reupload (Trickle Update)** — update-only CSV refresh of existing
  `crm_records` (Zoho-style dumps). Match order: `zoho_id` → `email` → `phone` →
  `name`+`DOB`. Unmatched rows are ignored (never inserted); ambiguous matches
  fail closed. Dry-run → apply. Lives in `apps/crm/src/lib/imports/run-csv-update.ts`
  with UI at Import Wizard “Update existing” and `/crm/imports/update`. Distinct
  from insert import (`/api/crm/import`) and from month-keyed Period Feeds (not yet
  a product module).

- **Tenant resolver** — the per-request logic that picks the active org from
  header → cookie → subdomain → membership. Currently duplicated in
  `apps/admin/src/lib/tenant.ts` and `apps/crm/src/lib/tenant.ts`; only the cookie
  constants are shared (`@crm-eco/lib/tenant`).

---

## Naming conventions

- Prefer **Agent** in new UI copy; keep **advisor** in code that already uses
  `advisor_id` to avoid churn.
- Prefer **Need** over "claim" everywhere member-facing.
- **Organization** in UI, `organization_id` in schema, "tenant" in architecture
  discussion — all the same boundary.
- This platform is **health sharing**, never "insurance".
- **MSA Rate Card** is a sharing product price matrix. Do not use "MSA" alone for Health Cost Labs geography.

---

## Cash Pay / Health Cost Labs

- **HCL Market** — inventory state or region label HCL invented (`Oregon`, `CA-S California`, `TX-North Texas DFW`). Not a USPS state when split.
- **HCL Metro** — exact CMSA string `GetRateDataPaged` requires (`Portland-Salem`). Must match the catalog character-for-character.
- **Cash Rate Tick** — one published facility × procedure code × cash rate row.
- **Result Slice** — the current page (≤50 ticks). Never present slice min/max as the metro.
- **File Size** — HCL `totalCount` for the query (often millions).
- **CMS Relativity** — tick vs Medicare (`cmsRelativity`).
- **Live Specialty** — a specialty string this API key can fulfill. Today: `Hospital cash prices`. Pharmacy / Imaging / Laboratory 400 until HCL maps them.
