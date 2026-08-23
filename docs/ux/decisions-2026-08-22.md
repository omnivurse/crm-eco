# Road to Ten — owner decision sheet (approved 2026-08-22)

Source plan: "PIFH CRM Road to Ten" (artifact d63ea5f6). All twelve questions were
put to the owner on 2026-08-22; **the owner approved the recommendation on every
one** ("lets go with your recommendations for all decisions"). This file is the
record implementers work from. Nothing outside this sheet changes a decided
behaviour (full navigation shell stays; status vocabulary stays; approved desk
order stays).

Standing constraints (apply to every item): no data loss, no record values
rewritten; prod is read-only except migrations applied through the playbook
(rehearse on the local stack via psql, then `supabase db push`, then verify);
the walk harness runs against the LOCAL stack only — `supabase db push` /
`db reset` target PROD and are never used for the walk; every new endpoint/RPC
ships with a two-tenant + anon isolation test.

| # | Question | Decision (= recommendation) | Unblocks |
|---|----------|-----------------------------|----------|
| D1 | After "Add Member", which list is THE list? What should the primary button on `/crm/modules/members` create? | **Option (c).** Contacts stays the hand-entry module. After save, toast `Member added · View in list` (sonner action) using `withReturnTo` back to the originating list (Contacts by default; Members when opened from `/crm/modules/members`, with an honest note that Members fills from enrollment). Keep the existing `New Member record` dropdown item. **Do not add a second member-create path.** | TE-4, EV-5 (T4 assertion) |
| D2 | May the "Pending" lane chip also sort `created_at asc`? Add a "Waiting since" column? Reserve a desk slot for the oldest Pending person? | **Yes** to chip sort (mirrors the desk's own `pendingContactsHref`). "Waiting since" column **optional** (skip unless cheap). **No** change to the approved desk order (overdue › today › starting soon › pending). | TE-3b |
| D3 | Health Sharing Membership (`product` / `product_type`): closed Select + "Other…" escape, or fully closed? Who maintains the list? DB guard? | **Select + explicit "Other…" free-text escape.** Admin-maintained via the existing field-options UI (`/api/crm/field-options`), seeded from the DE-9 census. Legacy values keep displaying (current-value option). **No DB guard now.** | DE-1, DE-9 |
| D4 | Health Insurance Plan: free text + org distinct-value suggestions, or bind to the `insurance_plans`/`insurance_carriers` catalog? | **Free text + DE-2 distinct-value suggestions** (carrier plan names are unbounded). | DE-2 |
| D5 | Producer / Enrolled-by source of truth? Store an id next to the name? Allow "add as typed"? | **CRM `advisors` crm_records module** (org-scoped, already in nav; `crm_advisors` is DB-commented DEPRECATED). Write `producer_record_id` alongside the existing `producer_name` display key (`producer_name` stays the written key — reports, the age-65 cron and ownership-name precedence keep working). Allow an explicit **"Not in list — add as typed"** row. | DE-3 |
| D6 | Record header: (a) remove the duplicate in-header global search (⌘K stays)? (b) hide Needs Classification / Needs Review badges from non-admins? (c) show "Add Tags" only on hover/focus for tagless records? (d) keep Timeline + Insights tabs visible by default? | **(a) yes, (b) yes, (c) yes, (d) keep as is** (the collapsed-by-default rail already resolves the "cockpit"). | RP-3, RP-4, RP-5 |
| D7 | Inline field save voice: silent check + aria-live "Saved", or a visual toast? | **Silent emerald check + aria-live "Saved"; no toast.** | RP-M1, EV-5 (T6) |
| D8 | Keep or retire the per-user Layout V1 toggle (profile page)? | **Retire.** V2 has been the global default since 202607140006; the walk measures V2 only. Delete `RecordDetailShell.tsx` (V1), `LayoutV2Toggle`, and the dead files (`modules/[moduleKey]/client.tsx`, `CrmHeader` + barrel export, `GlobalSearchOverlay`, duplicate `ClientProviders`) after a grep proves they are unreferenced. | FB-4 |
| D9 | Toast guard scope; export with zero rows; bulk titles; is the repo-wide codemod (FB-10) wanted before the walk? | Lint rule **error on walked-path globs, warn elsewhere**; the vitest **ratchet is the load-bearing guard**. **Disable Export** at zero rows (no info toast). Bulk titles **`Status updated · 12 records`** (plain, not arrows). **FB-10 is optional and AFTER the walk** — it conflicts with `toast-copy.ts:18-19` ("do NOT mass-edit") and the grader walks the persona path only. | FB-1, FB-2, FB-10 |
| D10 | Navigation: Pipeline link for deals-disabled orgs? People-section heading? Sticky tab vs removing the 16 cross-tab links? Palette pages: all vs curated? Mobile: drawer grid vs tab strip; bottom bar <lg? Gate admin-only Settings links for crm_agent? | **Remove Pipeline + redirect `/crm/pipeline`** when deals is disabled. Heading **"People"**. **Sticky tab now**, de-dup later. Palette: **all pages typed-only**, persona set shown idle. Mobile: **drawer grid, hide the tab strip and the bottom bar below lg**. **Gate Settings links** with the same predicate `settings/page.tsx` uses for cards. | NV-2, NV-3, NV-5, NV-6, NV-8, NV-M1 |
| D11 | Lists: lane-chip counts label vs filter-aware? Plan/Effective-date twin columns: disabled-for-filter vs server-side view? Remember page size? Move the leads converted-row guard into SQL? Hide Zoho-leftover filters / limit people view modes behind a flag? | **Label "of all {noun}" now + cache bust after bulk status change; filter-aware counts later.** Twins **disabled-with-reason now**, server-side view as a follow-up. **Yes** remember page size per user/module. **Yes** move the converted guard into SQL (pager honesty). **Yes** flag-gated trim, hidden-not-removed, lowest priority. | LS-4, LS-5, LS-7, LS-7b, LS-9 |
| D12 | Evidence: click budgets; fixture roles; CI gate mode; where the walk runs? | Budgets: T1 find-by-phone **2 keypresses + digits / 2 clicks**; T2 coverage **0**; T3 Add Note **1 click + ⌘Enter**; T4 Add Member **1 click + Enter (+ ≤1 to see on list)**; T5 oldest Pending → Call **1 (desk) / 2 (list)**; Apply Filter **≤3 (chip = 1)**; pager next **1**; rail toggle **1**. Fixture: **crm_agent primary, plus admin and viewer runs**. CI: **workflow_dispatch first, required check after two green runs**. Runs on the **local stack only — never prod, never Vercel previews** (EV-8 dropped). | EV-2, EV-5, EV-7 |

## Refuted / already closed at HEAD (no work)
- "Advisors & Agents" label confusion — label is "Advisors" (0 hits).
- "+ Create → Deal" — absent from `SplitCreateButton`; gated in bottom bar / palette.
- "41 system presets lead the filter rail" — Fields section leads; 19 presets are `defaultHidden`.
- `STATUS_LANES` and the Members-vs-Roster lexicon are consistent.

## Explicit non-goals
- Re-enabling `crm.nav.simple` for PIFH (owner decided full shell).
- Rewriting any record's stored status / product / producer value (read-side only; census + picklists only).
- A Vercel-preview or prod walk.
