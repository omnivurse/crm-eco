# Phase 2A — Missing Tables/RPCs Triage

Date: 2026-05-22
Status: **Awaiting client (Peace Health) build-vs-delete decisions**

After Phase 1 / Phase 2D / Phase 3 we have **27 BLOCKER findings remaining**,
all classified as `Missing tables` (24) or `Missing RPCs` (3). Closer
inspection shows the 27 break down into three very different groups:

| Group | Count | Action |
| --- | --- | --- |
| **Auto-fix** (code points at wrong existing table) | 4 tables | I can fix in code right now — no client decision needed |
| **Easy delete** (low-value stubs, no frontend) | 2 tables | Propose delete unless client objects |
| **Real feature decisions** | 18 tables + 3 RPCs | Walk each below, decide build or delete |

Total code at stake: **3,379 LoC** of API routes + **4,996 LoC** of frontend
pages that reference these missing tables.

---

## Group 1 — Auto-fix (4 tables, ~6 LoC across 6 files)

These four "missing tables" were created when a developer pointed at a
table name that doesn't exist while the *correct* table sits right next to
it. All four are pure rename fixes that I can do in the next pass — no
client input required.

| Code references | DB has | Fix |
| --- | --- | --- |
| `billing` (portal billing page) | `billing_transactions` | Point the portal `/billing` page at `billing_transactions` (member-keyed) |
| `email_queue` (sequence sends) | `sent_emails` with `status='queued'` | Insert into `sent_emails` with `status: 'queued'` so the existing send worker picks it up |
| `pricing_tiers` (Pricing Matrix Editor) | `product_pricing_matrix` | Rename in `PricingMatrixEditor.tsx` — schema matches 1:1 |
| `crm_field_options` (CRM custom field dropdowns) | `crm_fields.options` (jsonb already on the row) | Rewrite the route to read/write the JSONB column on `crm_fields` instead of a separate row table (5 routes, ~210 LoC simplified) |

**Recommendation:** Auto-fix the first three (clean wins). The fourth
(`crm_field_options`) is a bigger refactor — I'll write it but you'll
want to spot-check it before commit.

---

## Group 2 — Easy delete (2 tables)

Stubs that have **no frontend caller** and are not on any product roadmap.

| Table | Sites | Why delete |
| --- | --- | --- |
| `crm_login_history` | 2 (1 route, 0 UI) | Already redundant with Supabase auth `auth.audit_log_entries` and our `unified_audit_logs`. Nothing reads it. |
| `crm_workflow_triggers` | 4 (1 route, 0 UI) | We already added `nodes`/`edges`/`trigger_config` to `crm_workflows` in migration 009. Triggers can live inside `crm_workflows.trigger_config` jsonb. |

**Recommendation:** Delete the routes (~283 LoC of dead code).

**Client decision required?** Probably not — but flagging in case you want
RBAC login-history visibility, in which case build it in Group 4 instead.

---

## Group 3 — Feature decisions (18 tables + 3 RPCs)

Six product-area decisions, each independent. Read each section, pick
**Build** / **Delete** / **Defer** and let me know.

---

### 3A. RBAC v2 — Custom roles, permissions, SSO

**Tables:** `crm_roles`, `crm_permissions`, `crm_role_permissions`,
`crm_sso_config`, `crm_trusted_domains` (5 tables, ~568 LoC of routes)

**Frontend:**
- `apps/crm/src/app/crm/settings/security-control/page.tsx` (admin
  Security Control settings panel — currently 500s when opened)

**What it does:** Lets the client define custom CRM roles beyond the
built-in `crm_admin` / `crm_manager` / `crm_agent`, assign granular
permissions, configure SAML/Okta SSO, and restrict logins to specific
email domains.

**Current alternative:** `profiles.role`/`profiles.crm_role` (text columns)
are already used everywhere for access checks. The hardcoded role list
covers PIF's current org structure.

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 5-table migration + seed default permissions + SSO Okta integration (~3 days) | Drop the security-control settings page; keep hard-coded role checks (~1 hr) | Mark routes as 501 Not Implemented; keep DB clean (~30 min) |

**Recommendation: DELETE** unless the client has asked for SSO. The
built-in roles cover PIF's needs and enrollment season is the wrong time
to ship complex auth changes.

---

### 3B. CRM Pipelines — Kanban stages per module

**Tables:** `crm_pipelines`, `crm_pipeline_stages`, `crm_stage_permissions`
(3 tables, ~632 LoC of routes)

**Frontend:**
- `apps/crm/src/app/crm/settings/pipelines/PipelineSettingsClient.tsx`
  (840 LoC pipeline-builder UI — currently shows empty list / crashes
  on save)

**What it does:** Custom drag-and-drop kanban pipelines per CRM module
(Leads, Deals, Tickets, etc.) with named stages, colors, and per-stage
permissions.

**Current alternative:** `crm_records.stage` (text) + `crm_records.stage_updated_at`
(added in migration 007) already drive a hardcoded stage list per module.
The Leads board / Deals board pages use this directly.

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 3-table migration + seed default stages per module + wire to existing board UI (~2 days) | Remove the pipeline-settings page; existing boards stay on hardcoded stages (~1 hr) | Hide the settings page in nav; keep code dormant (~15 min) |

**Recommendation: DEFER**. Existing boards work fine on hardcoded
stages. Pipeline customization is a Q3 feature, not enrollment-critical.

---

### 3C. CRM Channels — Unified inbox (email/SMS/chat)

**Tables:** `crm_channels`, `crm_channel_credentials`, `crm_inbound_messages`
(3 tables, ~399 LoC of routes)

**Frontend:**
- `apps/crm/src/app/crm/settings/channels/page.tsx`
  (channels admin page)
- `apps/crm/src/lib/inbox/unified-inbox-service.ts` (fallback path
  to `communications` table — only the fallback is broken)

**What it does:** Configure channel-level credentials (SendGrid, Twilio,
chat widget tokens) and route inbound messages into a unified inbox
view, threading replies into CRM records.

**Current alternative:** Outbound email already works via `sent_emails` +
the existing `email-service.ts` (org-level SendGrid creds in env vars).
Inbound webhooks exist (`apps/crm/src/app/api/webhooks/[provider]/route.ts`)
and write to `integration_logs`. Unified inbox itself uses
`inbox_conversations` + `inbox_messages` (which DO exist).

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 3-table migration + UI wire-up + Twilio creds vault (~4 days) | Remove channels settings page; remove the unused `communications` fallback (~2 hrs) | Disable the channels page; keep webhooks working as today (~30 min) |

**Recommendation: DELETE the channels settings page + the
`communications` fallback** (the actual unified inbox uses different
tables that already exist). The channels-config UI was scaffolded but
the live system reads creds from env vars and ENV-driven webhook routing
works.

---

### 3D. Signals & Segmentation — Automation triggers

**Tables:** `crm_signals`, `crm_signal_events` (2 tables, ~426 LoC)
**RPCs:** `fn_compute_segment_membership`, `fn_fire_signal`,
`fn_resolve_signal` (3 functions)

**Frontend:**
- `apps/crm/src/components/contacts/ContactSegments.tsx`
- `apps/crm/src/app/crm/settings/experience/page.tsx`
- `apps/crm/src/components/system-health/SignalsTab.tsx`

**What it does:** Define "signals" (e.g., "Member has not logged in in
30 days") that fire events when their condition is met. Signals drive
segmentations ("All members matching X") and trigger sequences/workflows.

**Current alternative:** `crm_workflows` (which we just enhanced with
`nodes`/`edges`/`trigger_config` in migration 009) already provides
condition-based triggers. Sequences hit members directly via record
filters.

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 2 tables + 3 SQL functions + signal evaluator background job (~5 days — biggest item on the list) | Remove signals UI + segmentation API; rely on workflows for triggers (~2 hrs) | Hide tabs; keep tables empty (~15 min) |

**Recommendation: DEFER**. Workflows cover 80% of the use case. If PIF
specifically asks for segmentation later, build it post-enrollment-season.

---

### 3E. CRM Data Jobs & Export Jobs — Admin bulk operations

**Tables:** `crm_data_jobs`, `crm_export_jobs` (2 tables, ~500 LoC of routes)

**Frontend:**
- `apps/crm/src/components/system-health/DataJobsTab.tsx`
- `apps/crm/src/components/system-health/ExportTab.tsx`

**What it does:** Track long-running admin jobs (mass delete, bulk
update, CSV export) so the UI can show progress and download links.

**Current alternative:** `crm_import_jobs` (which DOES exist and we
already fixed in Phase 3) handles the inverse direction. We could add
`source_type IN ('export','mass_delete','mass_update')` to that same
table and reuse the entire infrastructure.

| Build path | Delete path | Defer path |
| --- | --- | --- |
| Extend `crm_import_jobs` to cover all 4 directions (~1 day) | Remove the two system-health tabs; keep imports working (~1 hr) | Hide tabs (~15 min) |

**Recommendation: BUILD by extending `crm_import_jobs`** — small effort,
high ROI for admin productivity, especially right before enrollment season
when bulk updates happen often.

---

### 3F. Scheduling — Public booking pages

**Table:** `scheduling_bookings` (1 table, ~110 LoC + a frontend page)

**Frontend:**
- `apps/crm/src/app/book/[slug]/page.tsx` (493 LoC — public
  Calendly-style booking page)

**What it does:** Public link (`/book/[advisor-slug]`) where prospects
can pick a time slot and book a meeting with an advisor. Already has
`scheduling_links` table working (advisors can create slugs).

**Current alternative:** None. Without `scheduling_bookings`, the public
booking page accepts the form but cannot save the booking.

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 1-table migration + Google Calendar integration optional (~4 hrs) | Remove `/book/[slug]` route + scheduling_links (~30 min) | N/A — page is currently broken |

**Recommendation: BUILD**. This is on the "enrollment season" critical
path — agents share their booking link with prospects. ~4 hrs of work
that unblocks a public-facing feature. Migration is simple:

```sql
CREATE TABLE scheduling_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES scheduling_links(id) ON DELETE CASCADE,
  host_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invitee_name text NOT NULL,
  invitee_email text NOT NULL,
  invitee_phone text,
  invitee_timezone text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  meeting_type text,
  location text,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  custom_answers jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX scheduling_bookings_link_time_idx ON scheduling_bookings(link_id, start_time);
ALTER TABLE scheduling_bookings ENABLE ROW LEVEL SECURITY;
-- Public can INSERT (it's a booking form); read restricted to org members
```

---

### 3G. `advisor_contact_summary` — denormalized advisor stats view

**Sites:** 2 (1 admin route, 1 lib query)

**What it would do:** A pre-aggregated view of advisors with counts of
their contacts/leads/members per state. Used by the advisor management
admin page.

**Current alternative:** Can be a Postgres VIEW (zero migration cost,
no separate table):

```sql
CREATE OR REPLACE VIEW advisor_contact_summary AS
SELECT
  a.organization_id, a.id AS advisor_id, a.full_name, a.email,
  a.state, a.is_active AS advisor_active,
  COUNT(DISTINCT l.id) AS total_leads,
  COUNT(DISTINCT m.id) AS total_members,
  COUNT(DISTINCT l.id) + COUNT(DISTINCT m.id) AS total_contacts
FROM advisors a
LEFT JOIN leads l ON l.advisor_id = a.id
LEFT JOIN members m ON m.advisor_id = a.id
GROUP BY a.organization_id, a.id;
```

| Build path | Delete path | Defer path |
| --- | --- | --- |
| 5-line VIEW migration (~10 min) | Remove the route + lib helper (~15 min) | N/A |

**Recommendation: BUILD as a VIEW**. Trivial cost, fixes the admin page.

---

## Summary table — recommended actions

| # | Item | Recommendation | LoC delta | Time |
| --- | --- | --- | --- | --- |
| 1 | `billing` / `email_queue` / `pricing_tiers` rename | **AUTO-FIX now** | -50 / +50 | I do it |
| 2 | `crm_field_options` jsonb refactor | **AUTO-FIX now** | -211 / +60 | I do it |
| 3 | `crm_login_history`, `crm_workflow_triggers` | **DELETE** | -283 / 0 | 30 min |
| 4 | `advisor_contact_summary` VIEW | **BUILD** (5-line SQL) | 0 / +20 SQL | 10 min |
| 5 | `scheduling_bookings` table | **BUILD** (single migration) | 0 / +30 SQL | 4 hrs |
| 6 | `crm_data_jobs` + `crm_export_jobs` → extend `crm_import_jobs` | **BUILD** (reuse infra) | -500 / +150 | 1 day |
| 7 | RBAC v2 (5 tables) | **DELETE** stub UI | -1,165 (incl. UI) / 0 | 1 hr |
| 8 | CRM Pipelines (3 tables) | **DEFER** (hide UI, keep code) | 0 / 0 | 15 min |
| 9 | CRM Channels (3 tables) | **DELETE** settings page | -894 (incl. UI) / 0 | 2 hrs |
| 10 | Signals & Segmentation (2 tables + 3 RPCs) | **DEFER** (hide tabs) | 0 / 0 | 15 min |

**If we follow the recommendations above:**

- BLOCKERs drop from **27 → 0** (every missing-table/RPC finding cleared)
- Net code change: **−3,103 LoC of dead/broken code, +260 LoC of
  working code, +50 lines of SQL**
- Time investment: **~2 days of dev work** to clear the backlog
- Enrollment-season feature parity preserved (we BUILD the 2 things
  that block real usage: scheduling bookings + admin job tracking)

---

## How to use this doc

For each numbered item above, tell me **BUILD / DELETE / DEFER** (or
"discuss"). I'll then:

1. Apply the auto-fixes (1, 2) regardless — they unbreak existing code.
2. Execute your decisions on 3-10 as a Phase 2A migration batch
   (everything ships in one push, all in additive migrations or pure
   code deletions).
3. Re-run the audit to confirm zero BLOCKERs remain.
4. Update the remediation plan with the final state.
