# PIFH Schema Remediation Plan

> Live, production tenant. Zero data loss. Driving toward enrollment season.
> Source-of-truth audit lives at `.audit/findings.json` and the canvas
> `pifh-hawkeye-audit.canvas.tsx`. **Rerun audit before every phase.**

## Guiding rules

1. **Production database is the source of truth.** When code drifts from DB,
   we fix code first unless the column is genuinely missing.
2. **Every schema change is one migration, transactional, reversible.**
   `BEGIN; ... COMMIT;` and a paired `-- down` block in the comments.
3. **No destructive change without an explicit data-loss audit.** Every
   `ALTER TABLE ... DROP`, `DROP POLICY`, `DROP TABLE` requires:
   - `SELECT count(*) FROM <table>` baseline captured
   - `SELECT count(*) WHERE <col> IS NOT NULL` for columns we touch
   - rationale in commit message
4. **Test on PIFH only after** `pnpm typecheck && pnpm test` pass locally.
5. **Migrations land in branches.** No direct `db push` to prod from main
   without going through `supabase migration list` diff review.

## Severity ladder

| Severity | What it means | Response time |
| --- | --- | --- |
| P0 — Production-breaking | Data is being lost or corrupted right now | This week |
| P1 — User-visible | Users hit 500s or empty screens | This week |
| P2 — Security / Performance | Hardening, indexes, RLS tightening | Next 2 weeks |
| P3 — Hygiene / CI | Type generation, audit-in-CI | After P0–P2 |

---

## Phase 1 — P0 fixes (production data integrity)

### 1A. Stripe subscription writes are silently dropped

**Symptom.** `apps/crm/src/lib/integrations/webhooks/handlers/stripe.ts`
writes `members.subscription_status` and
`members.subscription_current_period_end`. Neither column exists in PIFH.
Every Stripe webhook for an existing subscription update is a silent no-op.

**Fix.** Migration `add_member_subscription_status.sql`:

- `subscription_status text` (mirrored to Stripe values)
- `subscription_current_period_end timestamptz`
- index on `subscription_status` (we filter by it in the dashboard)

Then have the handler also stamp `stripe_customer_id` (currently overwriting
nothing — confirm if column exists or needs adding) and `updated_at`.

### 1B. Self-serve enrollment flow writes to wrong column names

**Symptom.** `apps/portal/src/app/enroll/actions.ts` writes to
`enrollment_steps.status` and `enrollment_steps.data`. Real columns are
`is_completed boolean` and `payload jsonb`. Also writes to
`enrollment_audit_log.user_id` (real name: `actor_profile_id`). The submit
step checks `s.status === 'completed'` which is never written, so submit
always returns "Please complete all steps".

**Fix.** Pure code change — adjust all 22 references in `enroll/actions.ts`
plus any other touchpoints (`apps/crm/src/lib/db/enrollments.ts` if it
exists).

### 1C. Stripe handler still has the rest of the members-table issues

**Symptom.** Same handler writes `merged_into_id`, `merged_at`, `zip_code`,
`market_type`, `authorize_customer_profile_id`. Decide column-by-column:

- `zip_code` → rename in code to `postal_code` (DB truth)
- `authorize_customer_profile_id` → rename to `customer_profile_id`
- `merged_into_id`, `merged_at` → add columns (member merge feature)
- `market_type` → add column (already exists on `crm_records`, mirror it)

---

## Phase 2 — P1 fixes (visible breakage + security)

### 2A. Decide build-or-delete for each missing table — ✅ DONE (May 22, 2026)

**Decisions executed:**

| Table | Decision | Outcome |
| --- | --- | --- |
| `crm_roles`, `crm_permissions`, `crm_role_permissions`, `crm_user_roles` | **BUILD** | RBAC v2 — migration 010, all 6 tables seeded with 5 system roles + 19 permissions + 55 role-perm mappings |
| `crm_sso_config`, `crm_trusted_domains`, `crm_login_history` | **BUILD** | Part of RBAC v2 — migration 010, fully RLS-policied |
| `scheduling_bookings` | **BUILD** | Migration 010 — public-anon INSERT (gated on active link), org-member SELECT/UPDATE |
| `advisor_contact_summary` | **BUILD as VIEW** | Migration 010 — aggregates leads + members per advisor, returns 693 advisors live |
| `crm_import_jobs.download_url` + `expires_at` | **EXTEND** | Migration 010 — now host export jobs + mass-op jobs too |
| `crm_data_jobs` | **REMAP** | Route rewritten to write into `crm_import_jobs` with `source_type='data_job'` |
| `crm_export_jobs` | **REMAP** | Route rewritten to write into `crm_import_jobs` with `source_type='export'` |
| `crm_field_options` | **REFACTOR** | Route rewritten to read/write `crm_fields.options` JSONB (legacy `["str"]` arrays auto-upgraded on read) |
| `billing` | **REMAP** | Portal billing page now reads from `billing_transactions` with explicit column mapping |
| `email_queue` | **REMAP** | enrollment-service now writes to `sent_emails` with `status='queued'` |
| `pricing_tiers` | **REMAP** | Admin pricing editor now reads/writes `product_pricing_matrix` (UI types preserved) |
| `crm_pipelines`, `crm_pipeline_stages`, `crm_stage_permissions` | **DEFER** | Pipelines settings page now redirects; API routes return `[]` / 501; nav entries removed |
| `crm_signals`, `crm_signal_events`, `fn_compute_segment_membership`, `fn_fire_signal`, `fn_resolve_signal` | **DEFER** | Signals API routes return `[]` / 501; signals tab removed from System Health; Experience Center card removed |
| `crm_channels`, `crm_channel_credentials`, `crm_inbound_messages` | **DELETE UI, keep env-driven** | Channels UI page + 3 API routes deleted; 2 nav entries removed; env-driven email/SMS providers (Resend, Twilio) remain in `apps/crm/src/lib/integrations/*` |
| `crm_workflow_triggers` | **DELETE** | Stub route deleted; trigger config lives in `crm_workflows.trigger_config` JSONB |
| `communications` | **DELETE FALLBACK** | Removed fallback path from `unified-inbox-service.ts`; `inbox_conversations` is canonical |

**Audit impact:** 27 BLOCKERs → **0 BLOCKERs**. Down to 19 total findings
(6 HIGH = 4 NACHA stub columns + 12 over-permissive RLS deferred to Phase 2C
+ 1 migration drift deferred to Phase 4).

**Build/typecheck/data integrity:** all 5 apps build clean; all 5 apps
typecheck clean; PIFH row counts unchanged (advisors 693, members 1,062,
enrollments 1,098, crm_records 15,304, sent_emails 11); 0 broken FK rows.

### 2B. `crm_records.org_id` vs `organization_id` (36 call sites)

The DB has `org_id`. The frontend tends to use `organization_id`. Two options:

1. Add a view `crm_records_v` exposing `organization_id` and migrate code.
2. Rewrite all 36 call sites to use `org_id`.

Recommendation: **option 2** — direct rename in code. Cleaner, less indirection.

### 2C. Tighten dangerous RLS — ✅ DONE (May 22, 2026)

Migration `202605220011_phase2c_rls_tightening.sql` ships:

- DROP `document_links.doc_links_anon_select` — service_role path
  (edge function `doc-download`) already handled it; anon path was unused.
- DROP `billing_job_runs.billing_job_runs_insert_service` — service-role-only.
- DROP `email_tracking_events."System can insert tracking events"` — webhook
  receivers use service_role.
- DROP `price_change_audit.price_change_audit_insert` — audit integrity.
- REPLACE `crm_role_permissions.role_perms_select` — scoped from `USING(true)`
  to per-org (system templates + caller's-org rows only).

Server-side gating shipped alongside:

- `packages/lib/src/security/captcha.ts` — Cloudflare Turnstile + reCAPTCHA
  v3 verifier with dev-bypass + remote-IP propagation.
- `apps/crm/src/app/api/scheduling/book` — rate-limit (5/60s/IP) +
  captcha + RLS-EXISTS triple defense.

Full triage (including the 9 accepted-as-intentional reference-catalog
policies and the 4 public-form INSERTs left in place pending frontend
wiring) lives in `docs/audit/PHASE_2C_RLS_TRIAGE.md`.

The 8 tables with **RLS enabled but no policies** are all empty
`activity_log_yYYYYmMM` partitions — pure dead code, deferred to Phase 4
cleanup.

### 2D. Missing indexes

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_records_module_id_idx
  ON crm_records (module_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_records_owner_id_idx
  ON crm_records (owner_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_records_status_idx
  ON crm_records (org_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_records_stage_idx
  ON crm_records (org_id, stage);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_activities_record_id_idx
  ON crm_activities (record_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_activities_assigned_to_idx
  ON crm_activities (org_id, assigned_to);
```

`CONCURRENTLY` so we don't lock the table during business hours.

---

## Phase 3 — P2 (remaining drift cleanup)

Cycle: pick one table → look at all `unknown_column` findings for it → fix
all references in one PR → rerun audit → commit when that table is at zero
findings. Continue until `unknown_columns` is empty.

Suggested order (by call-site count):

1. `members` (subscription columns + zip/postal_code + customer_profile_id)
2. `enrollments`  (plan_id, member_id, enrollment_code naming)
3. `crm_records` (after the org_id pass)
4. `crm_activities` (type vs activity_type, etc.)
5. `billing_transactions`
6. `report_run_history`
7. `commission_transactions`
8. `advisor_playbooks` (org_id, name, content)
9. `profiles` (full_name vs first/last)
10. `email_templates`, `plans`, `invoices`, everything else

## Phase 4 — P3 (don't let this happen again) — ✅ DONE (May 22, 2026)

1. ✅ **Typed Supabase client refreshed.** `pnpm db:generate-types` now strips
   the CLI's trailing "new version" notice so the file always typechecks.
   Regenerated `packages/lib/src/types/database.ts` → 41,428 lines, +12
   entries from recent migrations (RBAC v2 tables, scheduling_bookings,
   advisor_contact_summary, increment RPCs). Purely additive; all 5 apps
   typecheck clean.
2. ⏳ Replace every `(supabase as any)` with the typed client — graduated
   over time; the typed `Database` is now correct so new code can just
   import `Database` from `@crm-eco/lib`. Old `as any` sites remain on the
   backlog.
3. ⏳ Lint rule banning `as any` for Supabase calls — deferred (would
   produce hundreds of breakages today; revisit after a sweep PR).
4. ✅ **CI + pre-push hook wired.**
   - `.github/workflows/hawkeye-audit.yml` runs the full pipeline on every
     PR + push to `main`. Uses the shared `PIFH_SUPABASE_DB_URL` secret.
   - `.audit/scripts/check-baseline.mjs` compares findings against
     `.audit/baseline.json`. Fails CI only on NEW findings at
     `AUDIT_FAIL_AT` (default `HIGH`).
   - `.audit/scripts/pre-push.sh` is an opt-in local hook that runs
     inventory + crossref + baseline-check before each push (no DB
     credentials needed — reuses the local `.audit/schema/` snapshot).
5. ✅ **Operator's guide.** `docs/audit/README.md` documents the entire
   pipeline (refresh → inventory → crossref → baseline), how to read
   findings, how to accept intentional findings, how CI plugs in, and
   how the pre-push hook works.

### Migration drift cleanup
Pre-Phase-4 audit reported "344 migrations in repo not applied on PIFH"
— turned out to be two issues:
- `.audit/schema/applied_migrations.csv` had been overwritten with a
  bad CSV containing full SQL bodies as quoted strings, so the audit
  was reading 0 valid versions.
- Migrations 010 + 011 had been applied with raw `psql -f` (not the
  Supabase CLI), so they were in the DB but missing from
  `supabase_migrations.schema_migrations`.

Both fixed by:
- Refreshing the CSV from live (now contains 344 clean version strings).
- Registering 010 + 011 in the migration tracker with `INSERT ... ON CONFLICT DO NOTHING`.
- Adding `.audit/scripts/refresh-schema.sh` so the CSVs can never drift
  again (called by both the local pipeline + CI).

After cleanup: **0 migrations missing in either direction.**

---

## How to run the audit locally

See `docs/audit/README.md` for the full operator's guide. Quick version:

```bash
export PIFH_SUPABASE_DB_URL='postgresql://postgres.<ref>@aws-1-us-east-2.pooler.supabase.com:5432/postgres'
export PGPASSWORD='...'

.audit/scripts/refresh-schema.sh        # pull schema snapshot
node .audit/scripts/inventory.mjs       # build code inventory
node .audit/scripts/crossref.mjs        # generate findings
node .audit/scripts/check-baseline.mjs  # fail if any NEW HIGH+ finding
```

Same four commands run automatically on every PR via
`.github/workflows/hawkeye-audit.yml`.

## Status log

| Date | Phase | What changed | Findings before | Findings after |
| --- | --- | --- | --- | --- |
| 2026-05-22 | baseline | Hawkeye audit complete | n/a | 192 (141 BLOCKER) |
| 2026-05-22 | 1B + audit-script bugfixes | Enrollment flow uses correct columns; audit script no longer flags `typeof === 'string'` or upsert `onConflict` as columns | 192 | 146 (97 BLOCKER) |
| 2026-05-22 | 1B continued | enrollments.member_id→primary_member_id, plan_id→selected_plan_id, enrollment_code→enrollment_number, monthly_cost→total_monthly_cost, premium→total_monthly_cost, signature_date→signature_timestamp, org_id→organization_id (10 sites across analytics, terminal command registry, commission-service, agent/reports, crm/enrollment/actions) | 146 | 139 (96 BLOCKER) |
| 2026-05-22 | 2B (partial) | crm_records.contact_type/tags → use `data` JSONB; cron route uses `org_id`; new migration adds `crm_records.stage_updated_at` + trigger + index | 139 | 137 (96 BLOCKER) |
| 2026-05-22 | Missing RPCs | Removed misuse of `.rpc('increment')` and `.rpc('coalesce')` (fetch-then-update); migration `202605220008` defines `increment_template_usage`, `increment_recently_viewed_count`, `increment_landing_page_views` | 137 | 135 (94 BLOCKER) |
| 2026-05-22 | Migrations pushed to PIFH | Applied migrations 003–008 to live tenant. All 15 new columns, 5 functions/triggers, 8 indexes verified in DB. | 135 | 119 (79 BLOCKER) |
| 2026-05-22 | Phase 3 part 1 — naming drift | advisor_playbooks, report_run_history, plans, invoices, crm_activities, crm_tasks, email_templates, crm_import_jobs, unified_audit_logs, integration_logs, dependents, admin_notifications, email_sequence_step_executions, activities, campaign_tracking_events, email_campaigns, enrollment_contracts — code rewritten to use real DB column names everywhere | 119 | 91 (59 BLOCKER) |
| 2026-05-22 | Phase 3 part 2 — missing columns migration | Migration 009 adds 18 columns + 2 column alterations across 12 tables (profiles.member_id, invoices.member_id, memberships.enrollment_id, commission_transactions bonus fields, email_templates from/reply, report_run_history.template_key, etc.). Backfilled profiles.member_id via email match. Pushed to PIFH; all 20 column changes verified, 6 indexes + 4 FKs in place. | 91 | 58 (27 BLOCKER) |
| 2026-05-22 | Phase 3 part 3 — HIGH-severity renames | advisors avatar via profile join, parent_advisor_id, profiles.is_active vs status, tasks.assignee_id, leads.advisor_id, email_tracking_events → email_events (sent_email_id join), landing_page_events scoped via landing_pages, commission_rates via agent_level_id | 58 | **48 (27 BLOCKER)** |
| 2026-05-22 | Build verification | Typecheck + `next build` on all 5 apps (crm, admin, portal, website, advisor-portal) — every app compiles cleanly. Live-DB row counts unchanged (1,062 members, 1,098 enrollments, 15,304 crm_records, 0 broken FKs). | 48 | 48 (27 BLOCKER) |
| 2026-05-22 | **Phase 2A** — executed all client decisions | Migration 010 ships RBAC v2 (6 tables + seeds + RLS + audit triggers), `scheduling_bookings`, `advisor_contact_summary` VIEW, `crm_import_jobs.{download_url,expires_at}` + NULLable `module_id`. Code: billing→billing_transactions, email_queue→sent_emails, pricing_tiers→product_pricing_matrix, crm_field_options→crm_fields.options JSONB, data-jobs/export-jobs→crm_import_jobs, channels routes + UI deleted, workflow_triggers route deleted, communications fallback removed, pipelines + signals UI hidden (deferred). | 48 | **19 (0 BLOCKER)** |
| 2026-05-22 | **Phase 2C** — RLS hardening + NACHA column-drift cleanup | Migration 011 drops 4 critical wide-open policies (`document_links.doc_links_anon_select`, `billing_job_runs.*_insert_service`, `email_tracking_events."System can insert tracking events"`, `price_change_audit.price_change_audit_insert`) and rescopes `crm_role_permissions.role_perms_select` from `USING(true)` to per-org check. Added shared captcha verifier (`packages/lib/src/security/captcha.ts`) supporting Turnstile + reCAPTCHA with dev-bypass; wired into `/api/scheduling/book` alongside rate-limit (5 req/60s/IP). NACHA admin pages remapped to real schema (`transaction_type`, join to `payment_profiles.account_last4`/`payment_type`); routing-number documented as hydrated at export time from Authorize.net (never stored locally per PCI). | 19 | **15 (0 BLOCKER)** |
| 2026-05-22 | **Phase 4** — Audit pipeline production-ready | Migration drift cleanup: registered migrations 010+011 in `supabase_migrations.schema_migrations` and refreshed `.audit/schema/applied_migrations.csv` (the old CSV had been corrupted with quoted SQL bodies). Drift HIGH eliminated. Built `.audit/scripts/refresh-schema.sh` — reproducible, CSV-correct dump of 14 schema artifacts (tables, columns, FKs, indexes, RLS, triggers, enums, etc.); fixed previously-broken FK + indexes CSV column names that crossref relied on. Built `.audit/scripts/check-baseline.mjs` + `.audit/baseline.json` snapshot of accepted findings; CI fails only on NEW HIGHs. Wired `.github/workflows/hawkeye-audit.yml` (runs on every PR + push to main) and `.audit/scripts/pre-push.sh` (opt-in local hook). Regenerated `packages/lib/src/types/database.ts` from PIFH (41,428 lines, +12 entries from recent migrations); fixed `pnpm db:generate-types` to auto-strip CLI tail noise. Operator's guide shipped at `docs/audit/README.md`. | 15 | **14 (0 BLOCKER)** |

### Migrations pushed (2026-05-22)
All applied to PIFH (live tenant). Verified via `information_schema.columns`, `pg_proc`, `pg_indexes`:

1. `202605220003_member_subscription_and_merge_columns.sql` ✅
2. `202605220004_hotspot_indexes.sql` ✅
3. `202605220005_enrollment_stripe_payment_columns.sql` ✅
4. `202605220006_enrollment_audit_and_profile_columns.sql` ✅
5. `202605220007_crm_records_stage_updated_at.sql` ✅
6. `202605220008_counter_increment_rpcs.sql` ✅
7. `202605220009_phase3_missing_columns.sql` ✅ — 18 cols added + 2 altered, 6 indexes, 4 FKs, profiles.member_id backfill
8. `202605220010_phase2a_rbac_scheduling_view.sql` ✅ — RBAC v2 (7 tables: crm_roles, crm_user_roles, crm_permissions, crm_role_permissions, crm_login_history, crm_trusted_domains, crm_sso_config) + seeds + RLS + audit triggers; scheduling_bookings; advisor_contact_summary VIEW; crm_import_jobs extensions
9. `202605220011_phase2c_rls_tightening.sql` ✅ — 4 wide-open policies dropped (`document_links` anon SELECT, `billing_job_runs` public INSERT, `email_tracking_events` public INSERT, `price_change_audit` public INSERT) + `crm_role_permissions.role_perms_select` rescoped from `USING(true)` to per-org check. Zero data touched (all DROP/CREATE on policies only).

All 344 repo migrations are now registered in PIFH's `supabase_migrations.schema_migrations`; `comm -3` of repo vs PIFH = empty. Future migrations must go through `supabase db push` (or be manually registered) so the tracker never drifts again.

### Phase 2A — what shipped (executed May 22, 2026)

**Migration 010 — DB scaffolding (PIFH live):**
- **RBAC v2:** 7 tables (`crm_roles`, `crm_user_roles`, `crm_permissions`, `crm_role_permissions`, `crm_login_history`, `crm_trusted_domains`, `crm_sso_config`) with full RLS, audit triggers, and seeds (5 roles + 19 permissions + 55 role-perm mappings).
- **Helper:** `has_crm_permission(user_id, permission_key)` RPC.
- **scheduling_bookings:** table + indexes + RLS (public-anon INSERT gated on active link; org-member SELECT/UPDATE; admin DELETE).
- **advisor_contact_summary VIEW:** aggregates leads + members per advisor (returns 693 advisors live).
- **crm_import_jobs:** added `download_url text` + `expires_at timestamptz`; dropped NOT NULL on `module_id` to support cross-module exports.

**Auto-fixes (table renames):**
- `billing` → `billing_transactions` in `apps/portal/src/app/billing/page.tsx` (with explicit column mapping).
- `email_queue` → `sent_emails` in `apps/crm/src/lib/sequences/enrollment-service.ts` (status='queued').
- `pricing_tiers` → `product_pricing_matrix` in `apps/admin/src/components/products/PricingMatrixEditor.tsx`.

**Refactors:**
- `crm_field_options` route now reads/writes `crm_fields.options` JSONB; auto-upgrades legacy `["str"]` arrays on read.
- `crm_data_jobs` route now writes into `crm_import_jobs` with `source_type='data_job'`; data-job-specific fields stashed in `stats` JSONB.
- `crm_export_jobs` route now writes into `crm_import_jobs` with `source_type='export'`; export-specific fields in `stats`, `download_url` first-class.

**Deletes (no UX impact — features were never wired):**
- `apps/crm/src/app/api/automation/workflows/triggers/route.ts` (use `crm_workflows.trigger_config` JSONB instead).
- `apps/crm/src/app/api/crm/channels/{route.ts,credentials/route.ts,inbound/route.ts}` (env-driven providers remain).
- `apps/crm/src/app/crm/settings/channels/page.tsx` (UI page).
- `communications` fallback in `apps/crm/src/lib/inbox/unified-inbox-service.ts`.
- 3 nav entries (channels x2, signals, pipelines x1).

**Defers (UI hidden, code preserved for re-enablement):**
- Pipelines settings page now redirects to `/crm/settings?notice=pipelines_deferred`; API routes return `[]` / 501.
- Signals API routes return `[]` / 501; signals tab removed from System Health.
- Segmentations PATCH endpoint returns 501 (membership compute deferred); `crm_segmentations` table still queryable for the static segments UI.
- 2 settings cards removed ("Pipeline Management", "Experience Center").

### Phase 2C — what shipped (executed May 22, 2026)

**Migration 011 — RLS hardening (PIFH live):**
- DROP `document_links.doc_links_anon_select` — anon could `SELECT * FROM document_links` and harvest every share token. The `doc-download` edge function uses service_role anyway, so the anon policy was unused.
- DROP `billing_job_runs.billing_job_runs_insert_service` (public INSERT) — anyone could fabricate billing job runs. Cron/worker use service_role.
- DROP `email_tracking_events."System can insert tracking events"` (public INSERT) — anyone could forge open/click/bounce events. Webhook receivers use service_role.
- DROP `price_change_audit.price_change_audit_insert` (public INSERT) — audit integrity attack. Only the pricing job (service_role) may write.
- REPLACE `crm_role_permissions.role_perms_select` — was `USING(true)` for authenticated (leaked cross-org permission maps). Now scoped to: system templates (`organization_id IS NULL`) OR rows owned by an org the caller is a CRM member of.

**Server-side gating (CRM app):**
- New shared helper `packages/lib/src/security/captcha.ts` — Cloudflare Turnstile + reCAPTCHA v3 with dev-bypass when no secret is configured, automatic best-effort `remoteip` extraction (cf-connecting-ip > x-real-ip > x-forwarded-for).
- `apps/crm/src/app/api/scheduling/book` — adds rate-limit (5 req/60s per IP) + captcha verification before the booking INSERT. Three defensive layers: rate-limit → captcha → RLS `EXISTS(active link)`.

**NACHA column-drift cleanup (admin app):**
- 4 references to non-existent `billing_transactions.{type, routing_number, account_number_last4, payment_method}` rewritten to use real columns + join to `payment_profiles` (`transaction_type`, `payment_profile.account_last4`, `payment_profile.payment_type='ach'`).
- Routing-number is documented as hydrated at export time from Authorize.net via `payment_profile_id` — never stored locally per PCI/NACHA constraints.

**Accepted as intentional (documented in `docs/audit/PHASE_2C_RLS_TRIAGE.md`):**
- 9 wide-open `SELECT USING(true)` policies on reference catalogs (`age_bands`, `benefit_tiers`, `crm_extension_reviews`, `crm_permissions`, `inactive_reasons`, `plan_healthshare_tier_config`, `plan_traditional_tier_config`, `rating_areas`, `tobacco_multipliers`) — published reference data, no PII, no tenant data.
- 4 public-form INSERT policies (`chat_sessions`, `contact_submissions`, `scheduled_appointments`, `scheduling_bookings`) — left in place; `scheduling_bookings` now gated at the API layer too, and the other 3 will be gated when their respective frontends are wired into production.

### Remaining 15 findings (all non-blocker)

- **2 HIGH:** 9 over-permissive RLS policies (all documented-accepted reference catalogs); 344 migration drift → Phase 4.
- **7 MEDIUM:** mix of unverified joins, unknown columns, dynamic chain calls.
- **5 LOW:** minor.
- **1 INFO:** baseline.

### Outstanding decisions for the user

1. **Set the `PIFH_SUPABASE_DB_URL` GitHub Actions secret** (if not already
   set by `pifh-deploy-gate.yml`). The Hawkeye audit workflow uses it to
   refresh the schema snapshot on every PR.
2. **Configure production captcha secrets** before enrollment season opens:
   set either `TURNSTILE_SECRET` (preferred — Cloudflare, free, no privacy
   footprint) or `RECAPTCHA_SECRET` on the CRM Vercel project. Without
   either, the captcha helper logs a PRODUCTION misconfig warning and
   bypasses verification (intentional dev behavior).
3. **Optional Phase 2C-bis:** when the public website's contact form /
   appointments page / chat widget is wired up, route them through API
   endpoints that call the same `verifyCaptcha` helper. Until then their
   RLS policies remain as-is (NULL-checks + EXISTS gates).
4. **Backlog (post-launch):** sweep the codebase for `(supabase as any)`
   usages and replace with the typed client. The `Database` type is now
   accurate against PIFH so the sweep can be done incrementally without
   regressing functionality. Once the count is near-zero, add an ESLint
   rule to forbid new `as any` on Supabase calls.
