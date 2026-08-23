# Live reality — 2026-08-22 (Road to Ten, Wave 0)

> RO-1 (read-only prod audit table) is owned by a separate item and had not
> returned findings when this file was created. The prod CONFIG snapshot it
> would have produced is captured instead in `scripts/e2e/fixture-shapes.json`
> (see "Local fixture" below) — config tables only, no record data.

## Local fixture (EV-2)

The walk harness runs against the LOCAL Supabase stack only
(`supabase db push` / `db reset` target PROD in this repo and are never used).
Three scripts under `scripts/e2e/` make the local stack a PIFH-shaped,
idempotent walk fixture:

| Script | What it does | Guard |
|---|---|---|
| `apply-local-migrations.sh` | Applies every `supabase/migrations/*.sql` newer than `max(schema_migrations.version)` and absent from the ledger, one `psql --single-transaction` per file, inserting the ledger row on success; failures roll back and are reported (`already exists`/`duplicate key` ERRORs → "already-present"). `--dry-run`, `--strict`, `--mark <version>` (record a ledger row for a file verified to be in effect, no SQL run). | refuses any DB host that is not 127.0.0.1/localhost (exit 2) |
| `dump-prod-fixture-shapes.mjs` | READ-ONLY snapshot of PIFH CRM config on prod → `fixture-shapes.json` (crm_modules, crm_fields, crm_views, crm_layouts, crm_feature_flags, crm_status_vocabulary + aggregate counts). Service-role key from env / `apps/crm/.env.local` / `.env`, never printed. No records, no PII. | read-only SELECTs |
| `seed-walk-fixture.mjs` | Idempotent seed (service-role supabase-js + psql): 3 auth users + profiles, feature flags (PIFH `crm.nav.simple=false`, asserts global `crm.layout.v2`), prod-mirrored modules/fields/views/layouts from `fixture-shapes.json`, fixture records (statuses pre-checked against `crm_status_vocabulary`), one legacy note; then a verification block incl. the real anon-key login path for all three users. `--verify-only` runs only the checks. | refuses any Supabase URL or DB URL not on 127.0.0.1/localhost (exit 2); never deletes |

`scripts/seed-local.mjs` (legacy, no localhost guard, prod-capable) was removed —
there is one local seeder now.

### Usage
```
# local stack already running (supabase start was done elsewhere; never run it from a worktree)
scripts/e2e/apply-local-migrations.sh          # bring the local ledger up to the repo
node scripts/e2e/seed-walk-fixture.mjs         # seed + verify (idempotent; re-run any time)
node scripts/e2e/seed-walk-fixture.mjs --verify-only
# refresh the prod config snapshot (read-only): node scripts/e2e/dump-prod-fixture-shapes.mjs
```
Defaults: API `http://127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
local demo service-role/anon keys. Override with `LOCAL_SUPABASE_URL`, `LOCAL_SERVICE_ROLE_KEY`,
`LOCAL_ANON_KEY`, `LOCAL_DB_URL`. Pointing either URL at prod exits 2 before any network call
(verified: `LOCAL_SUPABASE_URL=https://sffisarikcreyyjzdjvb.supabase.co node scripts/e2e/seed-walk-fixture.mjs` → exit 2).

### Fixture contract (shared with the harness)
| Item | Value |
|---|---|
| operator | `walk-operator@example.invalid` / `Walk-Operator-2026!` — profile role `staff`, `crm_role` `crm_agent`, org `0000…0001`, active |
| admin | `walk-admin@example.invalid` / `Walk-Admin-2026!` — role `admin`, `crm_role` `crm_admin` |
| viewer | `walk-viewer@example.invalid` / `Walk-Viewer-2026!` — role `staff`, `crm_role` `crm_viewer` |
| anchor contact | Wendy Walker · phone `5550107788` (unique, in the `phone` column) · `wendy.walker@example.invalid` · member_number `WALK-0001` · status `Active` · product `Sedera Access+` · sharing_entity `Sedera` · sharing_effective_date `2026-09-01` · producer_name `Wen Producer` (+ `producer_record_id` → the advisors record) · one legacy note |
| pending lane | 4 contacts with status `Pending`, created 60/41/23/9 days ago; oldest = **Pat Pending** (`5550107701`) |
| filler | 30 contacts (Active/Inactive/Cancelled/In Process) → 35 contacts total, pages at 25 |
| lead | Lee Lead (`5550107790`, status `New`) |
| advisor | Wen Producer (advisors module, advisor_code `WEN01`) |
| members module | 3 rows (Wendy Walker WALK-0001 Active, Mia Member WALK-0002 Active, Pat Pending WALK-0003 Pending) |
| flags | PIFH `crm.nav.simple=false` (owner decision: full shell); global `crm.layout.v2=true`; PIFH comms pilot flags mirrored from prod |
| PIN gate | cookie `lgq_ok` = future unix-epoch ms (`@crm-eco/ui/lib/pin-lock`) |
| login | `/crm-login` → `#email`, `#password`, `button[type=submit]` |

All fixture records carry `data.walk_fixture = true` and deterministic uuids
(sha1 of a fixed namespace + key), so re-runs update in place. Statuses used:
`Active`, `Pending`, `In Process`, `Inactive`, `Cancelled` (contacts/members) and
`New` (leads) — all in `crm_status_vocabulary` (the DB guard trigger
`crm_0_status_guard_trg` rejects anything else; `Approved Pending` from the
original plan is NOT allowed and was replaced by `Pending`).

### Local DB state after the 2026-08-22 run
- Ledger: 131 → 154 rows, max version `20260820120000` → `20260823003000`.
  22 files applied cleanly; `20260820150000_tighten_bulk_merge_and_age65_guards.sql`
  was already in effect (wrapper marker present — it had been psql-applied without
  a ledger row) and its re-run fails only because `20260820190000` later re-signed
  `private.apply_age_65_auto_cancellation_impl(uuid, uuid)`; recorded with `--mark`.
- `crm_fields`: 123 → 674 (551 prod-shaped rows inserted; 71 pre-existing rows
  aligned to prod label/type/section/options/order; local `members` keeps one
  extra seed.sql field → 95 vs prod 94).
- `crm_modules`: 8 (contacts, leads, members, advisors, accounts enabled; deals,
  prospects, enrollment_approval_test disabled — as prod).
- `crm_views`: 10 (prod ids; one `is_default` per module). `crm_layouts`: 8
  (one default per module; contacts/leads/members defaults carry the `core`
  section with `variant: 'hero'`; contacts `management`/`insurance`/`identifiers` open).
- `crm_records` (PIFH, live): 40 — contacts 35, leads 1, advisors 1, members 3.
  Status spread of fixture rows: Active 18 · Cancelled 5 · In Process 5 ·
  Inactive 5 · New 1 · Pending 5.
- `profiles`: 3 with `crm_role`; `organization_members`: 3 active; all three
  users sign in with the anon key and read their profile row through RLS.

## RO-1 — prod live reality for the PIFH org (read-only, from the config snapshot)

RO-1's own builder returned nothing, so the Wave-0 reviewer derived the six
precondition answers from `scripts/e2e/fixture-shapes.json` — the read-only prod
config snapshot written by `scripts/e2e/dump-prod-fixture-shapes.mjs` at
`2026-08-23T01:39:50Z` (PIFH org `00000000-0000-0000-0000-000000000001`; config
tables + aggregate counts only, no record data). Regenerate the snapshot with
`node scripts/e2e/dump-prod-fixture-shapes.mjs`, then re-read the table below.
Record-value questions (DE-9's product/producer counts) live in
`product-vocabulary-census-2026-08-22.md`.

| # | Precondition (plan RO-1) | Prod answer | Verdict |
|---|--------------------------|-------------|---------|
| 1 | `crm_layouts` leads/contacts/members: exactly one `is_default` row each, one section `variant: 'hero'`, contacts `management`/`insurance`/`identifiers` `collapsed=false` | contacts: 2 rows, 1 default ("Default Contact Layout", 27 sections, `core` is hero, management/insurance/identifiers all `collapsed=false`); leads: 2 rows, 1 default ("Default Lead Layout", 19 sections, `core` hero, management collapsed=true); members: 1 default ("Default Member Layout", 13 sections, `core` hero, insurance open, management collapsed=true). deals/prospects/accounts defaults have NO hero section (disabled or non-people modules). | PASS |
| 2 | `crm_views` `fdf7ae2b` ("All Members") sort + columns (default-sort truth for TE-3) | `is_default=true`, `sort=[{field:created_at, direction:desc}]`, columns `first_name, last_name, member_number, contact_status, plan_name, effective_date, city, referral, advisor_name, phone`. Every default view in the org sorts `created_at desc` (contacts `74bc3abf`, leads `550c7102`, accounts, deals, prospects). | PASS (recorded) |
| 3 | members fields `plan_name` / `effective_date` / `product` exist? contacts.`product` / leads.`product_type` options populated? `health_insurance_plan_name` type? | members.`plan_name` EXISTS (text, section coverage, label "Plan"); members.`effective_date` EXISTS (date, coverage); members.`sharing_effective_date` EXISTS (date, health_sharing); members.`product` MISSING (members carry no product field — LS-4 must read plan from `plan_name`). contacts.`product` EXISTS (text, section insurance, label "Membership / Plan") with **0 options**; leads.`product_type` EXISTS (text, section product, label "Membership / Plan") with **0 options**; contacts.`product_type` is a second "Product Type" text field (section main). `health_insurance_plan_name` is `text` on contacts/leads/members (0 options). | PASS (DE-1 precondition confirmed: options are empty today; DE-2 free text confirmed) |
| 4 | counts: `crm_advisors` (is_active), `crm_records` module advisors, `public.advisors` (DE-3) | `crm_advisors` active = **0**; `crm_records` advisors module = **18**; `public.advisors` = **672**. (DE-9 census: 17 of the 18 advisor records are duplicate "Wendy Scipione" rows.) | PASS (recorded; D5 backfill gap flagged in the census) |
| 5 | `crm_feature_flags` `crm.layout.v2` (global + org) and `crm.nav.simple` (org) | `crm.layout.v2` global `enabled=true` (no PIFH org override row); `crm.nav.simple` PIFH org row `enabled=false` (full shell, per D10). | PASS |
| 6 | `crm_modules` `is_enabled` + live field count per key (advisors navigable? deals/prospects disabled?) | contacts enabled (280 fields), leads enabled (169), members enabled (94), advisors **enabled** (10), accounts enabled (7), deals **disabled** (7), prospects **disabled** (106), enrollment_approval_test disabled (0). Record counts: contacts 14,144 · leads 1,127 · members 1,063 · advisors 18 · accounts 1 · deals/prospects 0. | PASS (advisors navigable; deals/prospects disabled → NV-2 redirect applies) |

Status vocabulary on prod (`crm_status_vocabulary`): contacts/members
`Active, Inactive, Pending, In Process, Cancelled, Terminated, Deceased, Prospect,
Lost, Declined, Abandoned`; leads `New, Attempted, Contacted, Qualified, Future
Prospect, In Process, Pending, Converted, Unqualified, Lost`. The local fixture
uses only values from these lists.
