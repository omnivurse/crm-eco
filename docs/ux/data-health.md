# Data Health — the deterministic sweep, the score, and the ratchet

Data Health v1 is the data-quality twin of `walk.json`: a **pure, deterministic
rules engine** that sweeps the whole PIFH book and produces a scored, versioned
report. Deterministic rules **decide**; AI (v2) only ever **proposes**; nothing
in this system mutates a record — every query is a SELECT.

## The pieces

| Piece | Where |
| --- | --- |
| Rule catalog + THE score formula | `apps/crm/src/lib/crm/data-health/score.ts` |
| Prod sweep script (read-only) | `scripts/audit-crm-data-health.mjs` |
| Latest committed report | `apps/crm/src/lib/crm/data-health/report.latest.json` |
| Ratchet baseline (approved run) | `apps/crm/src/lib/crm/data-health/ratchet.baseline.json` |
| Ratchet test | `apps/crm/src/lib/crm/data-health/ratchet.test.ts` |
| Data Health page | **`/crm/data-health`** — CRM › Data Quality › Data Health (also Settings › Data Health) |
| The API behind it | `apps/crm/src/app/api/crm/data-health/route.ts` (+ `executor.ts`, `recorded.ts`) |

## The page and the API

`/crm/data-health` is reached from the CRM sidebar's **Data Quality** section,
right under Review Duplicates — the place a person already goes to ask "is the
book clean?" — and from the **Settings index card** / Settings › Data Management
for the admin who starts there. All three entries carry `managerOrAdmin`, the
same gate the page itself enforces (`crm_admin | crm_manager`, anyone else is
redirected), so nobody is offered a bounce.

`GET /api/crm/data-health` runs the catalog and returns
`{ score, formulaVersion, asOf, generatedAt, bookSize, source, rules[], errors[] }` —
rule keys, labels, counts and record IDS only, never names, phones, emails or
DOBs. It role-gates in the route, pins every query to the caller's
`profile.organization_id`, caches `private, max-age=60`, and a rule that throws
lands in `errors` while the rest of the sweep still reports (the page says so:
a score that skipped checks may read better than reality).

**The sweep connection.** The rules are SQL, and PostgREST cannot execute a
statement, so the sweep runs over a read-only Postgres connection instead of the
service-role REST client:

- `SUPABASE_DB_URL` when set — opened with `default_transaction_read_only=on`,
  one connection, a statement timeout, closed when the sweep ends. A write is
  refused by the server, not by convention (`executor.test.ts` proves it against
  the local stack).
- No env var, but the Supabase API URL is loopback → the standard
  `supabase start` DSN. This default can never reach a hosted project.
- Neither → **no live sweep**: the route serves the committed
  `report.latest.json` as `source: 'recorded'` with its `asOf` date, and the
  page says out loud that these are the last recorded numbers, not live ones.
  A recorded sweep is only ever served to the org it was recorded for.
- `source: 'recorded'` in production is the signal to add `SUPABASE_DB_URL` to
  the crm-core Vercel project; the page flips to live with no code change.

## Running the sweep

```bash
npm run audit:data-health                       # sweep prod, print table, write report.latest.json
node scripts/audit-crm-data-health.mjs --md out.md --json out.json --as-of 2026-08-23
```

- Credentials come from `apps/crm/.env.local` (service role). The key is never
  printed. **Everything is read-only.**
- Every time-relative rule (stale-pending 45d, stuck-imports 24h, future DOBs)
  keys off `--as-of` (default: today UTC), which is stamped into the report —
  two runs over unchanged data produce **identical** counts.
- Output is **PII-free by construction**: record ids and counts only. Never
  names, phones, emails, or DOBs — in the report file, in stdout, anywhere.
  The Data Health page resolves ids to titles client-side through the normal
  RLS-gated APIs when an admin clicks through.

## Reading the score

Severity tiers: **error** = integrity broken (orphaned notes, links to missing
members, impossible dates) · **warn** = meaning broken (retired status words,
unmatched producer names, drifted twins) · **info** = workflow smell (open dupe
queue, stale pending).

What moves the number (`computeScore` in `score.ts`, formula v2):

- Start at 100. Each tier owns a fixed budget it can ever take away:
  **errors 60 · warns 30 · info 10**.
- The budget splits evenly across the rules in the tier, so one noisy rule can
  never spend another rule's points.
- Within a rule the penalty saturates: `share × count/(count+25)`. The first
  few bad records cost the most (25 bad records = half the rule's share);
  thousands cannot cost more than the full share — but **every single fixed
  record still nudges the score up**.

## Formula v2 — the field-correctness pass (2026-08-23)

The first sweep scored **72.7**. Re-measured against production, six rules were
reading a column that is not where their concept lives, so their counts did not
mean what their labels claimed. Nothing about the formula, the weights or the
18 keys changed — the *rules* did — so **a v1 count and a v2 count are not
comparable** and must never be charted as one series. The corrected sweep
scores **76.1**.

| Rule | v1 | v2 | Why the v1 number was wrong |
| --- | ---: | ---: | --- |
| `completeness.member-core` | 995 | 4 | `members.effective_date` is vestigial (2 of 997); coverage dates live on `enrollments` (1,098/1,098) |
| `lifecycle.no-owner` | 425 | 21 | ownership is per module — `data->>'lead_owner'`, `data->>'contact_owner'`, `normalized_advisor_name` |
| `vocabulary.producer` | 785 | 20 | `advisors.full_name` is composite ("Person - Company"); counted in spellings, the fixable unit |
| `twins.contact-member` | 85 | 64 | compare identity *families* — a second phone/email is the same person, not drift |
| `completeness.unreachable` | 66 | 65 | this book's second email key is `secondary_email` (1,262), not `email2` (29) |
| `refs.orphan-tasks` | 3 | 0 | `crm_tasks.record_id` is nullable by design; a standalone task is a feature |
| `lifecycle.stale-pending` | 0 | 41 | `updated_at` was mass-reset by the August backfill; `stage_updated_at` survived |
| `refs.trash-batch` | 0 | 2 | both sides of the old join are 0% populated; the real gap is *no* batch receipt |
| `lifecycle.null-status` | 4 | 5 | the sweep now covers every module, as the SQL always did |
| `dates.impossible` | 7 | 7 | same total, different rows: coverage-before-birth now read from `enrollments` |

`vocabulary.product` and `ingest.stuck-imports` still report 0, but their
labels and `describe` now say why: no product dropdown list has been curated
(13,574 live records carry an unvalidatable free-text product), and
`crm_import_jobs` is empty. A zero over an empty table is not a clean bill of
health, and the page says so.

The standing rule this pass established: **a query that parses and returns a
number proves nothing.** A rule is correct only when the column it reads has
been shown, against real data, to be the column its concept lives in.

## The ratchet — the score only moves one way on purpose

`ratchet.test.ts` (runs with the normal vitest suite) compares the committed
`report.latest.json` against `ratchet.baseline.json`:

- Any **error/warn count above baseline fails the build** — quality cannot
  silently get worse.
- Any **count below baseline also fails** until the baseline is refreshed —
  wins get locked in, same discipline as the toast ratchet.
- The report's stored score must equal `computeScore` over its counts, and the
  baseline must be internally consistent — the formula cannot drift without a
  `FORMULA_VERSION` bump and a deliberate refresh.

To accept a new approved run (after a sweep):

```bash
cd apps/crm && npm run data-health:ratchet:update
```

Refreshing the baseline is an **owner-visible act** (commit diff shows every
count that moved). Never refresh to get past a rising count — fix the records.

## Deliberately deferred to v2

- **History table + trend line** — v1 persists nothing server-side; gated on
  the migration-ledger decision (NO new tables in v1).
- **Nightly cron** — reuse the existing automation-cron pattern
  (`api/cron/*` + `vercel.json`) once the migration gate opens.
- **AI triage cluster** — AI proposes fixes for rule hits; deterministic rules
  remain the only decider.
