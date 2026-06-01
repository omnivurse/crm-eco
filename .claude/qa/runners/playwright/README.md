# Playwright Runners

Real Playwright-driven test harnesses for `qa-data-lifecycle`, `qa-ui-flows`, and `qa-accessibility`.

## Dependencies

Uses the parent project's installed packages. Required:

- `playwright` (browser automation)
- `@supabase/supabase-js` (session cookies + DB reads)
- `axe-playwright` (only for `accessibility.mjs`)

Install if missing:
```bash
npm i -D playwright @supabase/supabase-js axe-playwright
npx playwright install chromium
```

## Environment variables

| Var | Purpose |
|---|---|
| `SUPABASE_ANON_KEY` | Anon key for the test Supabase project |
| `<tenant.password_env>` | Password for each tenant in config.supabase.test_tenants |

## Files

| File | Specialist | What it does |
|---|---|---|
| `lib.mjs` | shared | Sign-in, navigation, console capture, base URL resolution |
| `data-lifecycle.mjs` | qa-data-lifecycle | Per-form write→read→cache trace |
| `ui-flows.mjs` | qa-ui-flows | Per-route smoke (console errors, 5xx, mobile viewport) + auth flow |
| `accessibility.mjs` | qa-accessibility | axe-core per route, aggregated violations |

## Invocation

These are normally invoked by their respective specialist agents. To run standalone:

```bash
node .claude/qa/runners/playwright/data-lifecycle.mjs \
  --config=.claude/qa/config.json \
  --manifest=.claude/qa/manifest.json \
  --out=.claude/qa/reports/manual/raw/qa-data-lifecycle.json \
  --artifacts-dir=.claude/qa/reports/manual/artifacts/data-lifecycle
```

## Session handling

The Playwright runners sign in via Supabase JS (not by driving the login UI), then inject the session cookies into the Playwright `BrowserContext`. Cookie name follows Supabase SSR convention: `sb-<project-ref>-auth-token`. If your app uses a non-standard cookie name, update `signInBrowserContext` in `lib.mjs`.

For projects using NextAuth, Clerk, or custom auth, replace `signInBrowserContext` with provider-specific session setup. The function is intentionally isolated for this reason.

## Cleanup

`data-lifecycle.mjs` cleans up its marker rows in a `finally` block. If a run crashes, search the test DB for `qa-form-*` markers and clean manually.

`ui-flows.mjs` and `accessibility.mjs` perform no writes.
