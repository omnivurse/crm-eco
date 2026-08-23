# Product / producer vocabulary census — PIFH (prod, read-only) — 2026-08-22

**Status: PROPOSED — awaiting owner sign-off. Nothing has been written to prod.** This is the DE-9 decision sheet (Road to Ten, Wave 0), built the way the status-vocabulary sheet (bc7c6c05) was: census every live record, cluster the spellings, propose one canonical spelling per cluster, and ask the owner to approve the exact list before any `crm_fields.options` write. The binding decisions are D3 / D4 / D5 in [decisions-2026-08-22.md](decisions-2026-08-22.md).

| Decision | Owner ruling (22 Aug) | What this sheet settles |
|---|---|---|
| D3 | Health Sharing Membership (`contacts.product`, `leads.product_type`) = closed **Select + "Other…"** escape, admin-maintained via the existing field-options UI (`/api/crm/field-options`), seeded from this census. Legacy values keep displaying (current-value option). No DB guard now. | **The exact seed list** (section 1) |
| D4 | Health Insurance Plan stays **free text + distinct-value suggestions**. | Confirms the long tail (section 3); no list to approve |
| D5 | Producer store = CRM **`advisors` crm_records module**; write `producer_record_id` alongside `producer_name`; "Not in list — add as typed" row. | Producer vocabulary size + how much of it resolves to an advisor record today (section 2) |

## Headline numbers

- Source: org `00000000-0000-0000-0000-000000000001` on prod, **16,284 live `crm_records`** (contacts 14,076 · leads 1,127 · members 1,062 · advisors 18), read 2026-08-23 01:44 UTC.
- **Product:** `contacts.product` **83** distinct raw spellings on 12,775/14,076 contacts (90.8 %); `leads.product_type` **16** on 799/1,127 leads (70.9 %); `members.plan_name` **0** (members carry no plan text in `crm_records` at all). Together **91 raw spellings → 68 clusters**; 11 clusters fold more than one spelling (case / double spaces / plan code / plan year). **Tier A = 43 clusters with ≥ 10 records = 13,493 of 13,574 valued records (99.4 %)**; tier B = 25 long-tail clusters (81 records).
- **Producer:** `producer_name` **655** distinct raw spellings on 13,939 records (contacts 13,131 + leads 808; members have no `producer_name` field — they carry `advisor_name`, 2 values, 1,056× "Wendy Scipione"). 318 spellings are used exactly once (the "Advisor - Client Company" group-business pattern). Person clustering → **554 clusters** (35 fold 2+ spellings).
- **Producer ↔ advisor stores:** the D5 target (CRM `advisors` module) holds **18 records — 17 are "Wendy Scipione" duplicates + 1 other** — so only **1/655 spellings (0.2 %) / 21.6 % of records** resolve there today. `public.advisors` (the Zoho producer roster, 672 rows, all `is_active`, 177 composite "Name - Company" rows; `crm_advisors` = 0 rows, DEPRECATED) matches **631/655 raw spellings (96.3 %) = 13,154 records (94.4 %)**; by cluster **540/554 (94.6 % of records)**. The 14 unmatched clusters total 750 records (see 2.3).
- **Health Insurance Plan:** **11** distinct names on **18** records (contacts 9, leads 8, members 1); 5 used once. Long tail confirmed; stays free text (D4).

## How it was produced (re-runnable, read-only)

```bash
# from the repo root; reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from apps/crm/.env.local (prod), never prints the key
node scripts/audit-crm-product-vocabulary.mjs                                  # report only
node scripts/audit-crm-product-vocabulary.mjs --json scripts/e2e/product-options.proposed.json   # + machine-readable proposal
node scripts/audit-crm-product-vocabulary.mjs --md /tmp/census-tables.md --top 130               # + the tables below
node scripts/audit-crm-product-vocabulary.mjs --min-count 10                                     # tier-A threshold (default 10)
```

`scripts/audit-crm-product-vocabulary.mjs` is a copy of `scripts/audit-crm-vocabulary.mjs` (same env lookup, PostgREST client, 1000-row pages, org filter, `deleted_at is null`). It reads `crm_modules`, `crm_fields`, `crm_records` (+ `public.advisors`, `crm_advisors` counts) and writes nothing; it always exits 0 because it is a census, not a check. A `package.json` alias (`audit:crm-product-vocabulary`) is deliberately **not** added in this wave (no package.json edits in Wave 0); until Wave 1 adds it, the plan's acceptance line reads `node scripts/audit-crm-product-vocabulary.mjs`.

Machine-readable twin: [`scripts/e2e/product-options.proposed.json`](../../scripts/e2e/product-options.proposed.json) — `options[]` (value, label, tier, display_order, counts, raw spellings), `producers` (stats + `cluster_list`), `health_insurance_plan_name` stats, and the `crm_fields.id` of `contacts.product` / `leads.product_type` / `members.plan_name` so DE-1 and the local fixture can target the right rows.

### Clustering rules (deterministic, in the script)
- **Product cluster key:** trim + collapse whitespace → lower-case → strip a trailing plan code `(45800)` / `- 35768` → strip a plan year `20xx` → fold `co-pay`/`copay`, `care +`/`care plus`, `mec +`/`mec+` → dashes and `.,'"*:;` become spaces. **Vendor prefixes are NOT folded** (`MPowering Care Plus` ≠ `MPB Care Plus` ≠ `Care Plus` — different plan codes, so treated as different products until the owner says otherwise). `(GROUP)` / `Groups` variants stay separate for the same reason.
- **Proposed label:** the most frequent raw spelling in the cluster minus code/year, with all-caps spellings title-cased acronym-aware (`CARE PLUS (42464)` → `Care Plus`; `MEC+ ESSENTIALS (45388)` → `MEC+ Essentials`).
- **Producer cluster key:** the *person* part of `Advisor - Client Company`, `Company - Advisor`, `Advisor MPB Leads`, `Advisor/Company` (split only on a hyphen with an adjacent space or a slash, so `Adams-Waneka` survives; a part that looks corporate — inc/llc/group/leads/… — is not the person). Known residue: hyphen-without-space composites such as `Christine Corsini-Caribou Creek Log Homes, INC` and `Helen Diane Border` vs `Diane Border` stay separate clusters, so 554 is a slight over-count of real people/entities.
- **Advisor match:** strict name key (lower-case, alphanumerics) of each raw spelling and of the cluster key against `crm_records` advisors titles / `first_name last_name`, and against `public.advisors.full_name` / `first_name last_name` (live rows).

---

## 1. Health Sharing Membership — proposed `crm_fields.options` (D3)

**Proposal:** one shared option list for `contacts.product` (field id `d5496922-9252-45f8-8587-6058720be2c5`) and `leads.product_type` (`8c2c34b2-ea50-4845-8633-68c4d8e805a9`), seeded with the **43 tier-A labels below in this order (display_order = rank)**, plus the UI-level **"Other…"** free-text escape from D3. Tier-B clusters (25 labels, 81 records) are **not** seeded — they keep displaying through DE-1's current-value option and an admin can promote any of them later via the field-options UI. No record value is rewritten; the "Raw spellings" column is the legacy → option mapping DE-1 uses to pre-select the current value.

`members.plan_name` (`64ba9a0a-78e5-46d9-8873-13a673a13715`) is **not** part of this write: the members module has no plan text in `crm_records.data` (0 of 1,062); members' plan lives on the membership/enrollment tables, not in this field.

### 1.1 Tier A — proposed picklist (≥ 10 records, 99.4 % of valued records)

| # | Tier | Proposed option | Total | contacts | leads | members | Raw spellings folded into it (count) |
|---|:---:|---|---:|---:|---:|---:|---|
| 1 | A | Health Sharing | 2654 | 1951 | 703 | 0 | `Health Sharing` (2654) |
| 2 | A | Secure HSA | 2604 | 2601 | 3 | 0 | `Secure HSA (45800)` (1897), `Secure HSA 2024 (42467)` (694), `Secure HSA` (5), `SECURE HSA 2024 (42467)` (5), `Secure HSA (3278)` (2), `SECURE HSA (42467)` (1) |
| 3 | A | Care Plus | 1100 | 1100 | 0 | 0 | `Care Plus 2024 (42464)` (416), `CARE PLUS (42464)` (364), `CARE + (31103)` (317), `Care Plus (31103)` (2), `Care Plus 2024 (10337)` (1) |
| 4 | A | Health Insurance | 907 | 848 | 59 | 0 | `Health Insurance` (907) |
| 5 | A | MPowering Secure Care | 655 | 655 | 0 | 0 | `MPowering Secure Care - 35768` (650), `MPowering Secure Care   (35768)` (5) |
| 6 | A | Secure | 625 | 625 | 0 | 0 | `SECURE (31119)` (625) |
| 7 | A | Premium HSA | 532 | 531 | 1 | 0 | `Premium HSA (44036)` (530), `Premium HSA` (2) |
| 8 | A | To Be Determined | 497 | 497 | 0 | 0 | `To Be Determined` (497) |
| 9 | A | MPowering Care Plus | 476 | 473 | 3 | 0 | `MPowering Care Plus - 35693` (468), `MPowering Care Plus (35693)` (5), `MPowering CARE +` (3) |
| 10 | A | MPB Group Plan (Individual) | 418 | 418 | 0 | 0 | `MPB Group Plan (Individual)` (418) |
| 11 | A | Premium Care | 404 | 402 | 2 | 0 | `Premium Care (43957)` (398), `Premium Care` (5), `Premium care` (1) |
| 12 | A | Partially Self Directed | 398 | 398 | 0 | 0 | `Partially Self Directed  (27198)` (398) |
| 13 | A | MPB CareZ - Worksite - Bridge | 303 | 303 | 0 | 0 | `MPB CareZ - Worksite - Bridge (30445)` (303) |
| 14 | A | Secure Care - Zion Essential with HSA MEC | 268 | 268 | 0 | 0 | `Secure Care - Zion Essential with HSA MEC (40416)` (268) |
| 15 | A | Provider Directed - Redirect | 205 | 205 | 0 | 0 | `Provider Directed - Redirect (27201)` (205) |
| 16 | A | MPowering Direct Care | 147 | 147 | 0 | 0 | `MPowering Direct Care - 35770` (144), `MPowering Direct Care (35770)` (3) |
| 17 | A | Healthcare Essentials | 143 | 143 | 0 | 0 | `Healthcare Essentials (37520)` (143) |
| 18 | A | Direct | 140 | 140 | 0 | 0 | `DIRECT  (42465)` (58), `Direct 2024 (42465)` (51), `DIRECT (31120)` (31) |
| 19 | A | MEC+ Essentials | 128 | 128 | 0 | 0 | `MEC+ ESSENTIALS (45388)` (119), `MEC+ Essentials (45388)` (8), `MEC + Essentials (45388)` (1) |
| 20 | A | Self Directed Plan | 119 | 119 | 0 | 0 | `Self Directed Plan (27197)` (119) |
| 21 | A | Co-Pay Plan | 91 | 91 | 0 | 0 | `Co-Pay Plan (27199)` (91) |
| 22 | A | Group Health Insurance | 70 | 70 | 0 | 0 | `Group Health Insurance` (70) |
| 23 | A | MPB Direct | 66 | 66 | 0 | 0 | `MPB Direct (27200)` (65), `MPB Direct   (27200)` (1) |
| 24 | A | Redirect Health Plan (GROUP) | 64 | 64 | 0 | 0 | `Redirect Health Plan (GROUP)` (64) |
| 25 | A | Essentials | 49 | 48 | 1 | 0 | `ESSENTIALS (42463)` (31), `Essentials 2024 (42463)` (17), `Essentials` (1) |
| 26 | A | Insurance | 43 | 43 | 0 | 0 | `Insurance` (43) |
| 27 | A | OPD Complete | 38 | 38 | 0 | 0 | `OPD Complete (32399)` (38) |
| 28 | A | MPB CareZ - Worksite | 37 | 37 | 0 | 0 | `MPB CareZ - Worksite (29870)` (37) |
| 29 | A | MPB CareZ -Connected Worksite | 35 | 35 | 0 | 0 | `MPB CareZ -Connected Worksite (30658)` (35) |
| 30 | A | MPB Care | 33 | 33 | 0 | 0 | `MPB Care (28009)` (33) |
| 31 | A | MPB Care Plus | 30 | 30 | 0 | 0 | `MPB Care Plus (28201)` (30) |
| 32 | A | Minimum Essential Coverage (MEC) Included | 26 | 26 | 0 | 0 | `MINIMUM ESSENTIAL COVERAGE (MEC) INCLUDED (43960)` (26) |
| 33 | A | Partially Self Directed (GROUP) | 25 | 25 | 0 | 0 | `Partially Self Directed (GROUP)` (25) |
| 34 | A | Sedera Select+ (Modified) T1 -Self Directed- | 25 | 25 | 0 | 0 | `Sedera Select+ (Modified) T1 -Self Directed-` (25) |
| 35 | A | Co-Pay Plan (GROUP) | 24 | 24 | 0 | 0 | `Co-Pay  Plan (GROUP)` (24) |
| 36 | A | MPB Care Plus CV | 23 | 23 | 0 | 0 | `MPB Care Plus CV (30443)` (23) |
| 37 | A | Sedera Select+ (Modified) T2 - Partially Self Directed | 18 | 18 | 0 | 0 | `Sedera Select+ (Modified) T2 - Partially Self Directed` (18) |
| 38 | A | Secure Care -Co-Pay | 15 | 15 | 0 | 0 | `Secure Care -Co-Pay (40934)` (15) |
| 39 | A | MPB Secure - REDIRECT | 14 | 14 | 0 | 0 | `MPB Secure - REDIRECT (28519)` (14) |
| 40 | A | MPowering HSA MEC - For Secure Care | 12 | 12 | 0 | 0 | `MPowering HSA MEC - For Secure Care (38418)` (12) |
| 41 | A | Secure Copay | 12 | 12 | 0 | 0 | `Secure Copay 2024 (42469)` (12) |
| 42 | A | MPowering Direct | 10 | 0 | 10 | 0 | `MPowering Direct` (10) |
| 43 | A | Other (dental, vision etc.) | 10 | 10 | 0 | 0 | `Other (dental, vision etc.)` (10) |

### 1.2 Tier B — long tail, NOT seeded (display-only via current-value option)

| # | Tier | Proposed option | Total | contacts | leads | members | Raw spellings folded into it (count) |
|---|:---:|---|---:|---:|---:|---:|---|
| 44 | B | MPB CareZ - Individual | 9 | 9 | 0 | 0 | `MPB CareZ - Individual (29795)` (9) |
| 45 | B | DPC Plan (GROUP) | 6 | 6 | 0 | 0 | `DPC  Plan (GROUP)` (6) |
| 46 | B | MPB Group Plan (RETAINED) | 6 | 6 | 0 | 0 | `MPB Group Plan (RETAINED)` (6) |
| 47 | B | Our Primary Doc. | 6 | 6 | 0 | 0 | `Our Primary Doc.` (6) |
| 48 | B | Sedera Group Plan | 5 | 5 | 0 | 0 | `Sedera Group Plan` (5) |
| 49 | B | MPowering Care | 4 | 4 | 0 | 0 | `MPowering Care - 28009` (4) |
| 50 | B | MPowering SECURE | 4 | 0 | 4 | 0 | `MPowering SECURE` (4) |
| 51 | B | OPD | 4 | 0 | 4 | 0 | `OPD` (4) |
| 52 | B | Redirect Health Plan | 4 | 0 | 4 | 0 | `Redirect Health Plan` (4) |
| 53 | B | Sedera Select+ (Modified T3) - Redirect Health | 4 | 4 | 0 | 0 | `Sedera Select+ (Modified T3) - Redirect Health` (4) |
| 54 | B | Sedera Select+ (Modified) T3 - Direct DPC Care | 4 | 4 | 0 | 0 | `Sedera Select+ (Modified) T3 - Direct DPC Care` (4) |
| 55 | B | VPC - BowTie Health (ASSOC) | 4 | 4 | 0 | 0 | `VPC - BowTie Health (ASSOC)` (4) |
| 56 | B | MPowering Co-Pay MEC - Advanced MEC for Secure | 3 | 3 | 0 | 0 | `MPowering Co-Pay MEC - Advanced MEC for Secure (38458)` (3) |
| 57 | B | SECURE COPAY Groups | 3 | 3 | 0 | 0 | `SECURE COPAY 2024 Groups (42553)` (3) |
| 58 | B | DPC Plan | 2 | 2 | 0 | 0 | `DPC Plan` (2) |
| 59 | B | Health Sharing and Health Insurance Combo | 2 | 1 | 1 | 0 | `Health Sharing and Health Insurance Combo` (2) |
| 60 | B | Life X 1500 PPO | 2 | 1 | 1 | 0 | `Life X 1500 PPO` (2) |
| 61 | B | Medicaid or C4HCO | 2 | 1 | 1 | 0 | `Medicaid or C4HCO` (2) |
| 62 | B | CARE PLUS Groups | 1 | 1 | 0 | 0 | `CARE PLUS 2024 Groups (42551)` (1) |
| 63 | B | DIRECT Groups | 1 | 1 | 0 | 0 | `DIRECT 2024 Groups (42552)` (1) |
| 64 | B | MPB CareZ - ConnectedWorksite-DPC | 1 | 1 | 0 | 0 | `MPB CareZ - ConnectedWorksite-DPC (30659)` (1) |
| 65 | B | Premium HSA or Premium Care | 1 | 0 | 1 | 0 | `Premium HSA or Premium Care` (1) |
| 66 | B | Proposed Secure HSA | 1 | 0 | 1 | 0 | `Proposed Secure HSA` (1) |
| 67 | B | Regional Care MEC | 1 | 1 | 0 | 0 | `Regional Care MEC (43960)` (1) |
| 68 | B | Sedera Select+ (Modified) T2 - Co-Pay Network Plan | 1 | 1 | 0 | 0 | `Sedera Select+ (Modified) T2 - Co-Pay Network Plan` (1) |

### 1.3 Things the owner should look at before approving

1. **Category words live next to plan names.** `Health Sharing` (2,654), `Health Insurance` (907), `Insurance` (43), `Group Health Insurance` (70), `To Be Determined` (497) are market categories, not memberships; 703 of 799 valued leads just say `Health Sharing`. Proposal keeps them as options (they are what people type today) — say if you want them dropped, merged (`Insurance` → `Health Insurance`?) or moved to `market_type`.
2. **Same family, different vendor prefix / code** — kept separate on purpose: `Care Plus` · `MPowering Care Plus` · `MPB Care Plus` · `MPB Care Plus CV`; `Direct` · `MPowering Direct Care` · `MPB Direct` · `MPowering Direct` (leads); `Secure` · `Secure HSA` · `MPowering Secure Care` · `Secure Care - Zion Essential with HSA MEC` · `Secure Copay` · `MPowering SECURE` (leads); `Essentials` · `Healthcare Essentials` · `MEC+ Essentials`. Tick which (if any) should collapse into one option.
3. **Plan codes and years are dropped from the label** (`Secure HSA (45800)` and `Secure HSA 2024 (42467)` both → `Secure HSA`). If the code matters operationally, say so and the label keeps it (the raw spellings are all preserved either way).
4. **`Secure` (625, code 31119)** is a different code from `Secure HSA` — left as its own option; confirm it is a real product and not a truncation.
5. Leads-only words `MPowering Direct` (10), `MPowering SECURE` (4), `OPD` (4), `Redirect Health Plan` (4) are probably the contacts' `MPowering Direct Care` / `MPowering Secure Care` / `OPD Complete` / `Redirect Health Plan (GROUP)` — confirm and they fold.
6. `contacts.product_type` is a **second** "Product Type" field on contacts (6 values, 28 records — mostly `Health Sharing`) that duplicates `product`; recommend hiding it from the form (not part of this write).
7. `members.plan_name` stays untouched (see above).

**Open question for the owner: approve this exact tier-A list (or mark the edits) before the prod `crm_fields.options` write.** The write itself is a Wave-1 migration (DE-1; `20260822150000` pattern, previous options kept in `metadata`), not part of this wave.

---

## 2. Producer / Enrolled by (D5 context)

### 2.1 Vocabulary
- `contacts.producer_name`: 655 distinct on 13,131/14,076 records · `leads.producer_name`: 6 distinct on 808/1,127 (leads also carry `producer`, 6 values, 856 records — same names) · members: no `producer_name` field; `advisor_name` 1,057 records, 2 values.
- 655 raw spellings → **554 person clusters**; 318 spellings are used once; 35 clusters fold 2+ spellings (e.g. Wendy Scipione 12 spellings / 3,056 records; Misty Berryman 9 / 439; Christine Corsini 9 / 313; Karen Torsoe 8 / 333; Cindy Gordon 8 / 161).
- The long tail is the **group-business pattern** (`Advisor - Client Company`): the producer field doubles as the "which employer group" field. The D5 "add as typed" row will keep feeding this unless DE-3 splits the company out (see 2.4).

### 2.2 Match against the advisor stores (counts)

| Store | Rows | Raw spellings matched | Records covered | Clusters matched | Records covered (cluster) |
|---|---:|---:|---:|---:|---:|
| CRM `advisors` crm_records module (**D5 target**) | 18 (17× "Wendy Scipione" + 1) | 1/655 (0.2 %) | 3,012 (21.6 %) | 1/554 | 3,056 (21.9 %) |
| `public.advisors` (legacy roster, org-scoped) | 672 live / 672 | 631/655 (96.3 %) | 13,154 (94.4 %) | 540/554 | 13,189 (94.6 %) |
| `crm_advisors` (DB-commented DEPRECATED) | 0 | — | — | — | — |

Reading: `public.advisors` is effectively the Zoho producer list (its 672 names include the composite "Name - Company" spellings, which is why 631 raw spellings match exactly), while the D5 target module is nearly empty and duplicated. All 18 advisors-module titles also exist in `public.advisors`.

### 2.3 Clusters with no advisor row anywhere (14, 750 records)

| Producer cluster | Records |
|---|---:|
| Leonardo Moraes | 284 |
| John Kach | 198 |
| Tupac Manzanarez | 103 |
| C. Rod Maxson | 98 |
| Adam Jordano | 43 |
| House Account | 13 |
| Leonardo Moraes-Cali Electric Motors, Inc. | 2 |
| Manzo Jordano Moraes Benefits | 2 |
| Westline Woodcraft | 2 |
| Benjamin Kelly | 1 |
| JD Mass | 1 |
| Keith Jordano | 1 |
| Managed medical llc | 1 |
| NAKA, LLC | 1 |

### 2.4 What this means for D5 / DE-3 (flag, not a decision)
- The D5 store needs a **backfill** before `producer_record_id` can cover today's data: dedupe the 17 duplicate "Wendy Scipione" records in the advisors module, then load the 554 person clusters (or the 672 `public.advisors` rows, which carry `advisor_code`/agency/NPN) into the module. Without it, the picker would offer 2 names for 13,939 records and every other save would go through "add as typed". This is DE-3 / Wave-1 scope; it needs its own owner go (it creates advisor records).
- Decide whether the **client company** half of `Advisor - Company` should move to its own field (`group_name` / account link) when DE-3 writes `producer_record_id`; otherwise the "add as typed" row recreates the 318-singleton tail.
- `producer_name` stays the written display key (reports, the age-65 cron, ownership-name precedence) — unchanged by this sheet.

### 2.5 Top 40 producer clusters (counts)

| # | Producer (person cluster) | Records | In CRM advisors module | In public.advisors | Spellings |
|---|---|---:|:---:|:---:|---|
| 1 | Wendy Scipione | 3056 | yes | yes | 12 |
| 2 | Jane Kassel | 794 | — | yes | 3 |
| 3 | Louis Spatafore | 455 | — | yes | 1 |
| 4 | Misty Berryman | 439 | — | yes | 9 |
| 5 | Wiley Long | 434 | — | yes | 3 |
| 6 | Michael Montes | 404 | — | yes | 2 |
| 7 | Jeff Kanter | 358 | — | yes | 1 |
| 8 | Jonathan Masters | 338 | — | yes | 2 |
| 9 | Karen Torsoe | 333 | — | yes | 8 |
| 10 | Christine Corsini | 313 | — | yes | 9 |
| 11 | Analisa Cleland | 290 | — | yes | 1 |
| 12 | Leonardo Moraes | 284 | — | — | 6 |
| 13 | Leslie Jablonski | 233 | — | yes | 3 |
| 14 | Whitney Kline | 208 | — | yes | 5 |
| 15 | Stephen McBrayer | 205 | — | yes | 1 |
| 16 | Patti Baron | 204 | — | yes | 1 |
| 17 | Leslie Alford | 201 | — | yes | 6 |
| 18 | John Kach | 198 | — | — | 1 |
| 19 | Robin Kemp | 176 | — | yes | 1 |
| 20 | RREMC | 172 | — | yes | 1 |
| 21 | Andrea Hinman | 166 | — | yes | 1 |
| 22 | Cindy Gordon | 161 | — | yes | 8 |
| 23 | Kari Gray | 147 | — | yes | 1 |
| 24 | Jill Clark | 136 | — | yes | 2 |
| 25 | Ronald Patterson | 118 | — | yes | 1 |
| 26 | Charles Frohman | 113 | — | yes | 2 |
| 27 | Joan Phelps | 113 | — | yes | 2 |
| 28 | Wellness Works Group | 105 | — | yes | 1 |
| 29 | Tupac Manzanarez | 103 | — | — | 2 |
| 30 | Kirk Bennett | 99 | — | yes | 6 |
| 31 | C. Rod Maxson | 98 | — | — | 1 |
| 32 | Darius Kohanim | 92 | — | yes | 1 |
| 33 | Jan Capodi | 88 | — | yes | 1 |
| 34 | Diane Border | 86 | — | yes | 5 |
| 35 | Jeff Edwards | 85 | — | yes | 1 |
| 36 | Mel Fonseca | 84 | — | yes | 5 |
| 37 | Paul Cholak | 84 | — | yes | 1 |
| 38 | Guy Travis | 83 | — | yes | 1 |
| 39 | Kirsten Vastine | 80 | — | yes | 1 |
| 40 | Kevin Michaels | 76 | — | yes | 1 |

Full list (554 clusters, with the spellings folded into each multi-spelling cluster) is in the JSON twin under `producers.cluster_list`.

---

## 3. Health Insurance Plan (`health_insurance_plan_name`) — stays free text (D4)

11 distinct names on 18 records (contacts 9, leads 8, members 1); 5 used once; two of the values (`Secure HSA`, `Premium Care`) are health-share memberships typed into the insurance-plan field — the DE-2 suggestion list will surface the carrier names, and the misfiles are for the client to correct by hand. No picklist, no write.

| Plan name (raw) | Records |
|---|---:|
| Select Health Value Silver $3400 Medical Deductible Silver/EPO | 3 |
| Copay PPO $1500 Ded | 2 |
| RMHP Colorado Doctors Plan Bronze Copay Focus ($0 Virtual Urgent Care, No Referrals) | 2 |
| Secure HSA | 2 |
| Select Health Value Bronze $6900 Medical Deductible | 2 |
| Select Health Value Gold $1500 Medical Deductible | 2 |
| Anthem Colorado Option Gold Pathway Essentials Std | 1 |
| LifeX Cigna EPO $1500 Deductible | 1 |
| RMHP Valley Colorado Option Bronze | 1 |
| KP Colorado Option Silver Silver/HMO | 1 |
| Premium Care | 1 |

---

## 4. Adjacent keys seen on the way (context only)

| Key | Distinct / records | Note |
|---|---:|---|
| `contacts.product_type` | 6 / 28 | duplicate "Product Type" text field beside `product`; mostly `Health Sharing` — hide from the form later |
| `contacts.producer` | 1 / 25 | legacy twin of `producer_name` (all "Wendy Scipione") |
| `contacts.advisor_name` | 1 / 960 | enrollment-created contacts; all "Wendy Scipione" |
| `leads.producer` | 6 / 856 | same 6 names as `leads.producer_name` |
| `leads.advisor` / `leads.agent` | 2 / 14 · 1 / 11 | stragglers |
| `members.advisor_name` | 2 / 1,057 | "Wendy Scipione" ×1,056, "Enrollment Website API" ×1 |
| `members.plan_type` | 1 / 1 | `insurance` |
| `members.plan_name` | 0 / 0 | empty — members' plan is not in `crm_records.data` |

---

## Sign-off

- [ ] **Owner:** tier-A product list approved as written / with the edits marked above (section 1.1, questions 1–5).
- [ ] **Owner:** D5 backfill of the advisors module (section 2.4) goes on the Wave-1 list — yes / later.
- Then Wave 1 (DE-1) writes `crm_fields.options` for `contacts.product` + `leads.product_type` by migration (previous options kept in `metadata`), and the drawer / full form / inline cell show the list with "Other…".

*Numbers come from the `scripts/audit-crm-product-vocabulary.mjs` run of 2026-08-23T01:44:23.622Z (tables pasted from its `--md` output), plus a one-off read-only look at the 18 advisors-module titles and the 672 `public.advisors` names for the "17 duplicates" / "177 composite rows" remarks. Nothing was hand-typed from memory.*
