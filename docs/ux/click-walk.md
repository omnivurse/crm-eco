# CRM click-walk harness (EV-1 / EV-3 / EV-4)

The click-walk is the evidence harness for the "Road to Ten" plan: a logged-in
Playwright run against the **local** Supabase stack that counts every click and
keypress per persona task, screenshots every step, and refuses to count anything
when a false-result trap fires. Budgets come from owner decision **D12**
(`docs/ux/decisions-2026-08-22.md`).

Everything lives in `apps/crm/e2e/`:

| File | Role |
|------|------|
| `playwright.config.ts` | runner — projects `desktop-1440`, `tablet-1024`, `mobile-390`; boots `next dev --port 3000` pinned at the local stack |
| `global-setup.ts` | pre-login traps → PIN cookie → `/crm-login` → storageState `.auth/<role>.json` → post-login traps → opens the run folder |
| `global-teardown.ts` | merges the run ledger into `walk.json` and validates it against `report/walk-schema.json` |
| `traps.ts` | every false-result trap + `assertTrapsInTest()` for per-project re-assertion |
| `walk-fixture.ts` | the `walk` fixture (`task` / `click` / `press` / `type` / `shot`) + the in-page trusted-event cross-check |
| `walk-counter.ts`, `walk-counter.test.ts` | pure counter logic + vitest unit test |
| `walk-report.ts` | `walk.json` builder + minimal schema validator |
| `env.ts` | local keys, fixture contract, paths |
| `check-no-raw-actions.sh` | grep gate: no raw `page.click/press/fill` in `specs/**` |
| `specs/*.spec.ts` | the walks (today: `smoke.spec.ts`) |

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
cd apps/crm && npm run walk:crm:check              # raw-action grep gate + tsc of e2e/
```

Ports: the app is `http://localhost:3000` (`WALK_BASE_URL` overrides). Locally the
runner reuses a server already on :3000 (`reuseExistingServer: !CI`) — if that
server is pointed at prod the **prod-guard** traps fail the run before login.

## Environment the runner forces onto `next dev`

`webServer.env` in `playwright.config.ts` (Next.js never overrides variables already
in `process.env`, so these beat `apps/crm/.env.local`):

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
- **Anchor**: Wendy Walker · phone `5550107788` (unique) · `wendy.walker@example.invalid` · member_number `WALK-0001` · an allowed **Active-lane** status · a plan/product value · `sharing_effective_date 2026-09-01` · `producer_name 'Wen Producer'`.
- **Pending lane**: ≥ 3 contacts with an allowed Pending-lane status, `created_at` spread over days; oldest is **Pat Pending** (`5550107701`).
- **Total contacts ≥ 32** so the list pages at 25/page.
- One lead **Lee Lead**; one advisor record **Wen Producer** in the CRM `advisors` module.
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
               "ms": 1840, "budget": 2, "pass": true, "project": "desktop-1440",
               "viewport": "1440x900", "test": "…",
               "steps": [ { "label": "open palette", "shot": "shots/…/01-open-palette.png", "kind": "press", "ms": 120 } ] } ]
}
```

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
test runs. `pin-gate` is probed over the API before any browser context exists, so that
run folder holds only `traps.jsonl` — **no `walk.json` and no `trap-pin-gate.png`**
(observed run `2026-08-23T01-57-00-268Z`); `not-empty` / `breakpoint` fail after login,
so their run folder gets `trap-<name>.png` plus a `walk.json` with the failed trap row
and `tasks: []`.
Any other setup failure (not a trap) leaves `setup-failure.png` in the run folder.

## Known sharp edges

- First `next dev` render compiles on demand: the global-setup login waits up to
  120 s and `webServer.timeout` is 180 s; one walk per dev server.
- Retries are hard-pinned to 0 — a retried task would be counted twice.
- The legacy Vite-era runner now lives at `tests/playwright/legacy.config.ts`
  (`tickets.spec.ts` beside it, port 5173); it is not part of the walk.
