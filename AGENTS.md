# AGENTS.md

## Cursor Cloud specific instructions

This is a Turborepo (`npm` workspaces) for a health-sharing CRM platform. See `README.md` for the product overview and the canonical script list. This section only captures non-obvious setup/run caveats for cloud agents.

### Layout & services
- `apps/crm` — primary product, Next.js 16 on port **3000** (`npm run dev --workspace=@crm-eco/crm`). Backed by Supabase + auth.
- Other Next.js apps: `apps/member-portal` (@crm-eco/portal, 3001), `apps/admin` (3002), `apps/advisor-portal` (3003), `apps/doublehelixhub` (3003), `apps/website` (3004).
- `packages/*` (`lib`, `ui`, `enrollment`, `rates`) and `shared` are TS-source workspaces consumed directly (no build step needed for dev).
- There is also a root-level Vite app (`index.html`, `src/`, `vite.config.ts`); `npm run dev` at the root runs `turbo dev` across all app workspaces.

### Dependencies
- Install with `npm install` (this is the startup update script). `.npmrc` sets `legacy-peer-deps=true`; keep it.
- Node 20+/22 is fine (`engines.node >=18`).

### Runtime backend (NOT covered by the update script)
The apps need a Supabase backend. Docker, the Supabase CLI, and `postgresql-client` are runtime prerequisites and are intentionally **not** in the update script (system deps). If they are missing on a fresh VM, install them, then start a local stack:
1. Start `dockerd` if not already running (no systemd in this VM): `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`. Docker must use the `fuse-overlayfs` storage driver (`/etc/docker/daemon.json`) and `iptables-legacy`.
2. `supabase start` from the repo root brings up Postgres/Auth/Studio/Mailpit. Keys: `supabase status -o json` (use `ANON_KEY`, `SERVICE_ROLE_KEY`, `API_URL=http://127.0.0.1:54321`).

### CRITICAL migration gotcha (fresh local DB)
Migration `supabase/migrations/202606280001_pifh_org_agent_hierarchy.sql` is a **production data backfill** that `RAISE EXCEPTION`s if advisor `dc91befa-0364-49cf-9cfa-b452f0f49a28` is absent — so it always fails on a fresh local DB and aborts `supabase start`. Workaround for local dev:
1. Move that one file out of `supabase/migrations/` temporarily, run `supabase start` (all other 63 migrations apply cleanly), then move it back so the repo tree stays clean.
2. It is a prod hierarchy backfill and is **not required** for local development; you can leave it un-applied, or insert a stub advisor root (org `00000000-0000-0000-0000-000000000001`) and apply it manually via `psql` if you want a complete migration history.
No other migration has this apply-time data dependency (the other `RAISE EXCEPTION`s are inside function bodies).

### Seeding + a working login (fresh DB)
`supabase start` does not run the seeds under `supabase/seed/` (they are not at the default path). After migrations:
1. `psql "$DB_URL" -f supabase/seed/seed.sql` — creates the Demo Health org `00000000-0000-0000-0000-000000000001`.
2. `psql "$DB_URL" -f supabase/seed/crm_seed.sql` — creates CRM modules/fields.
3. Create a confirmed user with the service-role admin API (`auth.admin.createUser({ email_confirm: true })`). The `on_auth_user_created` trigger only inserts a `profiles` row when `organization_id` is present in user metadata, so for a hand-made user you must **insert the `profiles` row yourself** (required NOT NULL cols: `user_id, organization_id, email, full_name, role, ui_preferences`). Set `crm_role='crm_admin'` (and optionally `is_super_admin=true`) to grant CRM access.

### Env for the CRM app
Create `apps/crm/.env.local` (gitignored) with local Supabase values:
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>`, `SUPABASE_SERVICE_ROLE_KEY=<service_role>`. Feature integrations (Resend/OpenAI/Stripe/Twilio) are optional and not needed for core CRM flows.

### PIN gate
All Next.js apps render a client-side PIN overlay ("Lead Generation Quote System"). Default PIN is **`012049`** (`packages/ui/src/components/pin-lock-overlay.tsx`); override via `NEXT_PUBLIC_SITE_PIN`.

### Lint / test / build (known states on a clean checkout)
- Tests: `npm run test --workspace=@crm-eco/crm` (all pass) and `@crm-eco/rates` (pass). `@crm-eco/lib` has **one pre-existing, date-sensitive failing test** in `eligibility.test.ts` ("zero days" waiting period) — unrelated to environment setup.
- Lint: `npm run lint` (turbo). Tooling works; `advisor-portal` and `website` are clean, but `crm`, `admin`, `member-portal`, and `doublehelixhub` currently report **pre-existing** ESLint errors (React Compiler `react-hooks/*` rules, a `no-restricted-syntax` rule, and a `doublehelixhub` config that ignores all files). Lint is **not** gated by CI or the git hooks.
- Pre-push hook runs only `npm run workspace:hygiene` and `npm run typecheck:crm` (both pass). `typecheck:crm` is the reliable green gate.
- Build: `npm run build:crm` (or `npm run build --workspace=@crm-eco/crm`, which uses `next build --webpack`). Dev is `npm run dev --workspace=@crm-eco/crm`.
