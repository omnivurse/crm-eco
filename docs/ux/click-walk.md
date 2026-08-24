# CRM click-walk harness (EV-1 / EV-3 / EV-4)

The click-walk is the evidence harness for the "Road to Ten" plan: a logged-in
Playwright run against the **local** Supabase stack that counts every click and
keypress per persona task, screenshots every step, and refuses to count anything
when a false-result trap fires. Budgets come from owner decision **D12**
(`docs/ux/decisions-2026-08-22.md`).

Everything lives in `apps/crm/e2e/`:

| File | Role |
|------|------|
| `playwright.config.ts` | runner — projects `desktop-1440`, `desktop-1280`, `tablet-1024`, `mobile-390`; builds and boots a **production** server (`next build` → `next start --port 3000`) pinned at the local stack. `WALK_DEV=1` swaps in `next dev` for a fast, loudly **ungraded** edit loop |
| `global-setup.ts` | pre-login traps → PIN cookie → `/crm-login` → storageState `.auth/<role>.json` → post-login traps → opens the run folder |
| `global-teardown.ts` | merges the run ledger into `walk.json` and validates it against `report/walk-schema.json` |
| `traps.ts` | every false-result trap + `assertTrapsInTest()` for per-project re-assertion |
| `walk-fixture.ts` | the `walk` fixture (`task` / `click` / `press` / `type` / `shot`) + the in-page trusted-event cross-check |
| `walk-counter.ts`, `walk-counter.test.ts` | pure counter logic + task outcome (soft mode) + vitest unit test |
| `walk-report.ts` | `walk.json` builder + minimal schema validator |
| `walk-helpers.ts` | EV-5 spec helpers (toast titles, request tracker, `tel:` stub, pager parser) — no counted actions live here |
| `nav-tabs.ts`, `nav-tabs.test.ts` | mirror of `resolveTopModuleFromPathname` for the nav walk + vitest that pins it to the app |
| `env.ts` | local keys, fixture contract, paths |
| `check-no-raw-actions.sh` | grep gate: no raw `page.click/press/fill` in `specs/**` |
| `specs/smoke.spec.ts` | EV-1 smoke (one task) |
| `specs/walk-persona.spec.ts` | EV-5 T1–T5 (find by phone, coverage at a glance, Add Note, Add Member + see on list, oldest Pending → Call) |
| `specs/walk-record.spec.ts` | EV-5 T6 inline patch (D7), header density at rest (D6), reload keeps the Notes pane |
| `specs/walk-lists.spec.ts` | EV-5 rail / lane chip / rail Apply / pager / Back restores / `?page=abc` / select-all / mobile sheet |
| `specs/walk-nav.spec.ts` | EV-5 tab + sidebar inventory, search-copy parity, cross-tab links (D10), palette, deals/pipeline redirects |
| `specs/walk-drawer.spec.ts` | EV-5 quick-create drawer: keyboard paste, duplicate card, invalid date, Pending lead, viewer persona |

## Run it

```sh
# prerequisites: `supabase start` stack running on 127.0.0.1:54321 / :54322 with the walk
# fixture seeded (scripts/e2e — see "Fixture contract"); chromium via `npx playwright install chromium`
npm run test:e2e                                   # repo root → apps/crm walk:crm
cd apps/crm && npm run walk:crm                    # same thing
cd apps/crm && npm run walk:crm:ui                 # Playwright UI mode
cd apps/crm && WALK_ROLE=admin npm run walk:crm    # admin persona (viewer: WALK_ROLE=viewer)
cd apps/crm && npx playwright test -c e2e/playwright.config.ts --project=desktop-1440
cd apps/crm && npm run walk:crm:unit               # counter unit test (vitest)
cd apps/crm && npm run walk:crm:check              # raw-action grep gate + tsc of e2e/ + lint:changed
cd apps/crm && npm run lint:changed                # no-NEW-lint-findings ratchet (see "Lint gate")
```

Ports: the app is `http://localhost:3000` (`WALK_BASE_URL` overrides). Locally the
runner reuses a server already on :3000 (`reuseExistingServer: !CI`) — if that
server is pointed at prod the **prod-guard** traps fail the run before login.

## Environment the runner forces onto the app server

`webServer.env` in `playwright.config.ts` (Next.js never overrides variables already
in `process.env`, so these beat `apps/crm/.env.local`). The whole `webServer.command`
runs under this block, so a graded run's `next build` inlines these `NEXT_PUBLIC_*`
values into the bundle it then serves — and `prod-guard-network` proves the browser
only ever reached `127.0.0.1`:

| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local demo anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | local demo service key (middleware HMAC + server routes) |
| `NEXT_PUBLIC_ENABLE_SESSION_LOCK`, `CRM_ENFORCE_MFA` | `''` (both are strict `=== 'true'` checks → off) |

Never run `supabase db push` / `db reset` / `link` for the walk — in this repo
they target PROD. The harness talks to the stack only through the app and
PostgREST on 127.0.0.1. `env.ts` refuses any Supabase host that is not
`127.0.0.1` / `localhost`.

## Fixture contract (seed ↔ harness; both sides use exactly this)

Org `00000000-0000-0000-0000-000000000001`, slug **`pifh-local`**, full shell
(`crm.nav.simple` = **false** for the org, mirroring prod + decision D10),
`crm.layout.v2` global = true.

| Role (`WALK_ROLE`) | Email | Password | `crm_role` |
|---|---|---|---|
| `operator` (default) | `walk-operator@example.invalid` | `Walk-Operator-2026!` | `crm_agent` |
| `admin` | `walk-admin@example.invalid` | `Walk-Admin-2026!` | `crm_admin` |
| `viewer` | `walk-viewer@example.invalid` | `Walk-Viewer-2026!` | `crm_viewer` |

All three: `profiles.role='staff'`, `organization_id` = the org, `is_active=true`.

Records (module `contacts` unless stated):
- **Anchor**: Wendy Walker · phone `5550107788` (unique **within contacts** — the `members` twin WALK-0001 carries the same phone on purpose, like prod contact/member twins; `findAnchorRecord` resolves the anchor to the contacts row) · `wendy.walker@example.invalid` · member_number `WALK-0001` · an allowed **Active-lane** status · a plan/product value · `sharing_effective_date 2026-09-01` · `producer_name 'Wen Producer'`.
- **Pending lane**: ≥ 3 contacts with an allowed Pending-lane status, `created_at` spread over days; oldest is **Pat Pending** (`5550107701`).
- **Total contacts ≥ 32** so the list pages at 25/page.
- One lead **Lee Lead**; one advisor record **Wen Producer** in the CRM `advisors` module.
- **Producers (Wave 1, DE-3)**: `public.advisors` rows **Wen Producer / Pat Producer / Pia Producer** for PIFH (the Enrolled-by picker source; `GET /api/crm/advisors`); the anchor carries `producer_record_id` = Wen's `public.advisors.id`. **Product options (DE-1)**: `contacts.product` and `leads.product_type` carry the 43 tier-A options from `scripts/e2e/product-options.proposed.json` LOCALLY (prod has 0 options until the gated migration) — `walk.type` on that `<select>` is type-ahead (`Health Sharing`).
- Statuses come from `public.crm_status_vocabulary` (DB-enforced).

Auth surfaces: PIN cookie `lgq_ok` = a future unix-epoch **milliseconds** value
(`Date.now() + 12h`, path `/`, not httpOnly — `packages/ui/src/lib/pin-lock.ts`);
login page `/crm-login` with `#email`, `#password`, `button[type=submit]`; success
navigates to `/crm`.

## Traps (EV-3) — fail loudly before counting anything

Each returns `{name, pass, detail}`; the first failure throws `TRAP:<name> — <detail>`,
writes `trap-<name>.png` into the run folder, and the row lands in `walk.json.traps`.

| Trap | Phase | What it proves |
|------|-------|----------------|
| `prod-guard` | pre-login | harness `NEXT_PUBLIC_SUPABASE_URL` host is 127.0.0.1/localhost **and** `organizations/0000…0001` slug is `pifh-local` (PostgREST, local service key, server-side only) |
| `pin-gate` | pre-login, in-test | `GET /crm` without `lgq_ok` → redirect to `/lock`; with the cookie jar the harness arms → not the PIN page (empty jar under `E2E_SKIP_PIN_COOKIE=1` fails here) |
| `pin-page` | pre/post-login, in-test | current document is not the disguise page (title ≠ "Lead Generation Quote System", no `input[aria-label^='PIN digit']`, path ≠ `/lock`) |
| `prod-guard-network` | post-login | every Supabase request the **browser** made during login went to the local stack (proves the dev server used the forced env) |
| `login` | post-login | landed on `/crm`, not `/crm-login?error=…` / `/crm-access-denied` |
| `no-lock-redirect` | post-login, in-test | no `/crm-login/mfa` step-up, no "Session Locked" overlay, no login bounce |
| `right-org` | post-login, in-test | every `/api/crm/modules` row has `org_id` = PIFH; no `?error=no_organization|no_crm_access` bounce |
| `nav-profile` | post-login, in-test | `nav[aria-label='Modules']` present → `full` shell (recorded in `env.navProfile`; on `mobile-390` only recorded) |
| `not-empty` | post-login, in-test | `/api/crm/search?q=5550107788` resolves the anchor; `/api/crm/records?module_key=contacts` total ≥ 32 |
| `status-vocab` | post-login, in-test | the anchor's status is an Active-lane value (and ∈ `crm_status_vocabulary` in setup) |
| `breakpoint` | post-login, in-test | desktop/tablet: viewport ≥ 1024 and the contacts filter rail/toggle (`aside[aria-label='Filter Contacts by']`) is visible; mobile: viewport < 768 and the `MobileActionBar` (`nav[aria-label='Quick actions']`) is visible on the record page |
| `layout-v2` | post-login, in-test | the record page renders the V2 chrome — `role=group[aria-label='Add note']` (`RecordDetailShellV2.tsx`) |

In a spec call `assertTrapsInTest({ page, request, bareRequest, project })`
**before** the first counted task (it navigates). It returns the anchor record and
the resolved nav profile.

## Counting rules (EV-4) and the `walk` fixture

```ts
import { test, expect } from '../walk-fixture';
test('T1 find by phone', async ({ page, walk }) => {
  await walk.task('T1', 'Find Wendy by phone', 2, async () => {
    await walk.press('Meta+k', 'open palette');           // 1 keypress (a chord counts once)
    await walk.type(page.getByRole('combobox'), '5550107788', 'type phone'); // typed chars, not keypresses
    await walk.press('Enter', 'open first hit');           // 1 keypress
    await walk.click(page.getByRole('link', { name: /Wendy/ }), 'open record'); // 1 click
  });
});
```

- `click` = one wrapped `walk.click()`; `press` = one wrapped `walk.press()` (⌘Enter = 1);
  `type` records characters separately (`typedChars`) and never counts as keypresses.
- An init script on every document counts **only** `event.isTrusted` `pointerdown` /
  `keydown` (bare modifier keydowns and keydowns during `walk.type` excluded), persisted
  in `sessionStorage` so navigations keep the tally. At task end the wrapper tally and the
  browser tally **must agree** or the task throws `walk tally mismatch` — a raw
  `page.click()` can never under-count silently. `check-no-raw-actions.sh` catches it
  statically too.
- `task(id, label, budget, fn)` resets tallies, times the task, screenshots every step
  (`shots/<project>/<test>/<task>/NN-<label>.png`, plus `end`/`error`), appends the
  record to the run ledger, then asserts `expect(clicks).toBeLessThanOrEqual(budget)`.
  Tasks do not nest; actions outside a task throw.
- `task(id, label, budget, fn, { soft: true })` (EV-5) — the task records `pass: false`
  plus a `reason` (the first assertion message, or `over click budget (n > budget)`) and
  the spec **continues** instead of failing. Soft tasks carry budgets/assertions about
  work a later wave ships (D1 "see on list", D6/D7 record header, D10 sticky tab, LS-*),
  so walk.json stays honest without aborting the walk. Harness integrity is never soft:
  a wrapper↔browser tally mismatch or a `walk.*` call outside a task still throws.
  `resolveTaskOutcome()` in `walk-counter.ts` is the pure rule (unit-tested).
- `note(key, value)` records a fact on the current task (`tasks[].notes` in walk.json —
  counts, hrefs, observed copy, the field T6 patched, …). String/number/boolean/null only.

## Reading `walk.json`

Every run writes `apps/crm/e2e/artifacts/crm-walk/<ISO timestamp>/walk.json`
(`artifacts/crm-walk/latest.txt` points at the newest) validated against
`apps/crm/e2e/report/walk-schema.json`:

```jsonc
{
  "commit": "<git rev-parse HEAD of the worktree>",
  "startedAt": "…", "finishedAt": "…",
  "env": { "baseURL": "http://localhost:3000", "supabaseUrl": "http://127.0.0.1:54321",
           "navProfile": "full", "layoutV2": true, "viewport": "1440x900",
           "project": "desktop-1440,tablet-1024,mobile-390", "role": "operator" },
  "traps": [ { "name": "prod-guard", "pass": true, "detail": "…", "phase": "pre-login" }, … ],
  "tasks": [ { "id": "T1", "label": "…", "clicks": 2, "keypresses": 2, "typedChars": 10,
               "ms": 1840, "budget": 2, "pass": true, "soft": false, "project": "desktop-1440",
               "viewport": "1440x900", "test": "…",
               "steps": [ { "label": "open palette", "shot": "shots/…/01-open-palette.png", "kind": "press", "ms": 120 } ],
               "notes": { "landedId": "…" } },
             { "id": "T5-desk", "…": "…", "pass": false, "soft": true,
               "reason": "the desk must list the oldest Pending person with a Call link", "notes": { "href": null } } ]
}
```

`soft` marks a task whose failure does not fail the Playwright run (see "Counting
rules"); `reason` is present only when `pass` is false; `notes` holds the facts the
task recorded with `walk.note()`. A grader reads `pass` — hard or soft — the same way.

`env.viewport`/`env.project` describe the run (first project / all projects); each
task row carries its own `project` + `viewport`. `traps` rows from `assertTrapsInTest`
carry `phase: "in-test"` and `project`. The Playwright JSON report is
`apps/crm/e2e/report/last-run.json`; traces/videos/screenshots of failures are under
`apps/crm/e2e/artifacts/test-results/`. `.auth/`, `artifacts/` and
`report/last-run.json` are git-ignored.

## Click budgets (decision D12)

| Task | Budget |
|------|--------|
| T1 find by phone | 2 keypresses + the digits / **2 clicks** |
| T2 read coverage | **0** |
| T3 Add Note | **1 click + ⌘Enter** |
| T4 Add Member | **1 click + Enter** (+ ≤ 1 to see it on the list) |
| T5 oldest Pending → Call | **1** (desk) / **2** (list) |
| Apply filter | **≤ 3** (chip = 1) |
| Pager next | **1** |
| Rail toggle | **1** |

Fixture: `crm_agent` primary, plus admin and viewer runs (`WALK_ROLE`). CI:
`workflow_dispatch` first, required check after two green runs. Runs on the local
stack only — never prod, never Vercel previews.

## The walk — task ids, budgets, mode (EV-5)

Budgets count **clicks** (keypresses are recorded, not budgeted — a chord is one).
"Hard" tasks fail the Playwright run when the product misses the budget today; "soft"
tasks record `pass=false` + `reason` and the walk continues (they describe Wave-2 work).
Specs run on all three projects unless noted.

| Task id | Spec | What is measured | Budget | Mode |
|---|---|---|---|---|
| `T1` | walk-persona | ⌘K (mobile: search icon) → type `5550107788` → **Records** bucket → Enter (mobile: tap the hit) → `/crm/r/<anchor id>` | 2 clicks (desktop: 0 clicks, 2 keypresses + 10 typed chars) | hard |
| `T2` | walk-persona | On the record: Coverage Snapshot (`crm-record-snapshot`), status badge, `a[href="tel:…"]`, "Enrolled by", member # `WALK-0001`, "Recent notes" region, V2 `Add note` group — visible, 0 clicks | 0 | hard |
| `T2-above-fold` | walk-persona | The same six elements fully inside the viewport without scrolling | 0 | soft |
| `T3` | walk-persona | `crm-record-add-note` (mobile: action-bar Note) → `document.activeElement.isContentEditable` → type → ⌘Enter → `POST /api/crm/notes` 2xx → toast text **equals** `toastCopy.added('Note')` | 1 | hard |
| `T3-hotkey` | walk-persona | Same with the `n` hotkey (no composer open, focus on body) | 0 | hard |
| `T4` | walk-persona | `crm-create-primary` (mobile: `crm-create-primary-mobile`) → first field focused → 10 values by `walk.type` + Tab in `quick-create-config` order (State `<select>` is tabbed through; `product` is a native `<select>` of tier-A options + "Other…" since DE-1, driven by type-ahead — the value is an option label, `Health Sharing`; ends on Sharing effective date — a text field) → Enter → `POST /api/crm/records` 2xx → toast text equals `toastCopy.added('Member')` → pathname `/crm/r/<new id>` → drawer closed | 1 | hard |
| `T4-see-on-list` | walk-persona | From the new record ≤1 click to the originating list showing the new row (D1: toast action "View in list", else the breadcrumb back link) — `notes.via` records which | 1 | soft |
| `T5-desk` | walk-persona | `/crm` desk → `getByRole('link', { name: 'Call Pat Pending' })` (href `tel:5550107701`; the desk renders the queue twice — md+ table and mobile list — so the role query skips the `display:none` copy); `tel:` default action stubbed so headless Chromium keeps the page | 1 | soft |
| `T5-list` | walk-persona | `/crm/modules/contacts` → Pending chip → Pat's row (desktop cells "Pat" \| "Pending", mobile card "Pat Pending") → `a[href="tel:5550107701"]`; records whether the desktop table only offers the `crm-row-call` button (it does today → fails) | 2 | soft |
| `T6` | walk-record | First visible inline-editable text cell among `preferred_name, middle_name, referring_member, mailing_city` on the anchor: click → type → Tab → `PATCH /api/crm/records/<id>` 2xx → emerald `svg.lucide-check` in the cell, no "saved" toast (D7); `notes.field`. Before the click `nudgeIntoClickableView` scrolls the record's own scroll container until the cell is not under sticky chrome (`notes.T6.scrollNudges`; 0 on desktop/tablet, >0 on mobile-390 — evidence, not a counted action) | 1 | hard |
| `T6-aria-live` | walk-record | An `[aria-live]` region announces "Saved" (D7) | 0 | soft |
| `T6-restore` | walk-record | Writes the seeded value back (keeps the fixture honest) | 1 | soft |
| `RP-header-density` | walk-record | Header at rest (D6): exactly one search input (global `Search records...` + `data-inline-record-search` counted), no dashed "Add Tags" pill, no Needs Review/Classification badge for `crm_agent`, ≤1 Email action below `lg` | 0 | soft |
| `RP-notes-pane-reload` | walk-record | Notes pane chip (or Recent notes → View all) → reload → Notes tab still `aria-selected` | 1 | soft |
| `LS-rail-default` | walk-lists (lg+) | `crm-filter-rail[data-state=open]` on a fresh list | 0 | soft |
| `LS-lane-chip` | walk-lists (lg+) | Pending lane chip → `aria-pressed` + `filters=` in the URL; chip count == pager N | 1 | soft |
| `LS-rail-apply` | walk-lists (lg+) | Rail: **Contact Status** → "Select all Pending statuses" → Apply; a visible pending state (`aria-busy`/progressbar/skeleton) within 2 s; pager N == chip N | 3 | soft |
| `LS-pager-next` | walk-lists (lg+) | `crm-pager-next` → "Showing 26 to min(50,N) of N", `?page=2` | 1 | hard |
| `LS-back-restores` | walk-lists (lg+) | Page 2 → first row (the default contacts view has no `title` column, so rows carry no link — the row click navigates, `?returnTo=` appended) → breadcrumb Back → same URL, rail `data-state`, `thead th` columns | 2 | soft |
| `LS-page-abc` | walk-lists (lg+) | `?page=abc` → "Showing 1 to …" (no NaN) | 0 | soft |
| `LS-export-zero` | walk-lists (lg+) | `?search=zz-no-such-record-<suffix>` → empty state, no pager, header "0 records", `crm-list-export` disabled + `aria-disabled` + title "Nothing to export yet"; a forced click (Playwright `force`, counted) raises no toast and no `/api/crm/records/export-csv` request (D9) | 1 | hard |
| `LS-select-all` | walk-lists (lg+) | Lane chip (prefers a lane > page size) → "Select all rows" → "Select all N" → toast `Selected N records` with N == filtered pager N (single-page lane: the visible `N selected` — MassActionsBar renders the count once per breakpoint) | 3 | soft |
| `LS-mobile-filter` | walk-lists (mobile) | `crm-filter-trigger` if visible, else "Filters & View" → the trigger inside MobileToolbarDrawer (`notes.viaFiltersAndView`) → Contact Status → Pending lane → Apply; pager N == chip N | 4 | soft (5 taps today) |
| `NV-inventory` | walk-nav | `goto` each tab: tab count, sidebar links per tab (`notes.links.<tab>`), exactly one `aria-current` tab + one sidebar link | 0 | soft |
| `NV-search-copy` | walk-nav | Top-bar pill / sidebar trigger / palette placeholder + aria recorded; all equal `SEARCH_PLACEHOLDER`, palette aria == `SEARCH_ARIA_LABEL` | 0 (1 keypress) | soft (fails today) |
| `NV-cross-tab` | walk-nav (lg+) | Every sidebar link whose href resolves to another tab (`nav-tabs.ts`; ~16): click it, record `tab=… swapped=…`; assert 0 sidebar swaps (D10 sticky tab) | = number of cross-tab links | soft (fails today) |
| `NV-palette` | walk-nav | ⌘K: phone / member # / name each list Wendy Walker; "task" lists a page | 0 | soft |
| `NV-redirects` | walk-nav | `/crm/modules/deals` → enabled sibling; `/crm/pipeline` redirected and no Pipeline sidebar link for a deals-disabled org (D10) | 0 | soft |
| `DE-open` | walk-drawer | Add Member → `#qc-contacts-first_name` focused | 1 | hard |
| `DE-paste` | walk-drawer | 10 values in config order, zero mouse actions, every value present (`product` by type-ahead on the native `<select>`, see T4) | 0 | hard |
| `DE-dup-card` | walk-drawer | Name + phone of the anchor → amber `role=alert` card with "Create anyway"; every other value kept (incl. the `product` pick); Enter does not POST | 0 | hard |
| `DE-discard` | walk-drawer | Escape → "Discard what you typed?" → Discard | 1 | hard |
| `DE-invalid-date` | walk-drawer | DOB `13/45/2026` → Enter → inline `role=alert` naming the date, **no** `POST /api/crm/records` (a save that slips through lands on the new record and is reported) | 1 | soft (may fail today) |
| `DE-lead-pending` | walk-drawer | Add Member → Lead → Status → Pending (4 clicks) → names typed → Enter (native submit, same path as Add Lead) with no date → POST 2xx + toast `toastCopy.added('Lead')` | 4 | soft |
| `DE-viewer-no-create` | walk-drawer (`WALK_ROLE=viewer`) | No `crm-create-primary(-mobile)` | 0 | soft |

Every drawer submit also asserts the raw server code `PENDING_REQUIRES_START_DATE`
never appears on screen. The drawer and T4 create records with a per-run suffix
(`Walk<suffix>`, `555…` phones) in the LOCAL DB only; re-seeding
(`scripts/e2e/seed-walk-fixture.mjs`) is idempotent for the fixture rows and leaves
those extra rows alone unless you pass `--prune-walk-rows` (the preflight for a
recorded walk — see "Known sharp edges"). Toast text is always compared with the imported
`apps/crm/src/lib/crm/toast-copy.ts` helper (relative import from `e2e/specs`), never a
literal.

## First recorded walk (2026-08-23, Wave 1 code, commit dc108f36 + uncommitted Wave-1 tree)

Two consecutive full runs (`--prune-walk-rows` preflight before each; all three projects,
`role=operator`, `nav=full`, `v2=true`) — 33 Playwright tests passed, 6 skipped (viewer /
mobile-only / lg-only), 93 task records, 309 trap rows (all PASS), **0 differences** in
clicks / keypresses / typed chars / pass between the two runs. Every hard task is green.
Soft tasks that record `pass=false` today (product work, not harness bugs — Wave 2 items):

| Task | Projects | Why it fails today |
|---|---|---|
| `LS-rail-apply` | desktop, tablet | no visible pending/loading state within 2 s of Apply (LS-*) |
| `LS-page-abc` | desktop, tablet | `?page=abc` renders "Showing NaN to NaN of N results" (pager honesty) |
| `LS-mobile-filter` | mobile | 5 taps: "Filters & View" → Filters → Contact Status → lane → Apply (budget 4) |
| `NV-search-copy` | all | top bar "Search people or work…", sidebar "Search or workflow…", mobile icon "Search (⌘K)" vs the palette's `SEARCH_PLACEHOLDER`; palette aria-label is the placeholder, not `SEARCH_ARIA_LABEL` |
| `NV-cross-tab` | desktop, tablet | 16/16 cross-tab sidebar links swap the sidebar (D10 sticky tab not shipped) |
| `NV-palette` | all | phone / member # / name all find Wendy; typing "task" lists no page |
| `NV-redirects` | all | `/crm/modules/deals` → `/crm/modules/members` OK; `/crm/pipeline` still renders "Deal Pipeline" and a Pipeline sidebar link for a deals-disabled org |
| `T2-above-fold` | tablet, mobile | below the fold at 1024: snapshot, Enrolled by, Recent notes; at 390 also member # |
| `T5-list` | desktop, tablet | the table renders Call as `crm-row-call` button, no `tel:` anchor (mobile cards have one → pass) |
| `T6-aria-live` | all | inline save has no `[aria-live]` "Saved" announcement (D7 half: the silent check + no toast are in place) |
| `RP-header-density` | all | 0 header search inputs at rest (want exactly 1 — D6 asks for one, not none) |
| `RP-notes-pane-reload` | all | Notes pane chip → reload → Overview is active again (pane not in the URL) |

Recorded facts worth keeping: mobile-390 T6 needs 4 scroll nudges (2 on restore) before an
inline cell is clickable; tablet 3; desktop 0. DE-invalid-date is rejected inline
("Enter a real date as MM/DD/YYYY", no POST) and DE-lead-pending saves with `POST 200` in 4
clicks + Enter — both soft tasks pass now.

## Wave-2 interim walk (2026-08-23, commit ed7767e7 + uncommitted Wave-2 tree)

Three full recorded runs (`--prune-walk-rows` preflight before each; all three projects,
`role=operator`, `nav=full`, `v2=true`). Run 1 surfaced three harness races (fixed below);
runs 2 (`e2e/artifacts/crm-walk/2026-08-23T06-00-37-166Z`) and 3
(`…/2026-08-23T06-05-38-798Z`, `latest.txt`) — 33 Playwright tests passed, 9 skipped,
95 task rows, 309 trap rows (all PASS), **0 differences** in clicks / keypresses / typed chars
/ pass between the two runs. Every hard task is green on all three projects. Wave-1 soft fails
now passing: `LS-rail-apply` (pendingStateSeen), `LS-page-abc` ("Showing 1 to 25 of 35
contacts"), `NV-search-copy` (one canonical `SEARCH_PLACEHOLDER` on every surface, palette
aria = `SEARCH_ARIA_LABEL`), `NV-palette` ("task" → "Go to Tasks"), `NV-redirects`
(`/crm/pipeline` → `/crm/modules/members`, 0 Pipeline links), `T5-list` (`tel:` anchor,
0 scroll steps), `T6-aria-live`, `RP-header-density` (0 global search in header, find-in-record
reachable + focused by `/`, Add Tags pill opacity-0 at rest, 0 admin badges), `RP-notes-pane-reload`
(`?pane=notes`), `T4-see-on-list` (1 click via the "View in list" toast action).

Soft tasks still recording `pass=false` (all product, none harness):

| Task | Projects | Why it fails today |
|---|---|---|
| `NV-cross-tab` | desktop, tablet | 1/14 operator cross-tab links swaps: Operations › "Import Data" (`/crm/import`) redirects `crm_agent` to `/crm?error=no_import_permission` (`import/page.tsx` allows only `crm_admin`/`crm_manager`), so the sticky rule cannot hold; the other 13 are sticky (D10 works). Each note now records `redirected=<landed path>` |
| `T2-above-fold` | tablet, mobile | below the fold at 1024: snapshot, Enrolled by, Recent notes; at 390 also member # (RP-6 above-the-fold compaction not shipped; header chrome only) |
| `LS-mobile-filter` | mobile | 5 taps (budget 4): "Filters & View" sheet still fronts `crm-filter-trigger` (LS-10, Wave 3) |

Viewer persona (separate recorded runs, `WALK_ROLE=viewer`): `DE-viewer-no-create`
(`…/2026-08-23T05-01-57-112Z`: `crm-create-primary` 0, `crm-create-primary-mobile` 0) and
`DE-viewer-post-403` (`…/2026-08-23T05-04-03-646Z`, new spec `e2e/specs/walk-viewer-api.spec.ts`:
POST `/api/crm/records` → 403 with valid org/module ids).

Harness changes in this wave: `NV-cross-tab` settles on URL + evidence the hop committed
(clicked link `aria-current` OR tab == path resolver) + 400 ms grace instead of polling
`topModuleForPath(link)` (wrong under D10 sticky; it burned 15 s per link); the collapsed-sidebar
search selector is `[aria-label="${SEARCH_PLACEHOLDER}"]`; `walk-helpers.ts`
`armPendingStateLatch(page)` / `readPendingStateLatch(page, ms)` (in-page MutationObserver armed
BEFORE Apply) because the LS-3 pending state is shorter than an outside poll on a warm server;
`DE-lead-pending` reads its outcome from the request tracker armed before the press;
`e2e/tsconfig.json` resolves `@/*` → `src/*` (ModuleContext → nav-profile imports the alias);
`next-env.d.ts` is rewritten by whichever Next binary ran last (`next dev` points it at
`./.next/dev/types/routes.d.ts`, `next build` at `./.next/types/routes.d.ts`) — a graded
walk therefore leaves it correct, and a `WALK_DEV=1` run does not. Restore with
`git show HEAD:apps/crm/next-env.d.ts > apps/crm/next-env.d.ts` before committing.

Server log noise seen on every run (not walk failures): `⨯ TypeError: DOMPurify.default.sanitize
is not a function` at `lib/crm/note-sanitize.ts` when `/crm/r/<id>?pane=notes` is server-rendered
(NotesPanel SSR'd once Notes is the initial pane — page still returns 200); `[signals] table
missing — migration not applied` on POST `/api/crm/signals` (documented in live-reality).

## Proving the traps (negative-run switches)

Three env switches exist ONLY to make the walk fail on a named trap — they never
make anything pass, and a normal run must not set them. global-setup prints
`NEGATIVE-RUN switches active: …` when one is on.

| Switch | What it changes | Expected failure |
|--------|-----------------|------------------|
| `E2E_SKIP_PIN_COOKIE=1` | global-setup arms **no** `lgq_ok` cookie; `pin-gate` probes `/crm` with the harness' (empty) cookie jar | `TRAP:pin-gate — GET /crm WITH an EMPTY cookie jar (E2E_SKIP_PIN_COOKIE=1) still redirected to /lock …` |
| `E2E_ANCHOR_PHONE=<digits>` | `not-empty` searches `/api/crm/search?q=<digits>` instead of the fixture phone (use a number that does not exist, e.g. `5559990000`) | `TRAP:not-empty — /api/crm/search?q=5559990000 did not return the fixture record (E2E_ANCHOR_PHONE override in effect) …` |
| `E2E_FORCE_VIEWPORT_WIDTH=1000` | the `desktop-1440` project and the global-setup browser use that width (320–4096) | `TRAP:breakpoint — desktop-1440 viewport 1000x900 is not ≥1024` |

```bash
cd apps/crm
E2E_SKIP_PIN_COOKIE=1       npm run walk:crm   # → pin-gate
E2E_ANCHOR_PHONE=5559990000 npm run walk:crm   # → not-empty
E2E_FORCE_VIEWPORT_WIDTH=1000 npm run walk:crm # → breakpoint
```

All three fail inside global-setup (exit 1, `TrapFailure: TRAP:<name> — …`) and no
test runs. Every one leaves `trap-<name>.png` + `env.json` + `walk.json` (failed trap
row, `tasks: []`) in the run folder: `pin-gate` / `prod-guard` are probed over the API
before any browser context exists, so on failure global-setup opens a throwaway
chromium context, loads `/crm` exactly as the probe saw it (no cookie → the PIN
disguise page is the evidence) and screenshots it before rethrowing (observed run
`2026-08-23T02-18-45-453Z`: `trap-pin-gate.png`, `walk.json` with `pin-gate pass=false`);
`not-empty` / `breakpoint` fail after login and screenshot the logged-in page.
Any other setup failure (not a trap) leaves `setup-failure.png` in the run folder.

## Lint gate (`lint:changed`)

`npm run lint` (`eslint . --max-warnings 0`) is red on `main` because of pre-existing
debt in files the walk does not own (~45 findings; the three Wave 0 touched for test-ids
carry 5 of them: `RecordDetailShellV2.tsx` react-hooks/refs + a stale eslint-disable,
`ZohoContextualSidebar.tsx` no-restricted-syntax ×2, `NotesPanel.tsx` a stale
eslint-disable — identical on HEAD). The walk CI therefore gates on
`apps/crm/e2e/lint-changed.mjs`: for every changed `apps/crm` source file vs the base
(`merge-base(HEAD, origin/main|main)`, or `LINT_BASE=<ref>`) it lints the base revision
AND the working copy with the same flat config and fails only when a (file, rule) pair
gained findings. Pre-existing findings are printed as `carried` so the debt stays
visible; `--strict` restores the plain eslint bar (any finding fails); `--json` for CI.
Untracked files must be clean. A cleanup item retiring the carried debt (then flipping
`walk:crm:check` to `--strict`) is scheduled for Wave 3 (see "Known sharp edges").

## Known sharp edges

- Product defects the Wave-0 smoke run surfaced (NOT harness bugs, NOT fixed in Wave 0 —
  carried into Wave 1; details + repro in `live-reality-2026-08-22.md` "Product defects"):
  `status-values` 500 / PeopleQueue pending-lane failure from JSON.stringify'd jsonb args
  to `execute_report_aggregation`; `/api/crm/signals` misclassifying RLS 42501 as
  table-missing + `crm_user_signals` lacking authenticated grants; `log_audit_event`
  EXECUTE revoked from `authenticated`.
- Lint debt: `lint:changed` carries 5 pre-existing findings in walked files (above);
  retire them in Wave 3 and switch `walk:crm:check` to `--strict`.
- **Client-side navigation from `/crm` (dashboard) to a record never leaves the loading
  skeleton on the dev server** (observed 2026-08-23 while authoring EV-5, reproduced 4×):
  palette Enter on the Wendy hit, or the desk's "Open Wendy Walker" link, request
  `/crm/r/<id>` (`?returnTo=%2Fcrm` for the desk link) as a router transition → the server
  render takes 19–65 s or never finishes, `next-server` sits at >100 % CPU and unrelated
  requests (`/lock`, `/api/notifications`) stall 15–27 s. A full-page load of the same
  record renders in 1–6 s, a raw `fetch('/crm/r/<id>', { headers: { RSC: '1' } })` from
  `/crm` answers in 0.3 s, and the list → record router transition renders in ~6 s. T1
  waits up to 60 s for the V2 chrome and records `notes.renderMs`; until this is fixed T1
  fails honestly (hard) and T2 reads the record after a full load.
- `crm-pager-showing` can render twice on a list (strict-mode violation) since the
  Wave-1 ModuleShell edits — the lists spec reads `.first()` and records the count.
- **Fixture drift between runs**: T4 and the drawer create `Walk …` contacts/leads (they
  land in the Pending lane) and T3 adds notes on the anchor, so lane counts grow by ~6 per
  full run and the oldest Pending (Pat) slides down a virtualised mobile list. Preflight a
  recorded walk with `node scripts/e2e/seed-walk-fixture.mjs --prune-walk-rows` (hard-deletes
  the walk's own rows — `first_name = 'Walk'` records, `Walk T3…` notes — then re-verifies);
  two consecutive pruned runs produce identical per-task tallies. `T5-list` also scrolls the
  list (`revealByScrolling`, not counted; `notes.scrollSteps`) so it survives a longer lane.
- `NV-cross-tab` reads the sidebar only after the URL settled AND the hop has visibly
  committed (the clicked link is `aria-current`, or the tab equals the path resolver) plus a
  400 ms grace; under D10 the tab is expected to STAY `link.tab`, so never poll for
  `topModuleForPath(link)` (that burns the full settle timeout per link). A redirect by the
  app is recorded as `redirected=<landed path>` in the note.
- `walk.type` on a native `<select>` is type-ahead (`pressSequentially` under the typing
  flag): pass the start of an option label; Chromium keeps a ~1 s prefix buffer, so two
  type-aheads on the same select in a row need a pause. `fill` would throw.
- mobile-390 record page: the sticky record header + pane tabs + bottom action bar leave
  ~250 css px of the 664 px viewport for content, so Playwright's own scroll-into-view
  lands inline cells under chrome (`subtree intercepts pointer events`). The V2 page
  scrolls inside `<main class="overflow-y-auto">`, not the window — `nudgeIntoClickableView`
  scrolls that container until `elementFromPoint` hits the target (T6 records the count).
- Duplicated DOM per breakpoint: the desk queue (md+ table + mobile list → two
  `Call <name>` links, one `display:none`), `MassActionsBar` (`N selected` twice) and the
  mobile "Filters & View" sheet (the `crm-filter-trigger` exists once but is hidden until
  the sheet opens). Specs query by role or `visible=true` rather than `.first()`.

- `walk-helpers.ts#stubTelLinks` prevents the default action of `a[href^="tel:"]`
  clicks (T5) — headless Chromium would otherwise hand the click to the OS protocol
  handler; the click is still counted and the href is what is asserted.
- `e2e/tsconfig.json` sets `"jsx": "preserve"` so `nav-tabs.test.ts` can import the
  app's `ModuleContext.tsx` and pin the nav mirror to the real resolver.
- A graded run compiles the whole app before the first request: `webServer.timeout`
  is 600 s (measured cold locally — `next build --webpack` 74 s, `next start` ready
  in 90 ms — with generous headroom for a CI runner's cold cache). Under
  `WALK_DEV=1` the first render compiles on demand instead and the timeout drops
  back to 180 s. The global-setup login waits up to 120 s either way.
- `server-mode` (pre-login trap) refuses to grade the wrong binary. `reuseExistingServer`
  is on locally, so a `next dev` already listening on :3000 would otherwise be adopted
  by a graded run; the trap `GET`s `/lock` and classifies the document (dev ships the
  `next-devtools`/`hmr-client` bundles and source-path chunk names; a build ships
  content-hashed chunks and neither), and fails the run when it disagrees with
  `WALK_SERVER_MODE`. An unclassifiable document also fails — it never guesses.
- Retries are hard-pinned to 0 — a retried task would be counted twice.
- The legacy Vite-era runner now lives at `tests/playwright/legacy.config.ts`
  (`tickets.spec.ts` beside it, port 5173); it is not part of the walk.
