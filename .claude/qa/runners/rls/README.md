# RLS Runner

Real two-tenant + anon RLS probe. Inserts a marker row as tenant A, attempts cross-tenant access as tenant B and as anon, cleans up.

## Dependencies

Uses the parent project's installed packages. Required:

- `@supabase/supabase-js` (usually already in any Supabase project)

If not installed:
```bash
npm i -D @supabase/supabase-js
```

## Environment variables

| Var | Purpose |
|---|---|
| `SUPABASE_ANON_KEY` | Anon key for the test Supabase project |
| `<tenant.password_env>` | One per tenant — password for that test account |

Set these in your shell or via `.env.local` (not committed). The runner reads them at runtime.

## Setup

In your test Supabase project (never prod):
1. Create two test user accounts (e.g., `qa-tenant-a@example.com`, `qa-tenant-b@example.com`)
2. Create two organizations and put each tenant in one
3. Record the org_id values in `.claude/qa/config.json` under `supabase.test_tenants[]`
4. Set the passwords as env vars referenced by `password_env` in config

## Invocation

```bash
node .claude/qa/runners/rls/run-rls-tests.mjs \
  --config=.claude/qa/config.json \
  --manifest=.claude/qa/manifest.json \
  --out=.claude/qa/reports/<ts>/raw/qa-auth-rls.json
```

This is normally invoked by the `qa-auth-rls` agent, not run by hand.

## Output

JSON conforming to the `specialistOutput` schema in `runners/_lib/findings.mjs`. Findings include:
- Cross-tenant SELECT/UPDATE/DELETE leaks (P0)
- Anon role exposure (P0)
- Missing per-command policies (P0/P1)
- `user_metadata` in policy text (P1)
- `FOR ALL` policies (P2)

## Cleanup

Marker rows are auto-deleted in a `finally` block. If the harness crashes mid-test, search for `qa-rls-*` in your test project and delete manually:
```sql
DELETE FROM <table> WHERE name LIKE 'qa-rls-%';
```
