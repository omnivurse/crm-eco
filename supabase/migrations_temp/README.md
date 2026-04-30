# migrations_temp/

Drafts and proposals that are **not** part of the applied migration history.

The Supabase CLI scans only `supabase/migrations/` — files in this directory are
never executed by `supabase db push`, `supabase migration up`, or CI.

## Conventions

- **Never reuse a timestamp prefix** that already exists in `supabase/migrations/`.
  Reusing a prefix means that if a temp file is later promoted (moved or copied
  into `supabase/migrations/`), the CLI sees two files claiming the same version
  and refuses to push, or worse, applies the wrong one.

- Files here use a deliberately-future placeholder band: **`202699999NNN_*.sql`**.
  This sorts after every currently-applied migration and signals "draft" at a
  glance. When promoting a draft to real, rename it to a normal `YYYYMMDDNNNN_`
  prefix that is strictly greater than the current head of `supabase/migrations/`.

- Treat each file as a proposal to be reconciled line-by-line against the
  applied schema before promotion. Several drafts here have been superseded
  in part by real migrations — see e.g.
  `supabase/migrations/202603110006_crm_security_control.sql`, which corrects
  the `crm_roles` shape originally drafted in
  `202699999010_crm_governance_roles.sql`.

## Promotion checklist

1. Diff the temp file against the live schema (`supabase db dump` or pgAdmin).
2. Resolve any drift (renamed columns, different RLS, missing org-scoping, etc.).
3. Pick a fresh prefix greater than the current `supabase/migrations/` head.
4. `git mv` into `supabase/migrations/` with the new name.
5. `supabase db push` and verify on the target project.
