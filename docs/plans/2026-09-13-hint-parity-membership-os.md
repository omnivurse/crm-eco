# Hint Parity — Membership / Employer OS Build Plan

**Date:** 2026-09-13  
**Mode:** `FULL_AUDIT` + `BUILD_SPEC`  
**Task class:** Architecture / Build Planning + Phase-1 implementation  
**PROD WRITE RISK:** `YES` for schema when applied to production. This repo file is additive. **Do not apply the migration to live PIF-ECO-V2 without explicit owner approval.**  
**SKU lock:** Membership OS first (plans, enroll, employers, billing, packages later). **Do not clone Hint EMR.**

Sources: [Hint](https://www.hint.com/), [pricing](https://www.hint.com/pricing), [memberships](https://www.hint.com/platform/memberships), [billing](https://www.hint.com/platform/billing), [employers](https://www.hint.com/platform/employers), [affiliates](https://www.hint.com/platform/affiliates), [developer API](https://developers.hint.com/docs/overview), Hint support (rates, coverage plans, EAS, employer portal, packages, portal shopping), plus CRM-ECO live schema and code.

---

## Executive summary

Hint is a **Direct Care practice OS**: EMR + scheduling + inbox + AI + memberships + billing + employers + affiliate networks + marketplace APIs. About 3,500 organizations run on it.

CRM-ECO is a **health-sharing + CRM + producer-distribution OS** (PIFH): enrollment wizard, MSA rate cards, IUA, advisor hierarchy/commissions, member portal, Authorize.Net/NACHA billing, needs/sharing, Cash Pay hospital rates.

If the goal is the **same industry and clients** (DPC/direct-care practices, MSOs, networks, TPAs, brokers, employers), those buyers start with:

1. Can I design plans by age, family, sponsor, and location?
2. Can people enroll themselves (retail + employer)?
3. Does eligibility stay in sync with the employer roster?
4. Do I get one accurate sponsor invoice?
5. Can I layer programs + packages and still bill correctly?
6. Does failed payment recovery run itself?

**Largest commercial gap:** Hint-grade employer / eligibility / sponsor-billing OS.  
**Do not clone EMR** unless we explicitly become a clinic OS.

**Verdict**

| Scope | Readiness |
|---|---|
| One retail health-share enrollment | Partial / pilot-ready |
| Hint-class membership OS for DPC + employer clients | Not ready |
| Safest path | Membership / billing / employer / distribution layer first |

---

## What Hint actually is

Hint sells one modular platform:

| Hint module | What it is | Same-client need? |
|---|---|---|
| Memberships | Plans, coverage rules, households, layered memberships, packages, branded signup | Must have |
| Billing | Recurring + one-time + employer invoices, POS, dunning, tax, credits | Must have |
| Employers | Roster eligibility, AutoSync, sponsor invoice, employer portal, sponsor APIs | Must have |
| Affiliates / Network | Clinic-to-network sync + affiliate payouts + Hint Connect | Later (we already have *agent* commissions) |
| Practice management | Calendar, self-book, tasks | Only if we sell to clinics |
| Communications | Unified inbox: portal chat, SMS, phone, voicemail, fax | Nice; we have CRM email |
| EMR | Chart, eRx, labs, vitals, C-CDA import | Do not build for enrollment parity |
| AI | Scribe, analyze, chart chat | Clinical only |
| Marketplace + APIs | Partner apps, webhooks, practice tokens, sandbox | Needed once we sell to operators |
| Mobile | iOS clinician app | Later |
| Community | Summit, bootcamp, playbooks | Go-to-market, not software |

Hint offers **billing-only** if the practice already has an EMR. That is the lane we can win first.

---

## Hint end-to-end flows

### A. Practice / tenant setup

Create the practice → users/roles → locations/practitioners → phone/fax → notification templates → payment processor (Hint Payments / Rainforest, or Stripe) → membership options → coverage plans → signup pages.

### B. Design a membership (Hint plan engine)

From [membership rates](https://support.hint.com/en/articles/2138159-configure-membership-rates-and-billing-options) and [coverage plans](https://support.hint.com/en/articles/5921503-configure-coverage-plans):

- Retail vs company (sponsor) plan types
- Age-banded rates (years **and months**, including infant bands)
- Family algorithms: couple / two-parent / single-parent / extra child / extra adult / child-only
- Group-size discounts (tiered vs retroactive whole-group)
- Four-tier group pricing (employee / spouse / child + caps)
- Special rates (e.g. “College Student”) applied per person
- Billing in **advance or arrears** (arrears = monthly only, regulatory)
- Default + extra periods: monthly / quarterly / semi-annual / annual with discounts
- Registration (enrollment) fees, with a **family max**
- Minimum enrollment period warnings
- Age restrictions on signup
- **Automatic age-tier repricing** + staff notification
- **Coverage rules** on charge items/categories: included, included if under $X, limited quantity per period, % discount, flat amount, pass-through at cost, **who pays: patient or sponsor** (no split yet)
- Sponsor-specific plans and terms
- Scheduled plan changes: **date-based** or **duration-based** (N months after each start)
- Multiple retail memberships + **one sponsored** membership per patient
- Prepaid **packages/bundles** with utilization remaining, tax, deferred revenue
- Gender-inclusive enrollment
- Coupons, lead sources, cancellation reasons

### C. Retail enrollment (patient-paid)

Hint hosted signup (or custom page via API):

1. Land on **branded / embedded** signup page (multiple pages per practice).
2. Smart language: **Spanish if browser is ES**.
3. Enter patient + household (spouse/children).
4. Optional quote (`POST /quotes`).
5. Sign digital agreements (plan/employer-specific, EN/ES).
6. Tokenize card/ACH (Rainforest; PAN never hits Hint).
7. Create patients → payment method → membership.
8. Bill tonight **or** `bill` immediately.
9. Abandoned signups tracked (`signup_attempts`).
10. Automated enrollment reminders.

API equivalent from [custom signup](https://developers.hint.com/docs/creating-a-custom-signup-page):  
`GET /plans` → `POST /quotes` → `POST /patient` (each person) → `POST /payment_methods` → `POST /memberships` → optional `bill`.

### D. After they are a member

- One patient record: memberships, invoices, portal, chart, inbox
- Add dependents (staff or portal); start date usually **next bill date**
- Combine two memberships into one household
- Layer add-on memberships (DPC + weight loss, etc.)
- Each membership: own bill date, frequency, amount, payment method, agreement
- Portal **shopping**: buy another membership or package
- POS card readers; add labs/meds/ancillary onto invoices
- Record external payments, partials, refunds, credits
- Expiring-card flags, retries, dunning, bad-debt
- Schedule a future plan change (intro rate → full rate)
- Self-book, message clinic, complete forms, see labs (clinical — out of enrollment scope)

### E. Employer / sponsor flow (Hint’s real moat)

From [employer setup](https://support.hint.com/en/articles/2138125-employer-account-setup), [EAS](https://support.hint.com/en/articles/2403529-employee-uploads-eligibility-autosync-eas-file-feed-setup-configuration), [employer page](https://www.hint.com/platform/employers):

1. Create **company/sponsor** + default **company plan** + billing start.
2. Optional: multiple plans, divisions, dependent limits, enrollment cutoff day, backbill limit (default 6 months), default provider.
3. Invite **company admins** to a **branded employer portal**.
4. Enroll people four ways:
   - Employee signup link
   - Employer uploads a known roster (no employee action)
   - Eligibility file (eligible, not yet opted-in) + invite / signup
   - Employer portal add employee/dependent
   - **Eligibility AutoSync**: TPA/HRIS drops CSV on SFTP on a schedule
5. Match on first + last + DOB → auto-enroll; no match → email company admin to approve.
6. Start dates **always the 1st**; cutoff day decides this month vs next.
7. Eligibility end → **rule-driven membership end**.
8. **One sponsor invoice** from current eligibility + memberships; one-off group charges allowed.
9. Hybrid: employer pays membership, employee pays add-ons.
10. Plan sponsor APIs: companies, company_plans, sponsorships (employee/spouse/child), employer invoices.

### F. Network / affiliate flow

Network models affiliates → enrolls a member to a clinic → syncs patient/membership data → bills/pays the affiliate on contract rates → network reporting. [Hint Connect](https://www.hint.com/connect) is a marketplace of clinics for employers.

### G. Money / invoice lifecycle

Invoice states: draft → issued → sent → retrying → paid | cancelled | disputed | bad_debt.  
PDF on demand. Email invoice. Credits. Locked reporting periods. Accounting exports. Sales tax. Data Sync to a warehouse.

### H. Developer surface

Practice API (`/api/provider/*`) + Partner/Marketplace API + webhooks (`patient.created`, `membership.updated`, `customer_invoice.paid`, …) + sandbox.

---

## What we can do today (verified 2026-09-13)

### Our enrollment flow (health-share)

Staff + public/self-serve share `@crm-eco/enrollment`:

1. **Intake** — identity, phones + consents, address, emergency contact, relationship, referral
2. **Household** — spouse/child/dependent + DOB
3. **Questionnaire** — DB-driven (`adult_medical_overlap`). Skip if no template
4. **Plan** — pick plan, effective date, optional Rx pricing, optional rate-engine quote, optional `product_eligibility_rules` (flag-gated; default advisory)
5. **Compliance** — not-insurance / guidelines / pre-ex + typed e-sign
6. **Payment** — bank draft or card, billing day
7. **Confirm / submit**

`finalizeEnrollment` then: vault payment → charge **month 1** (abort if decline) → `finalize_member_enrollment_tx` → portal invite → emails. Idempotent.

### Surfaces

| Surface | Status |
|---|---|
| Admin public `/enroll` + `/enroll/[slug]` (full wizard) | Production-shaped |
| CRM staff wizard | Production-shaped |
| Member-portal `/enroll` | Full wizard, but **redirects existing members** |
| Member-portal `/enroll/[slug]` | **Broken:** lead-capture only; `/start` points at missing `/intake`; `/agreement` orphaned |
| Website `/enroll` | Redirect to admin enroll domain |
| Agent links + QR + analytics | Stronger than Hint |
| Rate engine (MSA, IUA, group/individual, older-of-couple) | Strong |
| Billing (AuthNet, NACHA, schedules, dunning 1/4/7/14) | Strong |
| Group `invoice_groups` | Staff cohorts, **not** sponsor billing; generation often client-side |
| Ops `/ops/eligibility` | **Stub** (mock counts / simulated job). Not employer roster. |
| Vendor SFTP columns | Schema/UI only; **no SFTP client** |
| Employer website page | Marketing only |
| Plan change in portal | `member_change_requests` ticket, not instant |
| E-sign | Canvas + PDF. DocuSign adapter is stub. |
| Cash Pay | Complete pricing product; **not** membership checkout |
| Advisor commissions | Stronger than Hint Scale “commission tracking” |
| Needs / sharing | Our domain; Hint does not have this |

### What we have that Hint does not

| Ours | Hint |
|---|---|
| Health-share / Need / IUA / MSA rate cards | DPC membership, not sharing |
| Advisor upline/downline + override commissions | Light commission tracking on Scale |
| Zoho-style CRM | Practice EMR + patient list |
| Enrollment-link attribution | Signup pages + lead sources |
| Founding-member waiver / enrollment contribution | Registration fees only |
| Cash Pay hospital rates | Clinic POS / packages |
| Member needs (sharing requests) | Clinical chart |

---

## Gap matrix

Legend: **Have** / **Partial** / **Missing** / **Skip**

| Capability | Hint | Us | Want |
|---|---|---|---|
| Unlimited plans per location/sponsor | Have | Partial | Have |
| Age bands (years + months) | Have | Partial (year bands) | Have if pediatrics |
| Family / couple / extra-child algorithms | Have | Partial | Have |
| Group-size $/% discounts | Have | Missing | Have |
| Four-tier EE/spouse/child | Have | Partial (MSA tiers) | Have |
| Special per-person rates | Have | Missing | Have |
| Advance vs arrears | Have | Missing | Have |
| Monthly/Q/SA/Annual + discounts | Have | Partial | Have |
| Registration fee + family max | Have | Partial | Have |
| Age-out auto-reprice + notify | Have | Partial | Have |
| Coverage rules (include/discount/qty/who-pays) | Have | Missing | Have |
| Layered / multiple memberships | Have | Missing (1:1; plan change cancels) | Have |
| Prepaid packages + remaining units | Have | Missing | Have |
| Portal self-buy / cart | Have | Missing | Have |
| Scheduled plan change (date + duration, plan-level) | Have | Partial (per-record CRM cron) | Have |
| Coupons | Have | Missing | Later |
| Branded multi signup pages | Have | Partial (admin slug works; portal slug broken) | Have |
| Embedded signup | Have | Missing | Have |
| EN + ES docs/portal/emails | Have | Missing | Have |
| Digital agreements per plan/sponsor | Have | Partial | Have |
| Abandoned signup + reminders | Have | Partial | Have |
| Company/sponsor object + portal | Have | **Missing** | **Must** |
| Sponsor-specific plans | Have | Missing | **Must** |
| Eligibility roster + bulk upload | Have | Missing | **Must** |
| Eligibility AutoSync SFTP | Have | Missing | Phase 2 |
| Eligibility end → membership end | Have | Missing | **Must** |
| Cutoff day + 1st + backbill cap | Have | Partial (1st-of-month exists) | **Must** |
| Match FN/LN/DOB + admin approve | Have | Missing | **Must** |
| Invite-to-enroll emails | Have | Missing | **Must** |
| One invoice per sponsor | Have | Partial (invoice groups ≠ sponsor) | **Must** |
| Hybrid sponsor + member add-on | Have | Missing | **Must** |
| Employer divisions | Have | Missing | Phase 2 |
| Plan sponsor APIs | Have | Missing | Phase 2 |
| Invoice as money SoT | Have | Partial | Have |
| Ancillary / labs on invoice | Have | Partial | Have |
| Partial payments + credits | Have | Missing | Have |
| Expiring-card flags | Have | Missing | Have |
| Retries + dunning | Have | Have | Polish |
| POS card readers | Have | Missing | If clinic SKU |
| Sales tax | Have | Missing | Have |
| Affiliate clinic sync + payout | Have | Different (advisors) | Phase 3 |
| EMR / eRx / labs / AI scribe | Have | Skip | **Skip** |
| Public practice API + webhooks | Have | Partial (CRM keys) | Phase 2 |

---

## Source-of-truth decisions

| Concept | Canonical object | Do not |
|---|---|---|
| Person | `members` (+ `crm_records` mirror) | New `patients` table |
| Household people | `dependents` | Duplicate person rows |
| Application | `enrollments` + `enrollment_steps` | Collapse into membership status |
| Commercial coverage | `memberships` (later: many per member) | One membership forever |
| Catalog | `plans` + `plan_rate_sets` / `plan_fees` | Fork DPC vs share catalogs |
| Employer | **`sponsors`** | Reuse `organizations` (that is the tenant) |
| Eligibility | **`sponsor_roster` + `sponsorships`** | Reuse `vendor_eligibility_runs` |
| Money | Invoice + `billing_transactions` | Treat invoice groups as employers |
| Who pays | Invoice `payer_type`: member \| sponsor | Hidden in notes |
| Agent pay | Existing `commissions` | New affiliate table unless we mean **clinics** |

---

## Target architecture

```text
Tenant (organization)
  ├── Plans (retail | sponsored) + rate cards + fees + periods
  ├── Coverage rules → charge items (later)
  ├── Packages (later)
  ├── Signup pages (brand, locale, plan set, docs)
  │
  ├── Member (person)
  │     ├── Memberships[] (layered later)
  │     ├── Dependents / household
  │     ├── Payment methods[]
  │     └── Invoices / entitlements
  │
  ├── Sponsor (employer)
  │     ├── Sponsor plans, cutoff, backbill, dependent caps
  │     ├── Roster / CSV / later EAS
  │     ├── Sponsorships (employee | spouse | child)
  │     ├── Employer portal users
  │     └── Sponsor invoices (one per period)
  │
  └── Advisors (existing) + optional clinic Affiliates (later)
```

**Enrollment states:** `draft → in_progress → submitted → in_review → approved | rejected | cancelled | abandoned`  
**Membership states:** `pending → unconfirmed → active → unpaid → paused → ended`  
**Invoice states:** `draft → issued → sent → retrying → paid | partial | void | bad_debt`

---

## Phased build plan

Every phase is a vertical slice: schema + RLS + API + UI + jobs + audit + reports + tests. Feature-flag. Additive. No production write without approval.

### Phase 0 — Product lock

| SKU | Buyer | Includes | Out |
|---|---|---|---|
| **Membership OS** (first) | DPC, functional, MSO, PIFH, TPA | Plans, enroll, employers, billing, packages, portal shop, APIs | EMR, eRx, scribe |
| Benefit network (Phase 3) | Brokers, employers, clinic networks | Affiliates, Connect-like directory | Charting |
| Clinic OS (only if chosen) | Solo DPC | Scheduling + inbox + chart | Do not start here |

### Phase 1 — Employer / eligibility / sponsor billing (P0) — **this slice**

Packets 1–6 + slug-enroll repair. Greenfield sponsor OS. Do **not** reuse `vendor_eligibility_runs` or the stub ops eligibility page.

| # | Packet | Objects | Done when |
|---|---|---|---|
| 1 | Sponsor + portal users | `sponsors`, `sponsor_admins` | Create employer, invite admin, RLS proven |
| 2 | Sponsor plans + cutoff/backbill/caps | `sponsor_plans` | Two employers, two prices |
| 3 | Roster + match + approvals | `sponsor_roster`, `sponsorships` | CSV dry-run/apply; FN/LN/DOB match |
| 4 | Eligibility → membership job | events + job | Term file ends coverage; no extra bill |
| 5 | Employee signup link | `landing_pages.sponsor_id` | Match enrolls; no match waits |
| 6 | Sponsor invoice | invoices `payer_type=sponsor` | One invoice, correct headcount |

**Slug repair:** member-portal `/enroll/[slug]` must host the full wizard (admin already does). Create missing `/intake` as alias. Wire sponsor match on submit.

### Phase 2 — Plan engine + coverage rules

Family-fee config, group-size discounts, four-tier DPC, special rates, arrears, extra billing periods, registration fee family max, age min/max, charge items + coverage rules, plan-level scheduled change.

**Shipped 2026-09-13 (this slice):** commercial terms in `quote()` — group-size, period discounts, registration family max, age min/max, advance/arrears. Stored on `plans.metadata.commercial_terms`. No new table. Charge-item coverage rules and scheduled plan changes remain later.

### Phase 3 — Billing OS

Unify invoice homes. Charge catalog → invoice lines. PDF + email. Credits. Partial payments. Expiring-card scan. Configurable dunning. Sales tax. Move generation off the browser loop.

**Shipped 2026-09-13 (this slice):** one invoice engine on live `invoices` +
`invoice_line_items` + `invoice_payments`. Server generate (member/group),
partial payment + credit, printable HTML (no `pdf_url` / missing PDF edge fn),
send marks `sent` (email dry-run unless `INVOICE_EMAIL_ENABLED`), collections
UI + cron for expiring cards, configurable dunning in `system_settings`.
`/billing/invoices` redirects to `/invoices`. Member portal `/billing/invoices`.
Edge functions patched and deployed on PIF-ECO-V2 (2026-09-13):
`billing-retry` v14, `process-billing` v41, `process-payment` v36.
Recurring `process-billing` still does not auto-create invoices.
No new table. No prod migration.

### Phase 4 — Layered memberships + packages + portal shop

Many memberships per member. Packages + entitlements. Portal cart. Unblock portal `/enroll` for add-ons.

**Shipped and applied on PIF-ECO-V2 (2026-09-13 / 14 UTC):**
`memberships.layer` (`core` | `addon`) + one-sponsored unique index.
Remote migrations: `membership_packages_shop`, `membership_packages_shop_grants`.
Repo: `supabase/migrations/20260913210000_membership_packages_shop.sql` and
`20260914010000_membership_packages_shop_grants.sql`. Domain lib
`@crm-eco/lib` `memberships/`. Admin packages + plan shop flags. Portal
`/shop` + cart checkout. Portal `/enroll` sends existing members to the shop
instead of the dashboard. Household billing recalc ignores add-ons. No
AuthNet charge on shop checkout. Feature works when catalog rows exist.

### Phase 5 — Enrollment UX parity

Signup page builder, ES locale, per-plan/sponsor docs, abandoned reminders, embed, public API (extend CRM developer keys).

### Phase 6 — Network / affiliates

Only if we are Hint Connect. Do not confuse with advisors.

### Phase 7 — Practice-lite (optional clinic SKU)

Scheduling, self-book, reminders. Stop before EMR.

### Phase 8 — Explicitly out of scope

EMR, ePrescribe, lab interfaces, AI scribe, clinician iOS, fax inbox, C-CDA import, medication inventory.

---

## Flows we must support (mapped)

| Flow | Us now | Finish in |
|---|---|---|
| Retail self-enroll | Steps exist; portal slug broken | This slice + Phase 5 |
| Advisor-sold enroll | Strongest vs Hint | Keep |
| Employer known roster | Missing | This slice |
| Employer eligibility + opt-in | Missing | This slice |
| Mid-year hire / term | 1st-of-month exists | This slice |
| Layered programs | Live (`layer` + packages/shop) | Phase 4 done |
| Price increase | Per-record + admin price-changes | Phase 2 |
| Failed payment | Retry/dunning exists | Phase 3 polish |

---

## Users and permissions (employer OS)

| Role | Create enroll | Roster | Sponsor invoice | Configure plans | Export |
|---|---|---|---|---|---|
| Platform / tenant admin | Yes | Yes | Yes | Yes | Yes |
| Enrollment specialist | Yes | Yes | Read | No | Limited |
| Billing | No | Read | Yes | No | Yes |
| Advisor | Own links only | No | No | No | Own book |
| Employer admin | Add EE/dep per contract | Own sponsor | Pay/view own | No | Own roster |
| Employee | Self-enroll if eligible | No | No | No | No |
| Other tenant / anon | No | No | No | No | No |

Never trust `user_metadata` or client-supplied `organization_id` / `sponsor_id`.

---

## What we should not do

1. Do not build an EMR to “catch Hint.”
2. Do not fork a second enrollment app for DPC. Same wizard, plan-type config.
3. Do not treat CRM Accounts as employers without sponsor/eligibility/invoice lifecycles.
4. Do not overload `advisors` into clinic affiliates.
5. Do not use `vendor_eligibility_runs` for employer files.
6. Do not cancel-and-recreate as the only plan-change path once layered memberships exist.
7. Do not claim group invoicing = employer billing.

---

## Risk, rollback, verification

**Risks:** money (double bill, wrong sponsor amount), eligibility drift (ghost coverage), person-dupe on match miss, PHI in employer files.

**Rollback:** tables additive; jobs kill-switch; drop FKs + tables if unused; feature works only when `sponsors` rows exist.

**Verify each packet:** unit fixtures (quotes, cutoff, match, coverage), RLS two-tenant + anon, dry-run row counts, one pilot sponsor.

**Production writes:** migration file in repo is not a live apply. Pause for explicit approval before `supabase db push` / MCP `apply_migration`.

---

## 90-day sequence (after this slice)

| Window | Ship |
|---|---|
| Days 1–30 (this slice) | Packets 1–6 + slug repair |
| Days 31–50 | Packets 8–11 (rate/coverage + invoice OS) |
| Days 51–75 | Packets 12–14 (layered + packages + shop) |
| Days 76–90 | Packets 15–17 (EN/ES, docs, public API); pilot one employer |

---

## Implementation notes for this slice (2026-09-13)

### Live discovery (pre-apply, then post-apply 2026-09-13)

- Project: PIF-ECO-V2 (`sffisarikcreyyjzdjvb`)
- Pre-apply: no `sponsors` / `sponsorships`; landing/invoices/memberships lacked sponsor columns
- Post-apply: sponsor tables exist; additive columns present; **0** sponsor rows
- Existing enrollments (1098) / memberships (1) / invoices (0) unchanged
- Admin `/enroll/[slug]` and member-portal `/enroll/[slug]` both host the wizard
- Member-portal `/employer` is the sponsor-admin console

### This-slice files (applied to PIF-ECO-V2 2026-09-13)

Remote migration names: `sponsor_os`, then `sponsor_os_hardening`.
Repo files: `supabase/migrations/20260913182802_sponsor_os.sql`,
`supabase/migrations/20260913193000_sponsor_os_hardening.sql`.

Hardening: revoke `TRUNCATE`/`REFERENCES`/`TRIGGER` from `authenticated` on
sponsor tables; enforce `dependent_cap` and single-plan at the DB.

- `supabase/migrations/20260913182802_sponsor_os.sql` — additive, idempotent, RLS, RPCs
- `packages/lib/src/sponsors/` — match, cutoff, roster import, eligibility end, invoice
- Admin `/sponsors` — list, create, detail (plans, roster, invoices, admins)
- Member-portal slug wizard repair + sponsor match on submit
- Member-portal `/employer` — sponsor-admin roster + invoices
- Cron `/api/cron/apply-sponsor-eligibility`
- Tests for match / cutoff / invoice lines / eligibility end
- `CONTEXT.md` glossary: Sponsor, Roster, Sponsorship

### Out of this slice

EAS SFTP, 834/EDI, coverage-rule charge engine, packages, layered memberships, POS, live invoice email, auto-invoice on recurring charge, EMR, DocuSign, public Hint-like API.
