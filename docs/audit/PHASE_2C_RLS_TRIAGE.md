# Phase 2C — RLS Triage (pre-enrollment hardening)

> Status: **drafted May 22, 2026.** Migration `202605220011_phase2c_rls_tightening.sql` applies decisions.

## Inventory (live PIFH, May 22, 2026)

`pg_policies` shows **14 policies** that grant unrestricted access via `USING (true)` or `WITH CHECK (true)` to a non-service role. Grouped by risk:

### 🔴 CRITICAL — fix immediately (4 policies, 4 tables)

| # | Table | Policy | Cmd | Roles | Risk | Decision |
| -- | --- | --- | --- | --- | --- | --- |
| 1 | `document_links` | `doc_links_anon_select` | SELECT | `{anon}` | Any anonymous visitor can `SELECT * FROM document_links` → leak every share link's token, expiry, doc-id, and org-id. | **DROP** — edge function `doc-download` uses `service_role` to look up tokens; this anon policy is unused and dangerous. |
| 2 | `billing_job_runs` | `billing_job_runs_insert_service` | INSERT | `{public}` | Any unauthenticated request can `INSERT` arbitrary billing job rows, polluting audit/ops dashboards. | **DROP** — cron + service worker write as `service_role`; existing service_role policy stays. |
| 3 | `email_tracking_events` | `System can insert tracking events` | INSERT | `{public}` | Anyone can forge open / click / bounce events, corrupting deliverability metrics. | **DROP** — webhook receivers (Resend) authenticate with their own service key and the route writes as `service_role`. |
| 4 | `price_change_audit` | `price_change_audit_insert` | INSERT | `{public}` | Public can fabricate audit log rows, breaking compliance integrity. | **DROP** — only `service_role` (triggered from pricing job) may write. |

### 🟡 SCOPE — tighten to a real boundary (1 policy)

| # | Table | Policy | Cmd | Roles | Current | New |
| -- | --- | --- | --- | --- | --- | --- |
| 5 | `crm_role_permissions` | `role_perms_select` (built in Phase 2A migration 010) | SELECT | `{authenticated}` | `USING (true)` — leaks every org's role-permission map. | `USING (EXISTS (SELECT 1 FROM crm_roles r WHERE r.id = role_id AND (r.organization_id IS NULL OR is_crm_member(r.organization_id))))` — see only system templates + your own org's roles. |

### 🟢 ACCEPT (documented) — reference catalogs, no PII, no tenant data (9 policies)

These tables are static pricing / geography / option catalogs that the UI reads on every page. Their global readability is **intentional** (the website plan-comparison page even needs them with `anon`). Leaving them open is fine; we just need to acknowledge it.

| Table | Policy | Why it's safe |
| --- | --- | --- |
| `age_bands` | `age_bands_select` | Insurance age-banding reference; same across all carriers. |
| `benefit_tiers` | `benefit_tiers_select` | Plan-tier reference; published in marketing material. |
| `crm_extension_reviews` | `crm_extension_reviews_select` | Marketplace reviews (intentional public read, like App Store). |
| `crm_permissions` | `perms_select_authenticated` | RBAC v2 permission *catalog* (built in migration 010) — global keys, not assignments. |
| `inactive_reasons` | `inactive_reasons_select` | Dropdown options for reason codes. |
| `plan_healthshare_tier_config` | `plan_healthshare_tier_config_select` | Healthshare pricing tiers; published reference. |
| `plan_traditional_tier_config` | `plan_traditional_tier_config_select` | Traditional-plan pricing tiers; published reference. |
| `rating_areas` | `rating_areas_select` | ZIP→rating-area mapping; published by CMS. |
| `tobacco_multipliers` | `tobacco_multipliers_select` | Tobacco surcharge factors; published reference. |

### 🟢 ACCEPT (documented) — legitimate public form INSERTs, gated by API (4 policies)

These are intentional public-form INSERTs (lead capture, booking, contact). Each policy already has a NULL-check or EXISTS-gate that prevents bare DB scribbling, and the actual API layer needs to do bot/spam protection. Migration leaves them alone; the **server-side captcha helper** is the gate (see "Server-side gating" below).

| Table | Policy | Existing gate | Extra layer added in Phase 2C |
| --- | --- | --- | --- |
| `scheduling_bookings` | `scheduling_bookings_public_insert` | `EXISTS (SELECT 1 FROM scheduling_links WHERE id = link_id AND is_active = true)` | Server-side reCAPTCHA verification in `/api/scheduling/book` (route helper). |
| `chat_sessions` | `chat_sessions_public_insert` | `visitor_id IS NOT NULL` | No active frontend route uses it (legacy `src/components/chat/` directory); skip until wired. |
| `contact_submissions` | `contact_submissions_public_insert` | `name IS NOT NULL AND email IS NOT NULL` | No active frontend route uses it yet; will gate when the website contact form is wired. |
| `scheduled_appointments` | `appointments_public_insert` | `org_id IS NOT NULL AND attendee_email IS NOT NULL` | No active frontend route uses it yet; will gate when the website appointments form is wired. |

## What ships in migration 011

1. `DROP POLICY` × 4 — the 4 CRITICAL anon/public policies.
2. `DROP POLICY` + `CREATE POLICY` — replace `crm_role_permissions.role_perms_select` with the org-scoped version.

That's it for DB-side changes. No tables touched, no data touched, all 4 drops are idempotent (`DROP POLICY IF EXISTS`).

## Server-side gating

* New shared helper `apps/crm/src/lib/security/captcha.ts` — verifies Cloudflare Turnstile + reCAPTCHA tokens (reuses logic from `apps/portal/src/lib/enroll/recaptcha.ts`).
* `apps/crm/src/app/api/scheduling/book/route.ts` — call captcha helper before INSERT.
* Both run in **dev-bypass mode** when `RECAPTCHA_SECRET` / `TURNSTILE_SECRET` env vars are absent, so local dev / preview branches stay frictionless.

## Verification plan

1. `psql -c "SELECT count(*) FROM pg_policies WHERE qual='true' OR with_check='true' AND NOT roles::text='{service_role}'"` should drop from **14 → 10** (the 4 critical removed + 1 scoped down on `crm_role_permissions`).
2. Audit rerun: HIGH `RLS too permissive` finding should drop from 12 → 9 (or be reclassified as documented MEDIUM).
3. Smoke-test `/book/[slug]` flow end-to-end on a staging org.
4. Verify cron `billing_job_runs` insert still works (runs as `service_role`).

## Out of scope (deferred to later phases)

* 8 empty `activity_log_yYYYYmMM` partitions with RLS-enabled-but-no-policies (Phase 4 — pure dead code).
* Adding Cloudflare Turnstile on `contact_submissions`, `scheduled_appointments`, `chat_sessions` — wait until the corresponding website forms are actually wired into production.
* Locking down `crm_permissions` SELECT — keep it global since it's a static catalog (decision documented above).
