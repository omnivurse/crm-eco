# CRM walk harness — runbook

The CRM click-walk is the evidence harness for the "Road to Ten" usability plan:
a logged-in Playwright run against a **local** Supabase stack that counts every
click and keypress per persona task, screenshots each step, and refuses to count
anything when a false-result trap fires. Every score in a regrade must be
traceable to a row in a `walk.json` this harness wrote.

This file is the **operational** doc: how to run it on a laptop, how it runs in
CI, how to read the artifact, and how a regrade uses it. The harness internals —
the fixture contract, the counting rules, every trap's assertion, the spec
inventory — live in [`docs/ux/click-walk.md`](ux/click-walk.md); the budgets come
from owner decision **D12** in
[`docs/ux/decisions-2026-08-22.md`](ux/decisions-2026-08-22.md).

| Where | What |
|---|---|
| `apps/crm/e2e/` | runner, traps, `walk` fixture, specs, `walk.json` builder, the gate |
| `scripts/e2e/apply-local-migrations.sh` | brings the local DB up to `supabase/migrations/**` with psql only |
| `scripts/e2e/seed-walk-fixture.mjs` | idempotent, local-only walk fixture (users, CRM config, records) |
| `.github/workflows/crm-walk.yml` | the CI job (workflow_dispatch today — see "Promotion") |
| `apps/crm/e2e/artifacts/crm-walk/<ISO>/walk.json` | the evidence; `…/latest.txt` points at the newest run |

---

## 1. Run it locally

Prerequisites once: Docker running, `npx playwright install chromium`, and a
local stack started **from a checkout that is not this worktree** (`supabase
start`). In this repo `supabase db push` / `db reset` / `link` target
**production** — never run them for the walk; the local DB is driven with `psql`
only.

Run the steps in this order — it is exactly the order the CI job uses:

```sh
cd <repo root>

# 1. dependencies (CI: npm ci)
npm install

# 2. harness guards — cheap, fail fast
cd apps/crm && npm run walk:crm:check && cd -
#   → no raw page.click/press in specs, e2e typecheck, no NEW lint findings

# 3. local DB up to date (never `supabase db push`)
LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  scripts/e2e/apply-local-migrations.sh --strict

# 4. fixture (idempotent; --prune-walk-rows deletes rows a previous walk created,
#    so lane counts start identical every time)
node scripts/e2e/seed-walk-fixture.mjs --prune-walk-rows

# 5. PREFLIGHT — always run this before a recorded walk
node scripts/e2e/seed-walk-fixture.mjs --prune-walk-rows --verify-only

# 6. record the walk (all three projects; ~6–7 min warm)
cd apps/crm && npm run walk:crm
#   WALK_ROLE=admin npm run walk:crm            # admin persona (or viewer)
#   npx playwright test -c e2e/playwright.config.ts e2e/specs/walk-lists.spec.ts \
#     --project=mobile-390                      # one spec, one project

# 7. grade the run the way CI does
npm run walk:crm:gate

# 8. prove the commit-time guard (EV-GUARD; ~4s, no browser, no dev server)
npm run walk:crm:guard-proof
#   node e2e/guard-proof.mjs --out-dir "$(cat e2e/artifacts/crm-walk/latest.txt)"
#   → then: npm run walk:crm:gate -- --require-guard-proof
```

**Afterwards**: leave port 3000 free (the runner stops the dev server it
started; a server you started yourself is yours to stop) and restore
`apps/crm/next-env.d.ts` — `next dev` rewrites it.

Ports: app `http://localhost:3000` (`WALK_BASE_URL` overrides), API
`http://127.0.0.1:54321`, DB `127.0.0.1:54322`. Locally the runner **reuses** a
server already on :3000 (`reuseExistingServer: !CI`); if that server points at
production the `prod-guard` traps fail the run before the first click.

## 2. Run it in CI

`.github/workflows/crm-walk.yml`, job `walk`, `ubuntu-latest`, Node 24,
`supabase/setup-cli@v1` pinned to 2.106.0. Same order as above, on a disposable
runner that starts its own stack:

```
checkout (fetch-depth 0) → setup-node 24 → postgresql-client → supabase CLI →
npm ci → walk:crm:check → playwright install --with-deps chromium →
supabase start → key-drift check → apply-local-migrations --strict →
seed → seed --verify-only → walk:crm:ci → walk:crm:gate → upload artifacts →
supabase stop
```

**Inputs** (`workflow_dispatch`): `role` (operator/admin/viewer), `projects`
(comma-separated Playwright projects), `allow_soft` (task ids tolerated red —
see the gate), `supabase_exclude` (containers to skip on `supabase start`;
blank starts everything, which is the first thing to try if `start` misbehaves).

When a soft row is a **known, tracked** debt, name it in `allow_soft` for that
run and say which plan item owns it. Never widen a budget to make a row green —
the budget is the owner's decision, the waiver is a note on one run.

**What fails the job**

| Failure | Caught by |
|---|---|
| a trap (wrong host, wrong org, PIN page, no V2 chrome, …) | `global-setup` throws → Playwright exits non-zero; the gate re-checks `walk.json.traps` |
| a HARD task over budget or failing an assertion | Playwright |
| a **soft** task over budget (the runner deliberately continues) | **the gate** — soft rows are not waived unless the run names them in `allow_soft` |
| a run that recorded no tasks, or evidence from a non-local Supabase host, or the same task recorded twice | the gate |
| a migration that does not apply | `apply-local-migrations.sh --strict` |
| a fixture that does not match the contract | `seed-walk-fixture.mjs --verify-only` |

**Artifacts** (`crm-walk-<role>-<run number>`, 30 days): the whole
`apps/crm/e2e/artifacts/crm-walk/**` run folder — `walk.json`, `env.json`, the
JSONL ledgers and every step screenshot — plus `artifacts/test-results/**`
(Playwright traces and videos of failures) and `e2e/report/last-run.json`. The
gate also writes a pass/fail table into the run's **job summary**.

**Runtime** ≈ 20 min (stack ~4, `npm ci` ~2, browsers ~1, walk ~10). The walk
step is capped at 25 min, the job at 35.

`walk:crm:ci` is `walk:crm` plus the `github` reporter (inline annotations) and
a JSON report. `PLAYWRIGHT_JSON_OUTPUT_NAME` is resolved **relative to the
config directory** (`apps/crm/e2e`), not the cwd — hence
`report/last-run.json`, which lands next to the config as
`apps/crm/e2e/report/last-run.json`. Set it to `e2e/report/…` and Playwright
writes `apps/crm/e2e/e2e/report/…` instead.

### Choices worth knowing

- **`next build` + `next start`, not `next dev`.** A graded walk measures the
  binary that ships. The harness used to boot the dev server on the reasoning
  that "click counts do not change between dev and prod builds" — true for
  clicks, and false for everything the `page-errors` trap grades. `next dev` is
  a different program: Next 16 wraps the app on the **server** in
  `<AppDevOverlayErrorBoundary>{[<ReplaySsrOnlyErrors/>, children]}` while the
  client hydrates without it, which shifts every `useId` below `<body>` and
  makes genuinely-hydrating subtrees report a mismatch production cannot
  produce. (`grep -c AppDevOverlayErrorBoundary`: 1 in `app-page.runtime.dev.js`
  and `app-page-turbo.runtime.dev.js`, 0 in **both** `.prod.js` runtimes.) The
  reverse hazard is worse: production **minifies** React's messages, so a real
  hydration failure reads only as `Minified React error #418` and prose-matching
  reports a clean build that is in fact broken.

  The old objection — `NEXT_PUBLIC_*` is inlined at compile time, so the local
  keys would have to be baked in — is answered by `webServer` running **both**
  halves under one env block: `npm run build && npm run start -- --port 3000`
  inherits `webServer.env`, so the local URL and demo anon key are inlined by
  that build and the `prod-guard-network` trap still proves the browser only
  ever talked to `127.0.0.1`. CI and laptop run the same command. The cost is
  the build (measured cold locally: 74 s; `next start` ready in 90 ms), which
  the config absorbs with a 600 s `webServer.timeout`.

  Two consequences to know:
  - `apps/crm/.next` is left holding a build with the **local** Supabase keys
    inlined. Rebuild before serving that folder for anything else.
  - `WALK_DEV=1` falls back to `next dev` for a fast edit loop. It is loudly
    **ungraded**: the config prints a banner, `walk.json` records
    `env.serverMode: "dev"`, and `walk:crm:gate` refuses the document. CI throws
    if `WALK_DEV` is set. The `server-mode` trap closes the matching hole in
    `reuseExistingServer` — a `next dev` already listening on :3000 is detected
    and fails the run instead of being silently adopted as production evidence.
  - **`reuseExistingServer` also has a *freshness* hole, and it is closed the
    same way.** "This is a production build" says nothing about *which source*
    that build came from: a `next start` left running from an hour ago answers
    `/lock` exactly like a fresh one, so a graded local run adopts it and
    `walk.json` records today's `commit` over an hour-old bundle. Reproduced —
    `walk.json` said `commit 2664d775` while the served bundle still contained a
    canary that exists in no commit. Note that comparing `git rev-parse HEAD`
    would *not* have caught that: HEAD never moved, only the working tree did.

    So the build stamps an identity of the source it compiled — `<HEAD 12>-<8
    hex of a digest over every uncommitted change under the bundled paths>`,
    computed in [`apps/crm/e2e/build-id.ts`](../apps/crm/e2e/build-id.ts) and fed
    to `generateBuildId` through `WALK_BUILD_ID`, so it lands in
    `.next/BUILD_ID` and in every document's flight payload. It describes the
    build **on disk**, so restarting a stale `.next` under fresh env cannot fake
    it. `server-mode` reads it back out of `/lock` and fails on any mismatch,
    naming the cause (older commit vs. same commit + uncommitted edit vs. a build
    this harness never made). `walk:crm:gate` then refuses any graded `walk.json`
    whose `env.buildId` is missing or does not lead with its own `commit`.

    Reuse is *not* disabled to buy this: the identity is stable while the source
    is, so re-running against a server that really is current still skips the
    build. Editing `apps/crm/e2e/**` deliberately does not change it — the
    harness is never bundled, so working on a trap must not invalidate a good
    server. `WALK_DEV=1` skips the mechanism entirely (`next dev` has no build
    id, and the gate refuses a dev run anyway).
- **Retries stay 0.** A retried task appends a *second* row to `walk.json` and
  the counts stop being trustworthy, so `playwright.config.ts` pins
  `retries: 0`, the gate fails a duplicated `(task, project)` pair, and CI does
  not pass `--retries`. Traces and videos are kept on failure instead
  (`trace: 'retain-on-failure'`, `video: 'retain-on-failure'`).
- **`supabase start` is CI-only.** It is safe on a fresh runner and never
  touches production. It also applies `supabase/migrations/**` itself; when a
  file fails there, `start` exits non-zero with healthy containers, so the job
  warns, checks Postgres is up, and lets
  `apply-local-migrations.sh --strict` name the offending file.
- **Key-drift check.** CI compares the running stack's `ANON_KEY` /
  `SERVICE_ROLE_KEY` (`supabase status -o env`) against the constants in
  `apps/crm/e2e/env.ts`. These are the public CLI demo keys — they only work
  against 127.0.0.1. No production secret is ever available to this workflow.
  `supabase status` inspects every container and exits non-zero when one was
  excluded from `start`; that skips the comparison with a warning rather than
  failing the job, because the `prod-guard` traps already prove the app only
  ever talked to the local stack.

### Promotion to a required check (decision D12)

The workflow is **`workflow_dispatch` only** today, so it cannot block a merge.
After **two consecutive green dispatch runs on the same commit**: uncomment the
`pull_request:` trigger in the workflow, mark "CRM walk / walk" required in
branch protection, and record the two run URLs here.

| Green run | Commit | URL |
|---|---|---|
| _(1)_ | | |
| _(2)_ | | |

## 3. Read `walk.json`

`apps/crm/e2e/artifacts/crm-walk/<ISO>/walk.json`, validated against
`apps/crm/e2e/report/walk-schema.json` on every run:

- `commit` / `startedAt` / `finishedAt` — what was walked, and when.
- `env` — `baseURL`, `supabaseUrl` (must be local), `navProfile`, `layoutV2`,
  `viewport`, `project`, `role`.
- `traps[]` — `{name, pass, detail, phase, project}`; `phase` is
  `pre-login` | `post-login` | `in-test`.
- `tasks[]` — `{id, label, clicks, keypresses, typedChars, ms, budget, pass,
  soft, reason, project, viewport, test, steps[], notes{}}`. `steps[].shot` is a
  path inside the run folder; `notes` holds facts recorded with `walk.note()`
  (counts, hrefs, observed copy). `reason` is present only when `pass` is false.
- A grader reads `pass` the same way for hard and soft rows. `soft` only means
  "the runner kept walking".

```sh
cd apps/crm
D=$(cat e2e/artifacts/crm-walk/latest.txt)

# every red row
node -e 'const w=require(process.argv[1]+"/walk.json");
  console.log(w.tasks.filter(t=>!t.pass).map(t=>`${t.id} [${t.project}] ${t.clicks}/${t.budget} — ${t.reason}`).join("\n")||"all green")' "$D"

# one task across the three viewports
node -e 'const w=require(process.argv[1]+"/walk.json");
  console.log(w.tasks.filter(t=>t.id===process.argv[2]))' "$D" T4

# the same table CI posts to the job summary
npm run walk:crm:gate -- --dir "$D"
```

### The gate (`apps/crm/e2e/walk-gate.ts`)

`npm run walk:crm:gate` grades a recorded run independently of the Playwright
exit code, because two evidence failures survive a green run: a **soft** task
that recorded `pass: false`, and a run that recorded **nothing**. It fails on

1. any trap with `pass: false`;
2. any task with `pass: false` (a soft row is waived only when its id is in
   `--allow-soft` / `WALK_ALLOW_SOFT`, and a **hard** row is never waived);
3. a task marked `pass` whose `clicks` exceed its `budget`;
4. the same `(task, project)` recorded twice — the retry signature;
5. fewer than one task row, or `env.supabaseUrl` that is not local.

Exit codes: `0` green · `1` failures · `2` no `walk.json` to grade. Unit tests:
`apps/crm/e2e/walk-gate.test.ts` (`npm run walk:crm:unit`).

With `--require-guard-proof` it additionally demands a `guard-proof.json` in the
same run folder and grades it (see below). The flag is **opt-in**: CI passes it,
but a local regrade over an older run folder must not go red for missing a file
that folder never had.

### The guard proof (`apps/crm/e2e/guard-proof.mjs`) — EV-GUARD

Every other claim in the regrade is backed by a row in `walk.json` anyone can
re-open. The claim *"a commit-time guard provably rejects a new raw toast"*
cannot be a Playwright row — there is no browser in a git hook — so it gets the
same standard in a different shape: one command, one JSON artifact.

```sh
cd apps/crm && npm run walk:crm:guard-proof
```

It writes a scratch component at
`apps/crm/src/components/crm/records/__guard_proof_scratch__.tsx` — under one of
the `WALKED_PATHS` globs in `eslint.config.mjs`, where the toast rule is an
**error**, and under `src/`, where the vitest ratchet counts it — stages it, and
runs the real hook paths against it:

| step | what runs | must |
| --- | --- | --- |
| CONTROL | the ratchet on the tree as it stands | exit `0` — otherwise a later red proves nothing |
| NEGATIVE | pre-commit path, scratch copy taken from a **variable** | not name the rule — the gate is not simply always-red |
| POSITIVE | `node --max-old-space-size=4096 apps/crm/e2e/lint-changed.mjs --staged <file>` with a raw `toast.success('…')` | exit non-zero **and** name `crm-toast/no-raw-toast-copy` |
| RATCHET | `vitest run src/lib/crm/toast-raw-ratchet.test.ts` with the extra raw site | exit non-zero and name the directory that rose |
| CLEANUP | delete the file, `git rm --cached` the index entry | `git status --porcelain -uall` byte-identical to the snapshot taken first |

Cleanup runs from a `finally`, so a mid-flight throw still restores the tree, and
"restored" is **asserted** against the before-snapshot rather than assumed. Git
writes never go beyond the index on that single path — no commit, stash, reset,
checkout or branch.

Evidence lands in `e2e/artifacts/crm-walk/<ISO>/guard-proof.json` (pointer:
`artifacts/crm-walk/latest-guard-proof.txt`) recording the commit, every command
with its exit code and tail of output, the rule name, the ratchet baseline before
and after, the status byte counts, and a `pass` boolean. Pass `--out-dir <run
dir>` to drop it beside a `walk.json` so `walk:crm:gate --require-guard-proof`
can grade it. `gradeGuardProof()` re-derives the verdict from the recorded exit
codes rather than trusting the script's own `pass` flag, and rejects a proof
recorded against a different commit than the walk.

**Verify the proof can go red** before trusting it — a proof that cannot fail
proves nothing. Neuter `isRaw` in the ESLint rule and the POSITIVE rows go red;
add the scratch path to `ALLOWED_FILES` in the ratchet test and the RATCHET rows
go red. Both were exercised on `066eb1ce`.

> **Known defect (not fixed here):** `.husky/pre-push` runs
> `npx vitest run --silent src/lib/crm/toast-raw-ratchet.test.ts`. Under vitest 4
> the bare `--silent` swallows the following path (`Unexpected value
> "--silent=src/…"`), so that line exits `1` on a **clean** tree — it blocks every
> push and can never discriminate a real raw-toast regression. The proof records
> this as `prePush.hookLineDiscriminating: false` and prints it as a DEFECT; its
> own ratchet assertions use `--silent=true`.

## 4. How a regrade uses it (EV-5F)

1. Re-run the walk on the **final** commit — any later code change invalidates
   the evidence.
2. Run it **twice** with the same fixture: the click/keypress counts must be
   identical. Different counts mean the walk is measuring flake, not the product.
3. Cover the matrix D12 asks for: `desktop-1440`, `tablet-1024`, `mobile-390`
   × `WALK_ROLE` `operator`, `admin`, `viewer`.
4. Write `docs/ux/regrade-<date>.md` from the artifact: per-task counts against
   budget, the trap table, the live-reality table, and every owner decision that
   was declined with the ceiling it imposes.
5. **No dimension is marked 10 without its row in `walk.json`.** A soft row that
   is still red is a ceiling, not a rounding error.

## 5. Traps

Twelve traps run before anything is counted (`pre-login`/`post-login` in
`global-setup`) and again inside each project (`in-test`, via
`assertTrapsInTest`). Full assertions in
[`docs/ux/click-walk.md`](ux/click-walk.md#traps-ev-3--fail-loudly-before-counting-anything).

| Trap | Proves |
|---|---|
| `prod-guard` | the harness Supabase host is 127.0.0.1/localhost **and** org `0000…0001` is `pifh-local` |
| `prod-guard-network` | every Supabase request the *browser* made went to the local stack |
| `server-mode` | the server answering on `BASE_URL` is the **binary** the run declares (`next start`, not `next dev`) **and** a build of **this source** — its `.next/BUILD_ID` equals the identity this run stamped |
| `pin-gate` | `/crm` without the `lgq_ok` cookie redirects to `/lock`; with it, no PIN page |
| `pin-page` | the current document is not the disguise page |
| `no-lock-redirect` | no MFA step-up, no session-lock overlay, no login bounce |
| `right-org` | every `/api/crm/modules` row is the PIFH org |
| `nav-profile` | the full shell is rendered (recorded in `env.navProfile`) |
| `not-empty` | the anchor is findable by phone and contacts total ≥ 32 |
| `status-vocab` | the anchor's status is an Active-lane value from `crm_status_vocabulary` |
| `breakpoint` | the project's viewport really renders that breakpoint's chrome |
| `layout-v2` | the record page is `RecordDetailShellV2`, not the retired V1 shell |

Negative runs (proving a trap can fail — never in CI):
`E2E_SKIP_PIN_COOKIE=1` → `TRAP:pin-gate`; `E2E_ANCHOR_PHONE=5550000000` →
`TRAP:not-empty`; `E2E_FORCE_VIEWPORT_WIDTH=1000` → `TRAP:breakpoint`.

## 6. Budgets

Budgets are owner decision **D12**; the headline ones (see `click-walk.md` for
the full statement):

| Task | Budget |
|---|---|
| T1 find by phone | 2 clicks (+ keypresses and the digits) |
| T2 read coverage at a glance | 0 |
| T3 add a note | 1 click + ⌘Enter |
| T4 add a member | 1 click + Enter (+ ≤ 1 to see it on the list) |
| T5 oldest Pending → Call | 1 (desk) / 2 (list) |
| Apply a filter | ≤ 3 (lane chip = 1), mobile sheet ≤ 4 |
| Pager next / rail toggle | 1 |

Every budget actually enforced is in the artifact — regenerate the full table
from any run instead of trusting a copy:

```sh
cd apps/crm && node -e 'const w=require(require("fs").readFileSync("e2e/artifacts/crm-walk/latest.txt","utf8").trim()+"/walk.json");
const m=new Map(); for(const t of w.tasks) if(!m.has(t.id)) m.set(t.id,t);
for(const t of m.values()) console.log(`${t.id}\t${t.budget}\t${t.soft?"soft":"hard"}\t${t.label}`)'
```

## 7. Known noisy log lines (not failures)

- `npm warn install-scripts …` on `npm ci` — npm 11 lists blocked lifecycle
  scripts (`sharp`, `esbuild`, `unrs-resolver`). The packages ship prebuilt
  binaries; the walk is unaffected.
- `npm warn EBADENGINE` for packages that predate Node 24.
- Next dev compile lines (`○ Compiling /crm …`, `✓ Compiled in …`) and a slow
  first render — the first walk task after a cold start absorbs it.
- Supabase CLI `Stopping containers…` / `supabase_… container not found`
  noise from `supabase stop` on a runner whose stack never started.
- Playwright `Error: page.goto: net::ERR_ABORTED` inside a **retained trace** of
  a failed task — read the task's `reason` in `walk.json`, not the trace prelude.
- `[walk] …` lines are the harness's own summary, written by `global-teardown`.

Anything else printed by `apply-local-migrations.sh` — `ALREADY-PRESENT`,
`FAILED` — is meaningful: the first means the file was applied out of band
(nothing is half-applied; the transaction rolled back), the second fails the CI
step under `--strict`.
