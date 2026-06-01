# CRM-ECO Product Discovery, Audit & Roadmap

**Prepared for:** CTO Review
**Date:** 2026-06-01
**Method:** Evidence-grounded static analysis with adversarial score re-verification
**Scope:** 14 functional areas + SaaS readiness + security + technical debt + 9-dimension scorecard

---

## 1. Executive Summary

CRM-ECO is a broad, ambitious multi-tenant CRM built as a Turborepo npm-workspaces monorepo of six Next.js 16.1.6 apps (`apps/crm`, `apps/portal`, `apps/advisor-portal`, `apps/admin`, `apps/website`, `apps/doublehelixhub`) on a large, disciplined Supabase backend (365 migrations, ~384 tables, ~354 RLS-enabled, 1,582 indexes). Its single best-engineered layer is the database: row-level security is keyed on `profiles`/`auth.uid()` rather than JWT/`user_metadata`, fails closed via `is_super_admin()`, and a previously-latent cross-tenant leak across 11 PII/PHI tables was correctly remediated in migration `202605300012` and verified by an authenticated cross-tenant staging spec. The product is built on a genuinely strong, reusable core: a generic, configurable `modules + crm_records` engine powers leads, deals, contacts, and members uniformly, with per-org seeding of modules/fields/layouts/views, a capable org-scoped trigger automation engine, and an exemplary additive/reversible `org_id → organization_id` tenant-key strangler migration.

That solid foundation is, however, pervasively undermined by **duplicate/parallel systems and a large surface of half-built, orphaned, or fabricated features**. The codebase contains three commission ledger systems, four-plus automation/sequencing stacks, two communications stacks, two template stores, two ticket schemas, three-to-four enrollment flows, two agent apps, and a fully intact ~34.7k-LOC legacy Vite SPA still tracked and targeted by the root `npm run build`. Several headline capabilities silently do nothing in production: the single most important scheduler endpoint (`/api/automation/cron`) is unscheduled, so cadences, delayed workflow steps, scheduled workflows, and SLA escalation never run; sequence emails are written as `queued` rows no worker consumes; scheduled reports have no executor; campaign open/click tracking is never wired; and the staff ticket experience does not exist in the live Next.js CRM (members file tickets into a write-only black hole).

The most serious findings cut across security and production readiness. A **live production Supabase service-role key** (RLS-bypassing, project `sffisarikcreyyjzdjvb`) is committed in a git-tracked `.env.vercel` file. Authorization is fragmented across three role systems plus an entirely orphaned custom-RBAC engine that is never consulted by any authorization decision (security theater). Multiple integration webhooks have weak or absent auth (GoTo presence-only signature check; `workflow-processor` no auth), OneDrive tokens use XOR obfuscation, enrollment contract PDFs containing PHI are exposed via public URLs, and the ~29-spec test suite (including the cross-tenant isolation specs) is not run by any CI workflow, so money/enrollment/RLS regressions can merge to `main` undetected. There are no automated DB backups and no error-tracking/observability sink.

For the stated white-label SaaS direction, **tenant data isolation is real but productization is largely unrealized**: branding/logos/colors are stored per-tenant yet never rendered in authenticated chrome; feature flags, system settings, and SSO enforcement are persisted but inert; pipelines/stages customization is deferred; and several integrations plus all AI run on a single global credential set. The product is best characterized as a capable, demo-ready pilot for a single tenant (PIFH) rather than a finished, configurable platform.

After adversarial re-verification of the dimension scores against the live repository, the verified overall completeness assessment is: **Based on the current implementation, CRM-ECO is approximately 49% complete toward its vision as a fully productized multi-tenant CRM platform.**

---

## 2. Executive Scorecard

All scores use the `verifiedDimensions.finalScore` values. Five dimensions (Architecture, Security, UX, Reporting) were adversarially re-verified against the live repo with explicit verdicts; the remaining four were not separately re-verified and carry their original scores unchanged.

| # | Dimension | Original Score | Verified Score | Adjusted? | Justification (summary) |
|---|-----------|:--------------:|:--------------:|:---------:|-------------------------|
| 1 | Architecture | 58 | **58** | No (verified, holds) | Strong, right-shaped core (`modules + crm_records` engine, org-scoped automation, disciplined schema, exemplary tenant-key strangler) undermined by pervasive duplicate systems (4+ automation stacks, 3 commission ledgers, 2 comms/template stores, 2 ticket schemas, 2 agent apps) and an intact ~34.7k-LOC legacy Vite SPA still built by root `npm run build`. Mid-strangler tenant-key duality. Verified: all load-bearing claims confirmed in repo. |
| 2 | Security | 47 | **47** | No (verified, holds) | Real DB-layer isolation (RLS keyed on `profiles` not JWT, fail-closed `is_super_admin()`, 202605300012 remediation verified by cross-tenant spec) defeated for anyone with repo access by a committed live prod service-role key in tracked `.env.vercel`. Compounded by forgeable/unauthenticated edge functions (GoTo presence-only auth, `workflow-processor` no auth), XOR token obfuscation, SELECT-only RLS on money tables, public-URL PHI contracts, plaintext PCI, and decorative/fragmented RBAC. Verified verbatim from source. |
| 3 | Scalability | 48 | **48** | No (not re-verified) | Strong DB perf posture (1,582 indexes incl. partial/GIN/tsvector, MVs + pg_cron, idempotent/advisory-locked jobs) but application read paths repeatedly violate the performance budget: forecasting/Revenue load all deals client-side; reports/leads, reports/pipeline have no `.limit()`; analytics `.limit(10000)`; members list capped at 200 with client-side search; agent downline N+1. Understood but inconsistently applied (kanban capped at 5000 with banner). |
| 4 | SaaS Readiness | 38 | **38** | No (not re-verified) | Genuine multi-tenant data isolation + org switching, with real per-org config for modules/fields/comms/dev keys. But white-label productization is unrealized: branding/colors/logos stored but never rendered; custom RBAC orphaned; system-settings + feature flags inert; pipelines/stages deferred; report templates/widgets hardcoded for all tenants; no per-tenant seed-on-create; global shared credentials for payments/telehealth/AI; VoIP tables lack `org_id`; member portal hardcoded "Double Helix Hub". |
| 5 | UX | 50 | **50** | No (verified, holds) | Finished surfaces are strong (v2 record detail, drag-drop kanban, unified inbox, hand-built calendar, report builder, PWA portal) but the surface is riddled with 404 dead-ends (enrollment `/intake`+`/payment`, downline `/[id]`, Custom Dashboards `/new`, calendar disconnect), runtime-throwing exports, 100% mock Operations Center with fake loading timer, hardcoded-empty panels, a false "email sent" booking confirmation, fabricated member data, non-functional buttons, and no staff ticket UI. Verified: every claim confirmed. |
| 6 | Reporting | 55 | **55** | No (verified, holds) | Real, injection-safe execution backbone (allowlisted `%I/%L` RPCs, advisor/healthcare caching, MVs, org-scoped RLS, 6-step builder) but significant deliverables unfinished/broken: charts never rendered (config stored, never drawn), XLSX/PDF export throws, scheduled reports have no executor, Custom Dashboards 404, ~12 widgets stubbed despite working RPCs, multi-module RPC ignores `p_columns/p_filters`, two custom-report systems. Verified verbatim. |
| 7 | Automation | 48 | **48** | No (not re-verified) | Capable org-scoped `crm_workflows` engine (14 actions, idempotency, run logging, retry, full UI) and well-engineered, scheduled billing/commission/payout/email jobs. But `/api/automation/cron` (sole driver of cadences, delayed steps, scheduled workflows, SLA escalation) is unscheduled; `delay_wait` is a no-op; sequence emails are queued but never sent; SLA policies are never enforced; triggers are fire-and-forget with no durable queue. 4+ overlapping systems. |
| 8 | AI Readiness | 33 | **33** | No (not re-verified) | Exactly three real end-to-end features (OpenAI field-suggest, OpenAI email-draft, Gemini Rx pricing) — org-scoped, graceful fallback. Everything else absent or fake: no summarization/classification/sentiment/churn/transcription/RAG in live apps (only the dead legacy SPA, which leaks `VITE_OPENAI_API_KEY` client-side). No per-tenant AI config: single global key, hardcoded enable flag, no quota/opt-out, PHI to OpenAI without BAA controls. |
| 9 | Product Completeness | 50 | **50** | No (not re-verified) | Impressive breadth; the enrollment-first core is the most mature slice (idempotent create RPC, contracts, recurring billing, lifecycle crons). But uneven: no staff ticket UI, config-only SLA, 404 enrollment dead-ends, RLS-blocked payout workflow, `enrollments.member_id` bug, fabricated forecasting, silent cadences/scheduled-reports/sequence-emails. Area maturity spread 28–72 (Database 72; Contacts 68; Leads/Reporting/Frontend 58; Communications/Production Readiness 46; AI 42; Tickets 28). A capable single-tenant pilot, not a finished product. |

**Verified overall: ~49% complete toward the fully productized multi-tenant CRM vision.**

---

## 3. Feature Inventory

Status legend: **complete** | **partial** | **broken** | **missing** | **deprecated** | **planned**.

### 3.1 Leads & Pipeline (maturity 58)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| crm_records | Lead list (CRUD) via generic module system | complete | `apps/crm/src/app/crm/leads/page.tsx:25`; `apps/crm/src/lib/crm/queries.ts:501-570` | No dedicated leads UI; reuses module list engine. Real org/owner/territory scoping + pagination. |
| crm_records | Lead detail page | complete | `apps/crm/src/app/crm/leads/[id]/page.tsx:9`; `RecordDetailShellV2.tsx:462` | Generic record detail shell keyed off `module.key === 'leads'`. |
| crm_records | Create Lead with on_create workflows + scoring | complete | `record-create-service.ts:122-142` | Fires on_create workflows + lead scoring on insert. |
| leads (legacy table) | Standalone CreateLeadDialog on legacy `leads` table | deprecated | `apps/crm/src/components/leads/create-lead-dialog.tsx:148-191`; no render site | Orphaned second lead data model. Migration/strangler debt. |
| crm_records / members | Convert Lead → Member | complete | `apps/crm/src/app/api/crm/leads/convert/route.ts:37,48`; migrations 202601120002, 202606010002, 202606010004 | Admin/manager only; service-role RPC; hardened pending-future-start + insurance copy. |
| crm_records | Convert Lead → Contact (optional merge) | complete | `convert-to-contact/route.ts:37,46`; migration 202603090001 | Double-convert + dup-email guards, audit log. |
| crm_records | Record merge (keeper + duplicate) | complete | `merge/route.ts:52,77` | Admin/manager; re-parents children, audits, deletes dup. |
| crm_records (deals) | Kanban pipeline board (drag-drop) | complete | `pipeline/page.tsx:50-95`; `PipelineBoard.tsx:35-75` | Capped at 5000 deals with truncation banner. Optimistic revert on gating. |
| crm_records | Stage-change enforcement (blueprint gating + validation + workflows) | complete | `stage-change/route.ts:70-171`; migration 202601210001 | Org guard; admin-only skipValidation. |
| crm_deal_stages | Deal stages config (CRUD API + WIP + history) | partial | `stages/route.ts`; `queries.ts:1449-1503` | Editable via API/kanban gear but no settings UI; falls back to 6 hardcoded defaults. |
| crm_pipelines (removed) | Custom pipelines + stage permissions (settings) | deprecated | `pipelines/route.ts:18-41` (501 stub); `settings/pipelines/page.tsx:14` (redirect) | Intentionally deferred post-enrollment; dead code retained on disk. |
| crm_records (deals) | Forecasting (revenue projection) | broken | `forecasting/page.tsx:54-61,247,361-369,273-277,329` | Hardcoded probabilities/$100k target, fabricated fallback bars, unbounded client read, wrong date field. |
| crm_records (leads) | Leads report | partial | `reports/leads/page.tsx:51-156,197-202,127` | Real server stats but unbounded fetch + hardcoded funnel statuses. |
| crm_records + history | Pipeline report (velocity/aging/win rate) | partial | `reports/pipeline/page.tsx:102-215,104,255-259` | Strong logic but hardcoded stage NAMES (differ from kanban keys) + unbounded fetch. |
| automation | Lead scoring engine | partial | `automation/scoring.ts:51-60`; `record-create-service.ts:134` | Runs on create only; no re-score on update; no admin UI in leads area. |
| automation | Lead assignment/routing | partial | `automation/assignment.ts`; `actions.ts:1173` | Only reachable as workflow action; no dedicated UI. |
| crm_cadences | Cadences (multi-step sequences) | broken | `cadences/page.tsx:101-212`; `cadence.ts:406-542`; `vercel.json` (no cron) | Engine + CRUD exist but advancement cron unscheduled; enrollments stall at step 0; "0 active" hardcoded. |
| email_sequences | Email sequences (parallel system, cron-wired) | complete | `sequences/process/route.ts:22`; `vercel.json` (every minute) | Live cron-scheduled; overlaps crm_cadences (duplicate-systems concern). |
| crm_records | At-risk / stale deals surfacing | complete | `queries.ts:1226-1275`; `reports/pipeline/page.tsx:188-215` | Defensive name/key closed-value matching. |
| crm_records | Deal war room | partial | `deals/[id]/war-room/page.tsx:1-40` | Client-side per-deal console; present and functional-looking. |
| saved_views | Saved views for Leads board | complete | `leads/actions.ts:44-197` | Role-gated, org+owner scoped. |
| automation | Trigger entry points (create/update/stage/webform/inbound) | complete | `types.ts:183`; `webforms/route.ts:251`; `webhooks/inbound/route.ts:262` | Workflow engine wired into all entry points. |

### 3.2 Contacts & Members Lifecycle (maturity 68)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| contacts | Contacts route (reuses module engine) | complete | `contacts/page.tsx:13-22`; `contacts/[id]/page.tsx:7-10` | Redirects to generic module list/record detail. |
| crm-engine | Generic module/field/layout/view seeding | complete | `seed.ts:23-29,32-85,109-211` | Per-org service-role seeding. "Member" label maps to deals key (naming overlap). |
| contacts | Module list with contacts sub-tabs | complete | `modules/[moduleKey]/page.tsx:25-40` | Groups/segments/lifecycle/medicaid/carriers/premiums tabs. |
| crm-engine | Record detail (overview/notes/timeline/related/attachments, V1+V2) | complete | `r/[recordId]/page.tsx:86-296`; `RecordDetailShellV2.tsx` | Promise.allSettled with graceful fallback; lazy Suspense tabs. |
| crm-engine | Record create/edit + patch service | complete | `record-patch-service.ts:75-342` | Workflows/scoring/PHI audit/optimistic concurrency/blueprint stage protection. |
| crm-engine | Notes (per-record + aggregated + legacy Zoho) | complete | `NotesPanel.tsx`; `queries.ts:906-986`; `note-sanitize.ts` | Cross-record dedup, rich text, sanitize. |
| tasks | Tasks/activities | complete | `queries.ts:992-1052`; `tasks/route.ts` | My-tasks, upcoming, calendar, completion. |
| crm-engine | Attachments/documents | partial | `queries.ts:1601-1623`; `r/[recordId]/page.tsx:52-74` | crm_attachments only; portal `member_documents` NOT surfaced. |
| crm-engine | Record timeline (merged) | partial | `queries.ts:1625-1791` | Reads crm_deal_stage_history; auto-activation writes crm_stage_history → likely missing from timeline. |
| contacts | Categories / Contact Groups | complete | migration 202603110016; `contact-groups/route.ts` | Typed groups + membership. |
| member-sync | Member↔crm_records sync triggers | partial | migration 202605300015:10-324 | One-way only (members→crm); errors swallowed as WARNINGs (silent). |
| member-sync | Family-shared-email member sync | broken | migration 202605300015:269,314; `supabase/drafts/202605300016` (DRAFT) | Bug B1 live: 2nd same-email family member invisible in members module; fix not applied. |
| members | Members CRM list page + summary + API | complete | `members/page.tsx:49-73`; `api/members/route.ts:10-167` | Capped at `.limit(200)` with client-side search (scale ceiling). |
| lifecycle | Auto-activate Pending→Active cron | complete | `cron/activate-pending-members/route.ts:128-397`; `vercel.json` (0 6 * * *) | Paginated, idempotent outbox, dry-run; writes crm_stage_history (not read by timeline). |
| lifecycle | HealthShare age-65 auto-cancellation | complete | `age-65-auto-cancel.ts:34-51`; migration 202605060009 | Live-on-view RPC (in hot read path) + daily cron + outbox. |
| lifecycle | Member lifecycle event tracking + analytics | complete | migration 202603120006; `ContactLifecycle.tsx:45-334` | KPIs, timeline, cancellation reasons. |
| lifecycle | Churn/retention + Medicaid tracking | complete | `analytics/churn/route.ts`; `ContactMedicaid.tsx` | Descriptive analytics. |
| crm-engine | Status/stage transitions (blueprint-gated) | complete | `TransitionModal.tsx:41-308`; `transition/route.ts:38-60` | Required fields, reason, approval routing; writes crm_stage_history. |
| dedup | Record dedup + merge | complete | `MergeRecordDialog.tsx`; `resolve-record.ts:175-221` | Keeper-wins RPC, soft-merge, stale-URL redirect. |
| dedup | Historical member dedup merge + active-uniqueness index (C2) | complete | migration 202605300014:12-95 | Family members (email+name) excluded from grouping. |
| dedup | Member find-or-create dedup helper | complete | `memberDedup.ts:17-40`; tests | Email + name, excludes merged rows. |
| dedup | Enrollment idempotency keys | complete | migrations 202605300013, 202604210001; tests | Prevents dup member/enrollment. |
| contacts | Lead → Contact conversion (carries insurance + start date) | complete | `convert-to-contact/route.ts`; migration 202606010004 | |
| crm-engine | Related records / links panel | complete | `queries.ts:1509+`; `RelatedRecordsPanelClient.tsx` | |
| crm-engine | Record insights / AI context / follow-up reminders | complete | `record-insights.ts`; `cron/follow-up-reminders/route.ts` | Hourly cron. |

### 3.3 Tasks, Calendar & Scheduling (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| tasks | Task creation (basic form) | complete | `tasks/new/page.tsx`; `api/tasks/route.ts:76-127` | Maps medium→normal, pending→open. No assignee/type/link/recurring in form. |
| activities | Task list / activities view | complete | `activities/page.tsx:161-185` | `/crm/tasks` is a redirect. |
| tasks | Task assignment (assigned_to) | partial | `api/tasks/route.ts:108`; `api/crm/tasks/route.ts:158` | DB/API support but no UI picker; effectively self-assign. |
| tasks | Task due dates | complete | `api/tasks/route.ts:106`; migration 202601110001 | Indexed. |
| tasks | Recurring / follow-up tasks | partial | migration 202605140001; `cron/follow-up-reminders/route.ts` | Only follow_up re-notifies; no RRULE; no new task rows spawned. |
| tasks | Task complete / update | complete | `api/crm/tasks/[id]/route.ts:34-119`; `CalendarView.tsx:6-19` | Drag-to-reschedule via PATCH. |
| tasks | Duplicate task API systems | broken | `api/tasks/route.ts` vs `api/crm/tasks/route.ts` vs `api/crm/activities/route.ts` | Two CRUD APIs + call-log API over crm_tasks; divergent schemas. |
| calendar | Internal calendar (month/week/day) | complete | `calendar/page.tsx:92-1372` | Full hand-built grid, mobile sheet, event modal. |
| calendar | Create event from calendar UI | broken | `calendar/page.tsx:1215-1228` | Client-side crm_tasks insert; omits created_by/assigned_to (owner-less rows). |
| calendar | Module-level record calendar | complete | `CalendarView.tsx:1-60,259` | Drag-to-reschedule + offline cache. |
| calendar | Orphaned ActivityCalendar component | deprecated | `components/calendar/ActivityCalendar.tsx` | 447 LOC imported nowhere. |
| calendar | Google Calendar integration | complete | `adapters/calendar/google-calendar.ts` (640 LOC); `calendar/connect/route.ts` | Real Calendar API v3, incremental sync, Meet, PKCE. |
| calendar | Microsoft Outlook calendar integration | complete | `adapters/calendar/microsoft-outlook.ts` (639 LOC) | Delta-sync path wired. |
| calendar | Calendar sync engine | complete | `calendar/sync/route.ts:18-274`; migration 202602090001 | Org-scoped RLS, sync tokens. |
| calendar | Calendar disconnect | missing | `calendar/page.tsx:847` (DELETE to non-existent route) | UI 404s. |
| calendar | OAuth token persistence on refresh | partial | `google-calendar.ts:485-526` | Refreshes in-memory only; tokens lost between requests. |
| scheduling | Scheduling links (Calendly-style) | complete | `scheduling/page.tsx`; `api/scheduling/route.ts`; migration 202602080002 | Full CRUD, slug uniqueness, org-scoped RLS. |
| book | Public booking page (`/book/[slug]`) | partial | `book/[slug]/page.tsx`; `api/scheduling/book/route.ts` | Rate-limit + captcha + anon RLS; but false "email sent", no calendar/task created, naive conflict check. |
| scheduling | Bookings management list | broken | `scheduling/page.tsx:208-215` | Hardcoded empty state; never queries scheduling_bookings. |
| scheduling | Duplicate booking schema | broken | migrations 202602080002:49-129, 202605220010:518-589 | scheduled_appointments (dead) has `WITH CHECK (TRUE)` open anon-insert RLS. |
| calendar | Meeting tracking | partial | `calendar/page.tsx:139-177`; migration 202601170001 | Meetings = crm_tasks rows; `/crm/meetings` is empty 404 dir. |
| organizer | Organizer / daily dashboard | partial | `organizer/page.tsx:60-156,314-322` | "Today's Schedule" hardcoded empty; scratchpad localStorage-only. |
| scheduling | Generic scheduler/automation tick (cron) | complete | `api/crm/scheduler/tick/route.ts` | CRON_SECRET-protected. |
| all | Automated tests | missing | (none found) | Zero coverage for the area. |

### 3.4 Communications — Email/SMS/VoIP/Inbox (maturity 46)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/crm | Individual outbound email | complete | `communications/send/route.ts:69-114`; `send-service.ts:77-276` | Provider abstraction, per-org config, rate limit, List-Unsubscribe. |
| supabase/functions | Edge function send-email | complete | `send-email/index.ts:121-204` | Org-scoped, {{var}} substitution. Parallel path. |
| apps/crm | Unified inbox UI | complete | `inbox/page.tsx:75-366`; `unified-inbox-service.ts:48-262` | Realtime, threading, keyboard, mobile. |
| supabase/functions | Inbound email intake + threading | complete | `email-intake/index.ts:286-486,124-178` | Svix verify, multi-tenant org resolution. |
| supabase/functions | Email scheduled-send | partial | `send-scheduled-emails/index.ts:60-232` | Depends on out-of-band pg_cron not in vercel.json. |
| apps/crm | Email delivery/open/click/bounce tracking (Resend) | complete | `webhooks/email/resend/route.ts:53-178` | Svix verify, dead-letter, auto-suppress. Best-in-class. |
| apps/crm | SendGrid email webhook | partial | `webhooks/email/sendgrid/route.ts`; `webhooks/sendgrid/route.ts` | Two routes (duplicate/legacy). |
| apps/crm | Bulk email campaigns | partial | `campaigns/page.tsx`; `campaigns/[id]/send/route.ts:14-318` | Batch sender; but no suppression check, no sent_emails log, no pixel injection. |
| apps/crm | Campaign open/click tracking infrastructure | broken | `tracking/open/[id]/route.ts:46-75`; `campaigns/[id]/send/route.ts:280-318` | Pixel/link routes exist but never injected → counts stay ~0. |
| apps/crm | Email sequences/drip | broken | `sequences/process/route.ts:22`; `enrollment-service.ts:197-215` | executeEmailStep writes sent_emails `status='queued'` no worker consumes → never sent. |
| apps/crm | Individual SMS send (Twilio) | partial | `send-service.ts:285-370`; `dispatcher.ts:289-455` | Two send paths; no SMS compose UI. |
| apps/crm | Inbound SMS receive (Twilio) | partial | `webhooks/twilio/inbound/route.ts:49-254` | Writes crm_messages NOT inbox_messages; no STOP handling. |
| apps/crm | SMS delivery status callbacks | complete | `webhooks/twilio/status/route.ts:46-130` | Signature verified. |
| apps/crm | SMS opt-out / STOP handling | missing | `webhooks/twilio/inbound/route.ts:75-170` | No STOP detection; TCPA gap. |
| supabase/functions | VoIP calling / click-to-call (GoTo) | missing | `integrations/phone/page.tsx:1-15` | Config card only; no dialer/API client. |
| supabase/functions | VoIP call logging via GoTo webhook | broken | `goto-webhook-processor/index.ts:94-367` | Tables have NO migration, no org_id, no app consumer; signature never verified. |
| supabase/functions | Call recording/transcription | missing | `goto-webhook-processor/index.ts:313-361` | Columns always null; no pipeline. |
| supabase/functions | Ticket email send (helpdesk) | complete | `send-ticket-email/index.ts:49-278` | Per-org from, retry, branded HTML. |
| apps/crm | Message templates | partial | `comms/templates/route.ts:23-115`; `dispatcher.ts:167-179` | Two template systems (email_templates vs crm_message_templates). |
| apps/crm | Email domain verification (DKIM) | partial | `email/domain-verification.ts`; migration 202601180002 | Tables + lib exist; full DNS flow not traced. |

### 3.5 Template System (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| crm_message_templates | CRM email/SMS templates (org+module scoped) | complete | migrations 202601140001:33-53, 202602080003:7-24 | category/usage_count/is_system; RLS-enabled. |
| email_templates | Slug-based transactional/marketing templates | complete | migration 202602070006:9-26; types.ts:17249-17293 | A SECOND store; template_type/version/variables. |
| apps/crm | Template manager UI | complete | `settings/templates/page.tsx:216-755`; `api/settings/templates/route.ts` | LazyEmailEditor; preview uses hardcoded sample data. |
| apps/crm | SMS templates | complete | `api/settings/templates/route.ts:69-76`; `SmsCampaigns.tsx:83-91` | First-class channel in crm_message_templates. |
| lib/comms | Merge-token engine ({{namespace.field}}) | complete | `mergeFields.ts:13-275` | DoS cap, nesting depth, safe-empty, preview. Strongest part. |
| send-email + packages/lib | Simple {{key}} merge engine | complete | `send-email/index.ts:121-143`; `email-service.ts:438-446` | Weaker, divergent engine on email_templates path. |
| supabase + apps/crm | Template usage tracking | complete | migration 202605220008:37-54; `[id]/route.ts:159-174` | Hardened increment RPC. crm side only. |
| supabase RLS | Permissions / RLS on templates | complete | migrations 202601140001:383-389, 202602070006:505-516 | Org-scoped; API checks present. |
| supabase seed | Default email templates seeding | partial | migration 202603070010:28-352 | One-time backfill; no org-creation trigger → new orgs get none. |
| crm/records | Note templates (call/meeting/follow-up) | partial | `note-templates.ts:1-147` | 8 hardcoded client-side constants; "planned for PR 5". |
| comms UI | Template selection in compose/inbox | partial | `TemplatePicker.tsx:36`; `compose/page.tsx:316` | Split backing store; Settings templates invisible in inbox composer. |
| email_domains | Email domains / sender addresses | complete | migration 202602080003:30-115 | DKIM/SPF/DMARC; per-org white-label sending. |
| supabase + apps/crm | Template versioning | missing | migration 202602070006:21; types.ts:17270 | `version` column never incremented/read; no history table. |
| — | Call scripts | missing | `note-templates.ts:1-147` | No tables/components/APIs. |

### 3.6 Reporting & Analytics (maturity 58)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| Report Builder | Custom report builder (6-step wizard) | complete | `ReportBuilderWizard.tsx`; `builder/page.tsx` | Dynamic modules+fields; edit via `?id=`. |
| Reports API | Report CRUD (list/create/get/update/delete) | complete | `api/reports/route.ts:17`; `[id]/route.ts:34,90` | Org-scoped; creator+is_shared access. |
| execute | Simple single-table query path | complete | `execute/route.ts:193,206,310` | Injection-safe column allowlist, ~20 operators. |
| execute | Server-side aggregation (RPC) | partial | `execute/route.ts:104`; migration 202603100002:26,69 | Injection-safe but JSONB custom-module fields unresolved. |
| execute | Multi-module query (RPC) | partial | `execute/route.ts:168`; migration 202603080002:7,78 | `p_columns`/`p_filters` IGNORED in SQL. |
| Reports lib | CRM field-path resolution (incl. JSONB) | complete | `report-field-path.ts:49`; `.test.ts:4` | Unit-tested; applied only on simple path. |
| Reports lib | Report template library (16 templates) | complete | `lib/reports/index.ts:35`; `templates/[id]/page.tsx:109` | 9 categories incl. advisors + healthcare. |
| Advisor Reports | Advisor performance reports + caching | complete | `advisor/execute/route.ts:29`; migration 202603120001 | 4 RPCs, 15-min cache, run history. |
| Healthcare Reports | Network coverage / provider search | complete | `healthcare/execute/route.ts:23,79,114` | RPC-backed, org-scoped cache. |
| Reports pages | Prebuilt operational reports (pipeline/sales/activity/leads) | complete | `reports/pipeline/page.tsx:217,255` | Real server queries. |
| Reports pages | Saved report viewer | partial | `saved/[id]/page.tsx:178,425` | Table only; charts not visualized; export can throw. |
| Reports API | Report run history + increment | complete | `[id]/history/route.ts:33,103`; migration 20260125000000:43 | Fire-and-forget logging. |
| Reports lib | Report export (CSV/JSON/XLSX/PDF) | broken | `lib/reports/index.ts:311,326`; `saved/[id]/page.tsx:286` | Only csv+json; XLSX/PDF throw at runtime. |
| Builder + Viewer | Report visualization / charts | missing | `types.ts:2`; `StepVisualize.tsx:38` | Config stored but no chart library renders results. |
| Scheduled Reports | Scheduled reports (CRUD UI) | broken | `scheduled/page.tsx:158,243`; migration 202602080004:212 | No executor; rows stored, never delivered. |
| Dashboards | Customizable widget grid | complete | `widget-registry.ts:10`; `page.tsx:30,202` | 27 widgets, drag-drop, server prerender. |
| Dashboards | Per-widget data wiring | partial | `page.tsx:43,49`; `widget-registry.ts:70` | ~12 widgets stubbed to empty despite working RPCs. |
| Analytics | Enterprise analytics suite | complete | `analytics/page.tsx:208`; `advisor-summary/route.ts:28` | 11 routes, MVs, 4 fleshed-out pages. |
| Analytics backend | Materialized views + pg_cron refresh | complete | migration 202603100004:22,64,682 | Concurrent-safe refresh + on-demand endpoint. |
| Dashboards | Custom dashboards builder | broken | `analytics/dashboards/page.tsx:7,27` | Links to non-existent `/new` route (404); no backend. |
| Revenue | Revenue Command Center | partial | `revenue/page.tsx:231,249,334` | Loads all deals client-side; Quotes/Invoices/Commissions tiles hardcoded 0. |
| Reports (duplicate) | Settings > Custom Reports (custom_reports) | partial | `settings/reports/page.tsx:243`; migration 202601150001:293 | Second custom-report system; metadata-only. |
| Reports API | Saved report filters | complete | `api/reports/filters/route.ts`; migration 202603120001:3 | Org-scoped RLS. |

### 3.7 Tickets, Support & SLA (maturity 28)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/portal | Member portal ticket creation | complete | `SupportTicketForm.tsx:38`; `support/actions.ts:43-132` | Canonical schema, org-scoped. |
| apps/portal | Member view own tickets list | complete | `memberPortal.ts:241-269`; `SupportTicketsList.tsx:1-49` | Capped at 20. |
| apps/portal | Member dashboard tickets card | complete | `TicketsOverviewCard.tsx` | |
| supabase | Canonical tickets + ticket_comments schema with RLS | complete | migration 202512290001:157-219,520-545 | Org-scoped, role-gated, internal-note flag. |
| apps/crm | Staff ticket queue / board | broken | `TicketsBoardShell.tsx:114`; no render site | Fully built but ORPHANED; sidebar "Tickets" → `/crm`. |
| apps/crm | Saved views for tickets board | partial | `tickets/actions.ts:44-197` | Real but only consumed by orphaned board. |
| apps/crm | Staff create-ticket dialog | broken | `create-ticket-dialog.tsx:33,91-92` | Orphaned AND would fail (renamed column + invalid priority). |
| apps/crm | Staff add-comment form | broken | `add-comment-form.tsx:15` | Orphaned; no detail page to host. |
| apps/crm | Ticket detail page | missing | only `tickets/page.tsx` (redirect) | Dead links to `/tickets/[id]`. |
| apps/crm / legacy | Ticket assignment / routing | missing | legacy `EnhancedTicketsList.tsx:142-143` (assignee_id) | No working assignment in Next apps. |
| apps/crm / supabase | Escalation / auto-routing rules | missing | `sla/page.tsx:152-157` | Config captured, never executed. |
| apps/crm | SLA policy config UI | partial | `sla/page.tsx:70-456` | Real CRUD but config inert; nothing enforces it. |
| supabase/functions | SLA daemon (breach detection) | broken | `sla-daemon/index.ts:59-163` | Targets legacy schema (sla_timers/ticket_events); not scheduled. |
| supabase/functions | Outbound ticket email | partial | `send-ticket-email/index.ts:140-217` | Well-built but only called by legacy SPA; table has no migration. |
| legacy Vite SPA | Ticket conversation / messaging thread | deprecated | `src/components/tickets/TicketConversation.tsx` | Legacy-only. |
| legacy Vite SPA | Watchers, tags, time-tracking, attachments | deprecated | `src/components/tickets/*` | Live tables, no CREATE TABLE migration. |
| legacy Vite SPA | Advisor/concierge ticket submission | deprecated | `src/App.tsx:92-93` | Legacy-only. |
| apps/crm | Vendor support portal / vendor ticketing | missing | `vendors/page.tsx:140-389` | "Vendors" = data integration, not ticketing. |
| apps/crm / packages/lib | Ticket activity logging | complete | `create-ticket-dialog.tsx:104`; `activity-table.tsx:139` | Wired but callers orphaned. |

### 3.8 Workflow Automation & Background Jobs (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| lib/automation | Trigger engine on record lifecycle | complete | `record-create-service.ts:122`; `record-patch-service.ts:289`; `engine.ts:377` | Fire-and-forget `.catch()` (not awaited). |
| lib/automation/engine | Workflow execution engine | complete | `engine.ts:179,123,317`; `automation/run/route.ts` | Idempotency, run log, maxActions=50, dry-run. |
| lib/automation/actions | 14 workflow action types | partial | `actions.ts:1166-1258` | 13 real; `delay_wait` is a NO-OP. |
| crm/settings/automations | Automation settings UI | complete | `workflows/builder/page.tsx`; `{assignment,scoring,...}/page.tsx` | Full surface. |
| lib/automation/cadence | Cadence engine | broken | `cadence.ts`; `automation/cron/route.ts:55` | Only driver `/api/automation/cron` unscheduled. |
| lib/automation/scheduler | Scheduler (delayed/scheduled/SLA jobs) | broken | `scheduler.ts:78,228`; `cron/route.ts:65` | Both driver endpoints unscheduled. |
| lib/automation/scoring | Lead scoring on events | complete | `record-create-service.ts:134`; `scoring.ts` | |
| lib/automation/assignment | Assignment rules | complete | `assignment.ts:1`; `types.ts:380` | round_robin/territory/least_loaded/fixed. |
| lib/automation/macros | Macros | complete | `macros.ts`; `macros/[id]/run/route.ts:45` | |
| lib/approvals | Approvals workflow | complete | `approvals/engine.ts`; `approvals/page.tsx:100` | Multi-step, notifications. |
| workqueue | Workqueue (unified actionable items) | complete | `workqueue/route.ts:119`; `act/route.ts:75` | Org-scoped. |
| playbooks | Playbooks (guided selling) | complete | `api/playbooks/route.ts`; `playbooks/page.tsx:49` | |
| operations | Operations Center dashboard | broken | `operations/page.tsx:56-128,339` | 100% mock data + fake loading timer. |
| lib/sequences | Email sequences engine + per-min cron | complete | `enrollment-service.ts:15`; `vercel.json:23` | Separate from crm_cadences. |
| email/process-queue | Email queue worker | complete | `process-queue/route.ts:62,70,177`; `vercel.json:15` | claim_pending_emails, retries, stuck-recovery. |
| comms/cron | Comms message queue worker | complete | `comms/cron/route.ts:33`; `vercel.json:19` | |
| send-scheduled-emails | Scheduled-email send edge fn | complete | `send-scheduled-emails/index.ts:61`; `apps/admin/vercel.json:9` | |
| process-billing | Billing automation | complete | `process-billing/index.ts`; `cron/process-billing/route.ts:55` | Per-org loop, audit. |
| billing-retry | Billing retry | complete | `billing-retry/index.ts`; `cron/billing-retry/route.ts:48` | |
| process-commissions | Commission processing + crons | complete | `process-commissions/index.ts:12`; `cron/process-commissions/route.ts` | Idempotency key, audit. |
| payouts-process | Payout dispatch edge fn | complete | `payouts-process/index.ts:48,157` | Advisory lock; manual-triggered. |
| cron/activate-pending-members | Auto-activate cron + outbox | complete | `activate-pending-members/route.ts`; migration 202606010005; `vercel.json:39` | Best-in-class. |
| cron/age-65-cancellations | Age-65 cron (Vercel + pg_cron) | complete | `age-65-cancellations/route.ts`; `vercel.json:31`; migration 202605060009:187 | Dual-scheduled; relies on idempotency. |
| cron/follow-up-reminders | Follow-up reminders cron | complete | `follow-up-reminders/route.ts:22,47,88`; `vercel.json:35` | |
| cron/idempotency-gc | Idempotency-key GC cron | complete | `idempotency-gc/route.ts`; `vercel.json:27` | |
| crm/webhooks/inbound | Inbound webhook trigger | complete | `webhooks/inbound/route.ts:63,102,262` | Constant-time secret auth. |
| public/webforms | Webform-triggered workflows | complete | `webforms/[orgSlug]/[formSlug]/route.ts:251` | |
| crm/stage-change | Stage-change / blueprint triggers | complete | `stage-change/route.ts:156`; `blueprint-transition/route.ts:145,212` | |
| api/webhooks | Provider inbound/status webhooks | complete | `email/sendgrid`, `email/resend`, `twilio/*`, `[provider]` | |
| crm/developer/webhooks | Developer outbound webhooks | partial | `developer/webhooks/route.ts` | Config+log CRUD but no delivery worker. |
| automation/rules | automation_rules CRUD | broken | `automation/rules/route.ts:21,66` | Dead system; no engine reads it. |
| supabase/functions | flow-runner/workflow-processor/sla-daemon | deprecated | `flow-runner/index.ts`; `workflow-processor/index.ts` | Orphaned; workflow-processor has NO auth. |
| automation/runs | Runs viewer + retry + stats | complete | `runs/route.ts`; `runs/[id]/retry/route.ts:34` | |

### 3.9 AI Capabilities (maturity 42)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/crm record detail v2 | AI inline field suggestions (OpenAI gpt-4o-mini) | complete | `field-suggest/route.ts:20,103`; `AiSuggestChip.tsx:59`; `ai-context.ts:34` | Org-scoped, RBAC, Zod, 503 fallback. |
| apps/crm Insights panel | AI follow-up email drafting (OpenAI JSON mode) | complete | `email-draft/route.ts:17,88`; `AiFollowUpEmailButton.tsx:45` | Same context loader + RBAC + fallback. |
| apps/crm lib/crm | Shared AI record-context loader | complete | `ai-context.ts:34,101` | Org-scoped, token-budgeted, PHI-trimmed. |
| packages/lib + portal | Gemini Rx pricing estimates | complete | `geminiClient.ts:61`; `rxPricing.ts:81`; `SelfServePlanSelectionStep.tsx:77` | Deterministic mock fallback; has tests. |
| apps/crm integrations | OpenAI/Anthropic provider registry entries | partial | `oauth/providers.ts:397,401` | Static stubs; Anthropic drives no calls. |
| apps/crm settings/automations/scoring | Lead scoring (AI-based) | missing | `scoring/page.tsx:203` | Rule-based only; not AI. |
| apps/crm voice | Call/voice transcription | missing | `voice-provider.tsx:19` | Browser Web Speech API only; no Whisper. |
| apps/crm deals war-room | Next Best Action (AI) | missing | `war-room/page.tsx:458` | Manual list. |
| — | Sentiment analysis | missing | (grep: placeholder strings only) | None. |
| — | Churn prediction (AI/ML) | missing | `settings/experience/page.tsx:581` | Placeholder string; churn elsewhere is descriptive. |
| apps/crm + supabase/functions | AI summarization / classification / task gen | missing | `email-intake/index.ts` (regex only) | No LLM calls in edge functions. |
| legacy Vite SPA | Gemini summarize/recommend/draftReply/suggestKB | deprecated | `src/lib/ai/gemini.ts:62,82,138,171` | Migration debt; uses client-exposed VITE_GEMINI_API_KEY. |
| legacy Vite SPA | OpenAI embeddings KB vector search | deprecated | `src/lib/kb/vectorSearch.ts:13,20,51` | Migration debt + secret risk (VITE_OPENAI_API_KEY bundled client-side). |

### 3.10 Settings, Admin, RBAC & Configurability (maturity 47)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/crm settings | Settings hub with adminOnly gating | complete | `settings/page.tsx:39-194,208-209` | UI-only gating; per-page server gates enforce. |
| RBAC core | Primary RBAC: profiles.crm_role enum | complete | `types.ts:1246`; `middleware.ts:243`; migration 202601110002 | The real enforced CRM role; hardcoded 4 values. |
| users admin | User role assignment | complete | `users/page.tsx:351,417`; `users/[id]/role/route.ts:14-20` | Validates role, same-org, blocks self-edit. |
| security-control | Custom Roles & Permissions engine | broken | `security-control/page.tsx:142-150`; `security/roles/route.ts` | Orphaned; never read by any authz path. |
| RBAC core | Dual/triple role-system tenancy roles | partial | `tenant.ts:30`; `team/invite/route.ts:38-39`; `commissions/*` | Three overlapping vocabularies, inconsistent. |
| team admin | Team management | partial | `team/page.tsx:158-163`; `team/invite/route.ts:37-59` | UI gate bug (compares crm_role to org-role values). |
| customization | Modules admin | complete | `modules/page.tsx:19`; `modules/[id]/route.ts:17-19` | Per-tenant configurable AND enforced. |
| customization | Custom fields admin | complete | `fields/page.tsx:28`; `modules/[id]/fields/route.ts:12` | Per-tenant, enforced. |
| configuration | System Configuration (crm_system_settings) | broken | `configuration/page.tsx:54-78`; `system-settings/route.ts:25` | Write-only; no feature consumes values. |
| branding | Branding / logo / color config | broken | `tenant.ts:39,141`; `admin/settings/page.tsx:22-26` | Stored per-tenant but NEVER rendered. |
| admin_settings | Notification settings | broken | `admin/settings/page.tsx:36-37,338-360` | Stored; never read by email code. |
| admin_settings | Enrollment/feature flags | broken | `admin/settings/page.tsx:38-42` | Saved but NOT enforced. |
| audit | Audit Logs | complete | `audit-logs/page.tsx:23-25,41-46` | Org-scoped, role-gated. |
| developer | Developer Hub (API keys, webhooks, logs) | complete | `developer/page.tsx`; `api-keys/route.ts:38-39` | Org-scoped, admin-gated CRUD. |
| security-control | Trusted Domains / SSO / Login History | partial | `sso-config/route.ts:53,81`; `login-history/route.ts:15` | SSO stored but never enforced. |
| admin app | Multi-tenant admin app + org switching | complete | `admin/middleware.ts:16,103`; `OrganizationSwitcher.tsx` | Strongest tenancy implementation. |
| admin app | Admin Security page | partial | `admin/settings/security/page.tsx:42-60` | Same orphaned crm_roles issue. |
| process | Pipeline settings | deprecated | `settings/pipelines/page.tsx:1-16` | Redirect stub; not tenant-configurable. |
| user prefs | Per-user email settings + signatures | complete | `settings/email/page.tsx:58-60`; `signatures/page.tsx` | |
| channels | Comms settings (providers + templates) | complete | `settings/comms/page.tsx:45-73` | Per-org provider config. |
| experience | Experience/Marketplace/Customization pages | partial | `settings/experience/page.tsx`; `marketplace/page.tsx` | Depth not fully traced. |

### 3.11 Database & Schema Reality (maturity 72)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| init | Initial CRM schema | complete | migration 202512290001:79-109 | members natively use organization_id. |
| crm_records | Zoho-style flexible core | complete | migration 202601110001:123-125 | org_id is the (legacy) tenant key. |
| tenant-key | org_id → organization_id strangler | partial | migrations 202605300001-011 | Exemplary additive/reversible; NOT finished. |
| rls | Cross-tenant isolation remediation | complete | migration 202605300012:19-66; `cross-tenant.db.spec.ts:82-89` | Verified by authenticated test. |
| rls | RLS helpers resolve from profiles (not JWT) | complete | migration 202601310003:219-234; 202601260001:22-26 | Fail-closed; search_path pinned. |
| enrollment | Enrollment idempotency RPC | complete | migration 202605300013:12-103; tests | Fully wired + test-covered. |
| members | Member dedup merge + active-uniqueness index | complete | migration 202605300014:12-95; `memberDedup.ts:26-40` | Family-email-aware (email+name). |
| sync | member→crm_records trigger repair | complete | migration 202605300015:10-324 | Non-fatal degrade; introduced bug B1. |
| sync | Family-shared-email crm_records fix (B1/B2) | partial | `supabase/drafts/202605300016` (ROLLBACK) | STILL A DRAFT; B1 live in prod. |
| activation | Auto-activate + activation outbox | complete | migration 202606010005:13-58 | NEW table uses org_id (tenant-key regression). |
| perf | Indexing strategy on hot tables | complete | migration 202605220004:48-75 | ~1,582 indexes; CONCURRENTLY. |
| reporting | Materialized views + pg_cron refresh | complete | migration 202603100004 | 5 MVs. |
| pricing | Pricing/rating reference tables | complete | migrations 202603110001:35, 202603110002:9-110 | Global non-tenant; RLS added later. |
| audit | Partitioned activity_log | partial | migration 202602150001:15-98 | Static partitions through 2026m07 only. |
| hygiene | drafts/ and migrations_temp/ excluded from CLI | complete | `drafts/202605300016:1-7`; `migrations_temp/README.md` | Disciplined separation. |
| testing | DB-level (Layer 2/3) test suite | complete | `__tests__/db/*.db.spec.ts` | Cross-tenant, idempotency, triggers, dedup. |
| hygiene | Down/rollback migrations | missing | (none found) | Forward-only; reversibility via additive design. |

### 3.12 External Integrations (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/crm integrations | Generic OAuth framework (PKCE, encrypted tokens) | complete | `oauth/[provider]/route.ts:59,73-117`; migration 202601170010 | AES-256-GCM via credentials.ts. |
| apps/crm integrations | Connection manager (CRUD/test/health) | complete | `connection-manager.ts:87-131,460-541` | Org-scoped, decrypt-on-use. |
| apps/crm integrations UI | Integration management UI | complete | `IntegrationCategoryPage.tsx:88-263` | OAuth + API-key flows. |
| adapters/payments | Stripe payment adapter | complete | `stripe.ts:104-346,366` | Real SDK; signature verify. `sk_placeholder` fallback risk. |
| adapters/calendar | Google Calendar adapter | complete | `google-calendar.ts:187-471` | Full CRUD + sync. |
| adapters/calendar | Microsoft Outlook adapter | complete | `microsoft-outlook.ts` (639 LOC) | Graph API. |
| apps/crm api/calendar | Calendar OAuth routes | complete | `calendar/connect/route.ts:40-49` | |
| process-payment | Authorize.Net payment processing | complete | `process-payment/index.ts:162-623`; `enrollment/actions.ts:694-720` | Reads platform env (not per-tenant). |
| authnet-webhook | Authorize.Net webhook handler | complete | `authnet-webhook/index.ts:59-114,75-98` | HMAC-512, dedup. |
| apps/admin billing | Per-tenant payment processor config UI | partial | `billing/payment-processors/page.tsx:99-298` | UI stores rows but edge fn ignores them. |
| telehealth-sso | Telehealth SSO dispatcher | complete | `telehealth-sso/index.ts:136-240`; `services/[id]/sso/route.ts:37-61` | Org-scoped, membership-gated. |
| doc-* | Document management edge functions | complete | `doc-upload/index.ts:99-192`; `doc-bulk/index.ts:86-262` | Org-scoped Supabase Storage. |
| send-email + lib | Resend email | complete | `send-email/index.ts:48-232`; `webhooks/email/resend/route.ts:3` | |
| adapters/email + lib | SendGrid email | complete | `sendgrid.ts:95-246`; `webhooks/sendgrid/route.ts` | |
| lib/comms + twilio | Twilio SMS | complete | `twilio.ts:34-80`; `dispatcher.ts:146-165` | |
| lib/comms | Comms dispatcher | complete | `dispatcher.ts:76-101,289-600` | Opt-out enforcement, retries. |
| webhooks router | Unified per-provider webhook router | partial | `webhooks/[provider]/route.ts:36-152` | Only Stripe handlers implemented. |
| goto-webhook-processor | GoTo Connect telephony webhook | broken | `goto-webhook-processor/index.ts:94-367` | No table migration, no org_id, no consumer; signature not verified. |
| onedrive-* | OneDrive OAuth + sync | broken | `onedrive-oauth/index.ts:46-237`; `onedrive-sync/index.ts:93-312` | No table migration, zero consumers; XOR token storage. |
| email-intake | Email intake (inbound → CRM) | partial | `email-intake/index.ts:23-30` | Not fully traced. |
| oauth + adapters/esign | DocuSign / PandaDoc e-signature | missing | `providers.ts:168-199`; `registry.ts:175-181` | Interface + config only. |
| oauth | QuickBooks / Xero accounting | planned | `providers.ts:324-364` | Config-only. |
| oauth + crm_sync | Salesforce / HubSpot / Zoho CRM sync | planned | `providers.ts:201-261` | Config-only. |
| oauth | Slack/Zoom/Teams/Meet/Drive/Dropbox | planned | `providers.ts:85-165,263-321` | Config/type-only. |
| lib/payouts | Stripe Connect / ACH / Manual payout rails | complete | `payouts/providers/*`; `payouts-process/index.ts` | Outbound payouts. |
| supabase/migrations | Disabled integration command center | deprecated | migration 202601280001:1-8 | No-op. |

### 3.13 Member Portal & Advisor/Agent Experience (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| portal/member-auth | Member auth gate + context resolution | complete | `require-active-membership.ts:23`; `(member)/layout.tsx:15` | Only `/plan` + `/api/member/*` use it. |
| portal/dashboard | Member dashboard | complete | `page.tsx:57`; `MemberDashboardShell.tsx` | Server-rendered, org-scoped. |
| portal/plan | My Plan page | complete | `plan/page.tsx:11`; `data/member.ts:34` | New data layer. |
| portal/coverage | My Coverage page | partial | `coverage/page.tsx:60,144` | Benefits + IUA hardcoded sample data. |
| portal/billing | Billing & Payments page | partial | `billing/page.tsx:75,337,396` | Client-side; non-functional buttons; hardcoded auto-pay. |
| portal/billing-api | Server billing data layer + APIs | complete | `data/billing.ts:13`; `api/member/transactions/route.ts` | Underused by UI. |
| portal/documents | Documents page + ID card | partial | `documents/page.tsx:121,93,172` | Fabricated docs; hardcoded group number; no PDF. |
| portal/needs | Needs & Sharing | complete | `needs/page.tsx:98`; `api/member/needs/route.ts:33` | Submit + audit + comments + attachments. |
| portal/support | Support center | complete | `support/page.tsx:32`; `support/actions.ts` | Server-rendered. |
| portal/services | Services directory + SSO launch | complete | `services/page.tsx:6`; `services/[id]/sso/route.ts:37` | Bug: reads member.zip (col is postal_code). |
| portal/change-requests | Self-service change requests | complete | `change-requests/route.ts:25`; `plan/change/page.tsx:33` | Request-only; admin actions. |
| portal/profile | Member profile self-edit | partial | `profile/page.tsx:99`; `api/member/profile/route.ts:6` | Client-side write; API GET-only. |
| portal/settings | Member settings | partial | `settings/page.tsx:46,67` | Notification prefs FAKE (setTimeout+toast). |
| portal/notifications | Member notifications | complete | `api/member/notifications/route.ts:17` | List + mark-read. |
| portal/dependents | Dependents management | partial | `dependents/page.tsx:1`; `data/member.ts:52` | Add/remove via change-requests. |
| portal/enroll-public | Public single-step lead capture | complete | `enroll/[slug]/page.tsx:60`; `api/enroll/public/route.ts:33` | Live primary flow; lead-gen, household deps NOT persisted. |
| portal/enroll-wizard-cookie | Multi-step wizard (draft cookie) | broken | `enroll/[slug]/start/page.tsx:44`; `api/enroll/submit/route.ts:42` | `/intake` + `/payment` routes don't exist (404); submit endpoint orphaned. |
| portal/enroll-wizard-actions | Self-serve wizard (@crm-eco/enrollment) | partial | `enroll/page.tsx:100`; `enroll/actions.ts:100` | Real but duplicate local steps; still admin review. |
| portal/enroll-agreement | Agreement e-signature | partial | `enroll/[slug]/agreement/page.tsx:50` | Real but routes to non-existent `/payment` (404). |
| portal/enroll-done | Confirmation page | complete | `enroll/[slug]/done/page.tsx:9` | |
| agent/dashboard | Agent dashboard | complete | `agent/page.tsx:18,120` | Advisor+org-scoped. |
| agent/auth | Agent middleware + layout gating | partial | `middleware.ts:78`; `agent/layout.tsx:13` | Inconsistent (owner passes middleware, blocked by layout). |
| agent/downline | Agent downline | partial | `agent/downline/page.tsx:60,221` | Single-level only; `/agent/downline/[id]` 404; N+1 counts. |
| agent/commissions | Agent commissions | partial | `agent/commissions/page.tsx:83,179,256` | Real query; Export non-functional; hardcoded payout date. |
| agent/links | Enrollment links + QR | partial | `agent/links/page.tsx:62,78,103` | Conversion stat always 0 (event_type mismatch). |
| agent/members | Members list + detail | partial | `agent/members/page.tsx:75` | Only directly-assigned; downline not surfaced. |
| agent/reports | Agent reports | partial | `agent/reports/page.tsx:1,29` | Client-side aggregation. |
| agent/profile-settings | Agent profile + settings (2FA) | complete | `agent/profile/page.tsx:90`; `agent/settings/page.tsx:135` | |
| advisor-portal | Second advisor app | partial | `advisor-portal/(portal)/dashboard/page.tsx:79` | Real queries but hardcoded KPI deltas; duplicates /agent. |
| advisor-portal/auth | advisor-portal middleware gating | complete | `advisor-portal/middleware.ts:54,78` | Validates getUser, is_active, owner bypass. |
| portal/pwa | PWA (service worker, install, update) | complete | `ServiceWorkerRegistration.tsx`; `InstallPrompt.tsx` | Installable. |

### 3.14 Enrollment & Commissions (maturity 52)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| apps/portal enroll | Public wizard submit flow | complete | `api/enroll/submit/route.ts:42-241`; `api/enroll/draft/route.ts:33-65` | Signed cookie + reCAPTCHA + idempotent. |
| apps/portal api/enroll/public | Public landing-page enrollment API | complete | `api/enroll/public/route.ts:33-302`; `memberDedup.ts:21-41` | Rate-limited, dedup, idempotent. |
| supabase/migrations | Atomic idempotent create RPC | complete | migration 202605300013:23-103; `idempotency.db.spec.ts:44-69` | Race handler; staging-gated test. |
| apps/crm enrollment | Advisor-assisted wizard (6-step) | complete | `crm/enrollment/actions.ts:157-962` | Raw insert (NOT idempotent on this path). |
| apps/portal enroll | Member self-serve wizard | partial | `enroll/actions.ts:100-699` | Raw insert; falls back to organizations.limit(1) (tenant hazard). |
| packages/lib/enrollment | EnrollmentService domain layer | partial | `enrollment-service.ts:57-250` | Typo'd field `baseMonthlyCoat`; not referenced by live paths. |
| generate-enrollment-contract | Enrollment contract PDF generation | complete | `generate-enrollment-contract/index.ts:270-854` | Versioning race-prone; PDFs PUBLIC-URL'd (privacy concern). |
| apps/portal enroll agreement | Agreement signature capture | broken | `enroll/[slug]/agreement/page.tsx:46-85` | Routes to non-existent `/payment` (404). |
| process-commissions | Commission calculation edge fn | partial | `process-commissions/index.ts:187-529` | Reads non-existent `enrollments.member_id`; filters status 'active' not in CHECK. |
| supabase/migrations | Trigger-based signup commission | partial | migration 202605210005:142-201 | Parallel system; writes `commissions` (double-count risk). |
| packages/lib/commissions | CommissionService | partial | `commission-service.ts:111-567` | Third path; no idempotency_key; unbounded upline loop. |
| payouts-process | Payout dispatch | partial | `payouts-process/index.ts:32-194` | payment_method enum mismatch; ACH path is a stub. |
| apps/admin commissions | Payout generation & approval workflow | broken | `commissions/payouts/page.tsx:135-272`; migration 202601150001:466,483 | RLS SELECT-only → UI writes blocked at runtime. |
| process-billing | Recurring billing engine | complete | `process-billing/index.ts:130-665` | Circuit breaker, rate limiter, idempotency, retries. |
| supabase/migrations | Billing schedule auto-gen + cancellation cascade | complete | migration 202605210005:14-137 | Idempotent; ON CONFLICT DO NOTHING. |
| apply-price-change | Scheduled price changes | complete | `apply-price-change/index.ts:25-134` | Immutable audit; cron 10:00 UTC. |
| apps/admin cron | Commission/billing crons | complete | `apps/admin/vercel.json`; `cron/process-commissions/route.ts:13-19` | CRON_SECRET gated. |
| packages/lib/enrollment/__tests__ | Idempotency/cross-tenant/dedup test suite | complete | `idempotency.db.spec.ts`; `cross-tenant.db.spec.ts:80-88` | Unit 10/10; DB specs staging-gated. |
| supabase/migrations | Compliance hardening (dual-approval) | partial | migration 202603100014:440-557 | Covers commissions→ledger path only, NOT commission_transactions→payouts. |

### 3.15 Frontend Architecture & Build/Migration Debt (maturity 58)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| build-tooling | Turborepo monorepo | complete | `package.json:3-7`; `turbo.json:1-16` | dist/** AND .next/** outputs (dual-tooling). |
| apps | Six Next.js 16.1.6 apps | complete | `apps/*/package.json` (all next 16.1.6) | advisor-portal + doublehelixhub both claim port 3003. |
| packages/ui | Shared UI package | complete | `packages/ui/package.json`; 715 import sites across 6 apps | Genuinely shared shadcn-style lib. |
| packages/lib | Shared logic package | complete | `packages/lib/package.json`; 292 sites across 5 apps | Source-direct. |
| packages | enrollment + rates workspaces | complete | `packages/enrollment`; `packages/rates` | Cleanly scoped. |
| shared | Top-level shared/ workspace (pre-built dist) | partial | `shared/package.json` (main ./dist/index.js) | PARALLEL shared-code system; different build model. |
| deploy | Per-app Vercel configs | partial | `apps/crm/vercel.json`; doublehelixhub has none | 5 of 6 apps. |
| ci | GitHub Actions CI (data-safety gates) | partial | `pifh-deploy-gate.yml`; `crm-health.yml`; `hawkeye-audit.yml` | Guards DB; does NOT build/typecheck/test any app. |
| ci | Husky hooks | partial | `.husky/pre-commit`; `.husky/pre-push` | pre-push typechecks ONLY crm. |
| migration-debt | Legacy root Vite SPA | deprecated | `src/App.tsx:1-40`; 149 files / ~34,693 LOC | Still target of root `npm run build` + netlify.toml. |
| build-tooling | Root build points at Vite SPA | broken | `package.json:11`; `netlify.toml:2-3` | Builds dead SPA, not the product. |
| docs-debt | Root *_COMPLETE.md / doc sprawl | partial | 35 root .md incl. 10 *_COMPLETE.md; `README.md:3` ("Next.js 14") | Stale/misleading. |
| migration-debt | Orphaned root build artifacts | deprecated | root `.next/`, `dist/`, `.bolt`, `.backups` | Incomplete cleanup. |
| build-tooling | transpilePackages wiring | partial | `apps/admin/next.config.mjs:3` (omits @crm-eco/shared) | Works only because shared ships dist. |
| ci | Workspace-hygiene nested-repo guard | complete | `scripts/workspace-hygiene.sh` | Sensible guard. |

### 3.16 Production Readiness (maturity 46)

| Module | Feature | Status | Evidence | Notes |
|--------|---------|--------|----------|-------|
| .github | PIFH deploy gate (data-loss invariants) | complete | `pifh-deploy-gate.yml:19-55`; `scripts/pifh-deploy-gate.mjs:97-286` | Live invariant probes; hardcoded to PIFH. |
| .github | CRM health (hygiene + strict DB audit) | complete | `crm-health.yml:22-60`; `db-audit-crm-integrity-strict.sql` | |
| .github / .audit | Hawkeye schema↔code cross-reference | complete | `hawkeye-audit.yml:48-112`; `check-baseline.mjs:1-135` | Baseline diffing. |
| scripts | Deploy gate in Vercel Ignored Build Step | partial | `vercel-ignore-pifh-gate.sh:20-41` | Fails OPEN when DB URL unset; enforcement unverified. |
| .husky | pre-commit hook (lint-staged) | complete | `.husky/pre-commit:32` | No tests/typecheck on commit. |
| .husky | pre-push hook (hygiene + typecheck) | partial | `.husky/pre-push:26-31` | crm typecheck only. |
| apps/*/vercel.json | Per-app build config | complete | `apps/crm/vercel.json:1-43` | Monorepo-aware. |
| vercel.json | Vercel cron jobs | complete | `apps/crm/vercel.json:13-42` | 7 crm + 6 admin; CRON_SECRET fail-closed. |
| root | Root vercel.json + netlify.toml | broken | `vercel.json:1-7`; `netlify.toml:1-13` | Conflicting targets (admin vs legacy Vite). |
| apps/crm, packages | Unit/integration test suite (vitest) | partial | `vitest.config.ts`; ~29 spec files | NOT run by any CI workflow. |
| packages/lib | DB-integration / RLS / cross-tenant tests | partial | `vitest.db.config.ts`; `cross-tenant.db.spec.ts` | Staging-gated; not in CI. |
| root | Playwright E2E | broken | `playwright.config.ts:1-27`; `tickets.spec.ts` | Targets legacy Vite SPA (port 5173). |
| scripts | Smoke tests | complete | `smoke-test.mjs:1-209` | Isolated to smoke org. |
| scripts | DB health & integrity audit scripts | complete | `run-db-health.mjs:1-68`; `db-audit-crm-record-integrity.sql` | |
| docs | Operations runbook + rollback playbook | complete | `RUNBOOK.md:1-281`; `PIFH_DEPLOY_SAFETY.md:1-308` | Rollback is manual/doc-only. |
| root + apps | Environment variable handling | partial | `.env.example:1-53`; `.env.vercel` (TRACKED) | Root .env.example uses legacy VITE_ vars. |
| apps/* | Error boundaries | partial | `apps/crm/src/app/global-error.tsx:1-47` | console.error only; no remote capture. |
| apps/crm | Monitoring / error-tracking sink | missing | `offline/instrumentation.ts:6-8,84` | No Sentry/Datadog/OTel; "starts silent" in prod. |
| root | Automated database backups | missing | `backups/pre-upgrade-2026-05-21.sql` (0 bytes) | Manual-only runbook step. |
| supabase | Stray future-dated migrations | deprecated | `migrations_temp/202699999*.sql` | 10 speculative drafts tracked in git. |

---

## 4. Gap Analysis

Grouped by priority. Each item is a thing that is partial, broken, or missing.

### P0 — Critical (data loss, money, security, silent prod failures)

1. **Committed live production service-role key** in tracked `.env.vercel` (project `sffisarikcreyyjzdjvb`) — full RLS-bypassing prod DB access for anyone with repo access. (`git ls-files --error-unmatch .env.vercel` succeeds; committed in `0eb95177`.)
2. **`/api/automation/cron` unscheduled** — the sole driver of cadence advancement, delayed workflow steps, scheduled workflows, and SLA escalation. Records enroll and stall at step 0; the UI shows success. (`vercel.json` has no entry; `automation/cron/route.ts:55,65`.)
3. **Family-shared-email data loss (B1)** — the 2nd family member on a shared email is permanently invisible in the members CRM module; fix is an unapplied draft ending in `ROLLBACK`. (`202605300015:269,314`; `drafts/202605300016`.)
4. **Sequence emails never sent** — `executeEmailStep` writes `sent_emails(status='queued')` but `claim_pending_emails` only reads `notification_queue`. (`enrollment-service.ts:197-215`; migration `202603050002`.)
5. **Manual payout/commission approval blocked** — `commission_transactions`/`commission_payouts` have RLS with SELECT-only policies; user-authed UI writes fail at runtime. (`202601150001:464-498`.)
6. **`process-commissions` reads non-existent `enrollments.member_id`** (column is `primary_member_id`) — corrupts member-level commission attribution. (`process-commissions/index.ts:292,298,319`.)
7. **Double-commission risk** — trigger (`commissions`) AND billing-driven edge fn (`commission_transactions`) can both pay one enrollment with no cross-check.
8. **Public enrollment 404 dead-ends** — agreement page → `/payment`, wizard `/start` → `/intake`, neither route exists. Member hits 404 after signing.
9. **GoTo webhook auth bypass** — `verifyAuth` authorizes any request merely carrying an `x-goto-signature` header (no verification); writes to non-org-scoped tables. (`goto-webhook-processor/index.ts:52-54`.)
10. **`/api/comms/templates?category=` 500** — queries a column that was renamed to `template_type`. (`comms/templates/route.ts:28-30`.)

### P1 — High (broken headline features / missing core surfaces)

- **No staff ticket UI in the live Next.js CRM** — members file into a write-only black hole; orphaned components; dead `/tickets/[id]` links; sidebar → `/crm`. SLA is config-only (no enforcement).
- **Forecasting fabricates data** — fake fallback bars, hardcoded $100k target + probabilities, unbounded client read, wrong date field.
- **Scheduled reports never deliver** — UI shell with no executor (no edge fn / cron references `crm_scheduled_reports`).
- **Charts never rendered** — builder collects `chart_config`; no chart library draws results.
- **XLSX/PDF export throws** at runtime; Excel button maps to the throwing path.
- **Custom Dashboards `/new` 404**; calendar disconnect 404; agent downline `/[id]` 404; `/crm/meetings` empty 404 dir.
- **Campaign open/click tracking dead** — pixel/links never injected; no `sent_emails` log; no suppression check (CAN-SPAM); no SMS STOP (TCPA).
- **VoIP entirely absent/broken** — no dialer, orphaned non-org-scoped webhook with no consumer; OneDrive equally orphaned.
- **Inbound SMS bypasses the "unified" inbox** (writes `crm_messages`); inbox advertises sms/whatsapp/phone/chat channels with no data source.
- **Per-tenant productization unrealized** — branding/colors/logos stored but never rendered; feature flags + system-settings + SSO enforcement inert; pipelines/stages deferred; report templates/widgets hardcoded.
- **Tenant-key migration unfinished** — `org_id` still canonical on `crm_records`; new tables (`crm_activation_outbox`) still ship on `org_id`.
- **Tests not gated in CI**; no automated DB backups; no error/observability sink.

### P2 — Medium (degraded, fabricated, or scale-limited)

- Members list capped at 200 rows + client-side search; Revenue page + reports load all rows client-side; analytics `.limit(10000)`; agent downline N+1.
- Two stage-history tables split write/read → automated status changes missing from the timeline/audit.
- Member portal fabricated data (coverage benefits/IUA, documents list, group number, fake notification save) + non-functional buttons.
- Owner-less calendar/booking writes; duplicate task APIs; dead `scheduled_appointments` table with open anon-insert RLS; unpersisted OAuth refresh tokens.
- One-way-only member↔crm sync; silent `WHEN OTHERS → WARNING` error-swallowing; no reverse sync to portal source of truth.
- Per-tenant payment/telephony/AI credentials are global (one merchant account, one MS app, one OpenAI/Gemini key).
- Renewal/anniversary lifecycle automation absent; no general recurring tasks (RRULE); no assignee picker; no dedicated meeting entity.

### P3 — Lower (cleanup / debt)

- Legacy Vite SPA (~34.7k LOC) still tracked + built; conflicting root deploy configs; stale README ("Next.js 14"); doc sprawl (35 .md).
- Two shared-code mechanisms (`packages/lib` source-direct vs `shared/` dist); admin omits `@crm-eco/shared` from transpilePackages; port collision 3003.
- Dead code retained on disk (PipelineSettingsClient, ActivityCalendar, EnrollmentService typo, dead `enrollRecord`).
- `migrations_temp/` future-dated speculative migrations tracked in git.

---

## 5. Technical Debt Report

10 high, 11 medium, 2 low — merged across all areas and sorted by severity. Themes: duplicate systems, an intact legacy SPA, an unfinished tenant-key migration, migration-hygiene gaps (live-only tables), config-only/fabricated features, and production-readiness gaps.

| Severity | Item | Area | Evidence | Remediation |
|----------|------|------|----------|-------------|
| **High** | Committed LIVE prod service-role key in tracked `.env.vercel` | Production Readiness / Secrets | `.env.vercel` git-tracked; service_role JWT for `sffisarikcreyyjzdjvb`; committed `0eb95177` | Rotate key + anon key; `git rm --cached`; add to `.gitignore`; purge history (filter-repo/BFG); audit access logs |
| **High** | Intact legacy Vite SPA (~34.7k LOC) still tracked + target of root build/netlify; holds the only full ticketing/SLA/AI/KB UIs (pre-RLS-remediation Supabase client) | Frontend / Strangler | `src/App.tsx`; `src/lib/supabase.ts`; `package.json:11`; `netlify.toml`; last `src/` commit 2026-04-08 | Migrate still-needed surfaces (staff ticket queue) into apps/crm; then `git rm src/`, `vite.config.ts`, `netlify.toml`, `.bolt`; remove `vite build` from root; repoint/delete Playwright |
| **High** | Tenant-key strangler unfinished: `crm_records` dual-keyed with `org_id` canonical; new tables keep shipping on `org_id` | Database / Tenancy | ON CONFLICT `(org_id,...)` (`202605300015:269,314`); indexes on `org_id` (`202605220004:48-60`); `crm_activation_outbox` (`202606010005:15`) | CI lint blocking new `org_id` tables; add `organization_id`+sync to outbox; plan + rehearse destructive `org_id`-drop cutover; document `org_id` as canonical meanwhile |
| **High** | Live B1 data loss: family-shared-email member invisible in CRM; fix stranded as draft | Contacts / Database | `202605300015:269,314`; `drafts/202605300016` (ROLLBACK); RED spec `member-crm-sync.db.spec.ts` | Promote draft 016 (rehearse in rolled-back prod txn + dry-run + backfill); push via CLI; confirm spec green; gate in CI |
| **High** | Three parallel commission ledgers; double-count risk; broken manual-payout path (missing write RLS) | Enrollment & Commissions | `202605210005:142-201` vs `process-commissions:349-368`; `202601150001:464-498` (SELECT-only) | Choose one canonical ledger; route all apps to it; disable redundant creation path; add role-gated write RLS; reconcile divergent rows |
| **High** | `/api/automation/cron` unscheduled → cadences/delayed steps/scheduled workflows/SLA silently never run; `delay_wait` no-op | Workflow / Leads / Tickets | `cadence.ts`; `scheduler.ts:78,228`; `cron/route.ts:55,65`; no vercel.json entry; `actions.ts:839-851,1297` | Schedule the cron (or consolidate onto email_sequences); implement `delay_wait` via scheduler enqueue; wire SLA driver; add cron-missed alerting |
| **High** | Duplicate comms stacks; broken sequence sends; dead campaign tracking; unverified VoIP webhook auth/tenancy | Communications | `send-service.ts` vs `dispatcher.ts`; `enrollment-service.ts:194-215`; `campaigns/[id]/send/route.ts:280-318`; `goto-webhook-processor/index.ts:52-54` | Pick one comms stack; fix sequence sends to enqueue `notification_queue`; inject tracking + log sends + suppression check; add SMS STOP; implement GoTo signature verify + org_id or remove |
| **High** | Fragmented RBAC: three role systems + orphaned never-enforced custom-roles engine | Settings / RBAC | `types.ts:1246` vs `tenant.ts:30` vs commission routes; `security-control/page.tsx:147`; `crm_user_roles` never written | Document one role source-of-truth + feature→role matrix; converge enforcement; either wire crm_roles into authz or remove the engine; fix team-page gate + inbox `crm_user` filter |
| **High** | Stored-but-never-applied configurability: branding, system-settings, feature flags, SSO enforcement | Settings / Member Portal | `tenant.ts:141` (stored, unrendered); `admin/settings/page.tsx:132-142`; `sso-config/route.ts:81` | Wire branding into a theme provider (CSS vars/logo); enforce feature flags in enrollment; enforce `enforce_sso` in auth; consume or remove system-settings |
| **High** | Tests not gated in CI; no automated DB backups; no error/observability sink; dead E2E | Production Readiness | `.github/*` has zero vitest/playwright; `backups/*.sql` 0 bytes; `instrumentation.ts:84` silent; `playwright.config.ts:11` port 5173 | Add CI `turbo test` (incl. staging DB specs) + typecheck/lint/build for all 6 apps; add pre-deploy/scheduled pg_dump; wire error sink; repoint or delete Playwright; make deploy gate fail closed |
| **Medium** | 365-migration hygiene: live-only tables with no CREATE TABLE, no schema dump, dual filename conventions, RLS in later passes, no FORCE RLS | Database / Tickets / Integrations | ticket_watchers/sla_timers/ticket_events, GoTo, OneDrive, scheduled/custom_reports referenced but uncreated; pricing RLS-OFF until `202603110004`; FORCE RLS = 0 | Write CREATE TABLE (with org_id + RLS) for needed tables or drop them; commit periodic schema dump; add RLS at table creation (CI lint); standardize filenames; move migrations_temp out of tracked path |
| **Medium** | Four+ overlapping automation/sequencing systems + orphaned, partly-unauthenticated legacy edge functions | Workflow | `lib/automation/*` vs `lib/sequences/*` vs `automation/rules` vs `flow-runner`/`workflow-processor` (no auth) | Consolidate to crm_workflows + one sequence engine; delete automation_rules CRUD + orphaned edge fns; add auth to workflow-processor or remove; merge the two workflow routes; make all crons fail closed |
| **Medium** | Duplicate template stores + runtime-500 column bug + divergent merge engines + no per-tenant seeding | Template / Communications | `crm_message_templates` vs `email_templates`; `comms/templates/route.ts:28-30` (category col missing); `variables`+`available_variables` | Converge on one store + one merge engine; fix the category→template_type bug; collapse redundant columns; add org-creation seeding hook; add API role gate to settings/templates |
| **Medium** | Reporting: facade scheduled reports, throwing export, unrendered charts, multi-module column/filter no-op, duplicate report system | Reporting | `scheduled/page.tsx:243` (no executor); `reports/index.ts:326` throw; `202603080002:78-86` (p_columns ignored); crm_reports vs custom_reports | Build scheduled-reports executor or remove UI; implement/hide XLSX/PDF + charts; honor p_columns/p_filters + JSONB resolution in aggregation; consolidate report systems; wire stubbed widgets; paginate Revenue |
| **Medium** | Tasks/calendar fragmentation: two task APIs, owner-less client writes, dead booking schema with open anon-insert RLS, missing disconnect route, unpersisted OAuth tokens | Tasks/Calendar | `api/tasks` vs `api/crm/tasks`; `calendar/page.tsx:1215-1228`; `202602080002:126-129` (WITH CHECK TRUE); `google-calendar.ts:525` | Pick one task API; route New Event through API to set ownership; drop `scheduled_appointments` + open policy; implement disconnect; persist refreshed tokens; implement booking confirmation/calendar-task or fix copy |
| **Medium** | Integrations: orphaned OneDrive/GoTo (no migrations/consumers), weak XOR token storage, placeholder Stripe key, per-tenant payment config ignored, PCI plaintext | Integrations | `onedrive-*`/`goto-*` no migrations; `202603070004:45-94` (XOR); `handlers/stripe.ts:17`; `process-payment/index.ts:119-123,498-515` | Remove/complete OneDrive/GoTo; replace XOR with AES-256-GCM; remove `sk_placeholder`; make process-payment read per-org creds; hide config-only providers; move PAN capture to client tokenization; fix create_profile contract |
| **Medium** | Forecasting fabricates data + hardcoded targets/probabilities; stage taxonomy hardcoded inconsistently across three surfaces | Leads & Pipeline | `forecasting/page.tsx:54-61,247,361-369`; `pipeline/page.tsx:162-169`; `reports/pipeline/page.tsx:104` | Drive forecasting off crm_deal_stages + per-tenant target; remove fabricated data; use close_date; aggregate server-side; centralize stage taxonomy by reading crm_deal_stages everywhere |
| **Medium** | Two stage-history tables split write/read → audit/timeline gaps | Contacts & Members | writes `crm_stage_history` (`engine.ts:118`, `activate-pending:218`); reads `crm_deal_stage_history` (`queries.ts:1481,1638`) | Consolidate to one table (or read both); backfill; update writers/readers; add a test asserting auto-activation appears in timeline |
| **Medium** | 3-4 enrollment flows with orphaned backend, 404 dead-ends, non-idempotent raw inserts | Enrollment / Member Portal | `api/enroll/public`, `api/enroll/submit` (orphaned), `enroll/actions.ts:100`; `/intake`+`/payment` 404; raw inserts `actions.ts:251-265,155-159` | Pick one implementation; finish or delete wizard routes; remove duplicate steps; route all creates through create_enrollment_tx; remove organizations.limit(1) fallback |
| **Medium** | Two parallel agent experiences + two-generation member portal mixing data-layer with hardcoded/dead pages | Member Portal | `apps/portal/agent/*` vs `apps/advisor-portal`; `lib/data/*` vs client-side pages; fabricated coverage/docs/settings; `/agent/downline/[id]` 404 | Consolidate to one agent app; migrate pages onto data layer; remove fabricated data + dead buttons; use recursive downline fn + build `/[id]`; fix conversion event_type + member.zip; persist notification prefs |
| **Medium** | No staff ticket UI; member tickets write-only; SLA enforcement illusory | Tickets | orphaned TicketsBoardShell; sidebar→`/crm`; `/tickets/[id]` missing; `create-ticket-dialog.tsx:91-92` schema-incompatible; crm_sla_policies no executor | Build staff queue + detail (repair orphaned components vs canonical schema); fire notification on member ticket create; implement SLA driver or remove misleading UI copy; wire send-ticket-email into Next apps |
| **Low** | Root doc sprawl, stale README, orphaned root artifacts, conflicting deploy configs | Frontend / Docs | 35 root .md incl. 10 *_COMPLETE.md; `README.md:3` ("Next.js 14"); root `.next`/`dist`/`.bolt`; vercel.json vs netlify.toml; port 3003 collision | Rewrite README for 6-app Next 16 monorepo; archive Vite-era docs; remove orphaned artifacts + large data exports; resolve root deploy conflict; fix port collision; add @crm-eco/shared to admin transpile or relocate shared/ |
| **Low** | No live AI tenancy/config or cost controls; single global keys; PHI to LLM without per-tenant kill switch | AI Capabilities | hardcoded `enabled` (`RecordDetailShellV2.tsx:981`); single global OPENAI/GEMINI key; no rate limit/quota/audit | Add per-tenant AI enablement + kill switch; per-org rate limit/quota + usage/cost audit on AI routes; document BAA/DPA posture; tighten PHI exclusion; remove or implement Anthropic |

---

## 6. SaaS Readiness Assessment

**SaaS Readiness Score: 44 / 100** · **Tenant Isolation Score: 68 / 100** · **Productization Score: 38 / 100**

CRM-ECO is a genuinely mature multi-tenant CRM at the **data** layer but only partially productized as a white-label SaaS. Tenant **isolation** (68) is the strongest pillar: RLS on ~354 tables, helpers resolving org/role from `profiles` (not JWT), the cross-tenant leak across 11 PII/PHI tables remediated (`202605300012`) and verified by an authenticated staging spec, and consistent org-derivation from `getAuthProfile().organization_id`. The disciplined `org_id → organization_id` strangler is exemplary but **unfinished** — both keys coexist on ~120+ CRM tables held in lock-step by a trigger, `org_id` remains canonical on `crm_records`, and new tables still introduce `org_id`. Two concrete isolation breaches stand out for the SaaS direction: the GoTo VoIP table set has no `org_id` (would commingle calls), and shared platform-level credentials mean every tenant shares one Authorize.Net merchant, one MS app, and one OpenAI/Gemini key.

**Productization** (38) is the weakest pillar: branding/logos/colors are stored per-tenant but never rendered in authenticated chrome (the only `.branding` consumers are the tenant resolvers themselves); the custom roles/permissions engine is decorative; `crm_system_settings` and `admin_settings` feature flags are write-only; custom pipelines are deferred; report templates and dashboard widgets are hardcoded for all tenants; new tenant orgs are not seeded with default templates. What **is** genuinely per-tenant and wired: modules, custom fields, lead-source field options, comms providers/templates, email sending domains (DKIM/SPF/DMARC), developer API keys/webhooks, and user-built custom reports/filters. To ship as the stated white-label SaaS it needs: applied per-tenant branding/theming, a real enforced configurable RBAC, completion of the tenant-key migration, per-tenant secrets, consolidation of the duplicate engines, and CI test-gating + secret rotation + backups + monitoring.

### Per-Tenant Configurability Matrix

| Capability | Per-Tenant Configurable | Evidence |
|------------|:-----------------------:|----------|
| Branding (org-level white-label chrome) | **no** | `organizations.branding` + `admin_settings` STORED but NEVER rendered; only `.branding` consumers are `tenant.ts` resolvers + one learn-doc string. Member portal hardcoded "Double Helix Hub". |
| Colors (per-tenant color theming applied) | **partial** | `landing_pages` colors applied on the PUBLIC enroll page (`enroll/[slug]/client.tsx:142,224,228,377`); advisor primary_color passed to AgentShell but not applied; org `admin_settings` colors inert. |
| Logos (per-tenant logo upload + display) | **partial** | `logo_url` stored per-tenant/advisor/landing-page; landing logos surface on public enroll form; `organizations.branding` + `admin_settings` logo have no rendering consumer. |
| Email settings (domains, from-address, providers) | **yes** | Per-org `email_domains` + `email_sender_addresses` (DKIM/SPF/DMARC, org-scoped RLS, `202601180002:163-209`); per-org from-address from `system_settings`; provider keys via `integration_connections` + `crm_message_providers` (duplicate stores caveat). |
| Roles (per-tenant custom roles/permissions) | **no** | Enforced RBAC is hardcoded 4-value `crm_role` enum; `crm_roles/crm_permissions/crm_user_roles` consulted by NO authz path (only `security-control/page.tsx` + `security/roles/route.ts`); three overlapping vocabularies. |
| Teams (per-tenant team configuration) | **partial** | Team management (invite/edit/roles/capacities via `team_invitations`, org-scoped, rate-limited) but no first-class team entity; team-page client gate has a role-comparison bug. |
| Departments (per-tenant department entity) | **no** | No department entity or admin CRUD anywhere; settings dirs have no `departments`. |
| Products (per-tenant product catalog) | **partial** | Reports map a `products` table by organization_id; pricing/product catalog exists but is GLOBAL non-tenant reference data; no per-tenant product-catalog admin CRUD. |
| Pipelines (per-tenant custom pipelines) | **no** | `crm_pipelines` removed/DEFERRED; `settings/pipelines/page.tsx` redirect stub; `/api/crm/pipelines` returns empty/501. |
| Stages (per-tenant deal/stage config) | **partial** | `crm_deal_stages` editable per-org via `/api/crm/stages` + kanban gear, but no settings UI, 6 hardcoded fallback stages, three inconsistent analytics taxonomies → broken charts when customized. |
| Lead sources | **yes** | `lead_source` is a per-org `crm_fields` select with 7 default options seeded per org (`seed.ts:51`); tenant can add/edit options via custom-fields admin. |
| Custom fields (per-tenant per-module) | **yes** | `crm_fields` per-module, admin-gated, per-org seeded, enforced at record-create, report-resolved. Strongest dimension. (Minor gap: JSONB custom fields unresolved in grouped reports.) |
| Reports (per-tenant report config) | **partial** | Custom reports/filters per-org/per-user (org-scoped RLS, 6-step builder); but `REPORT_TEMPLATES` + `WIDGET_REGISTRY` hardcoded for all tenants; no per-tenant template/widget customization; charts/export/scheduled delivery incomplete. |

---

## 7. Security Assessment

**Security Score: 58 / 100.** A fundamentally sound multi-tenant model at the data layer (RLS keyed on `profiles`/`auth.uid()`, fail-closed `is_super_admin()`, the `202605300012` cross-tenant remediation verified by an authenticated staging spec) is undermined by three critical issues — a committed live prod service-role key, unverified/weak-crypto integration endpoints, and public PHI documents — plus a structurally fragmented authorization story.

### Findings by Severity

| Severity | Title | Area | Evidence | Recommendation |
|----------|-------|------|----------|----------------|
| **Critical** | Live prod Supabase service-role key committed in tracked `.env.vercel` | Secrets / service-role | `git ls-files` TRACKED; service_role JWT, ref `sffisarikcreyyjzdjvb`; committed `0eb95177` | Rotate key immediately; `git rm --cached`; `.gitignore`; purge history; audit access logs; move secrets to env config |
| **Critical** | GoTo webhook accepts unverified requests (signature presence-only auth bypass) | Auth (webhook) / integrations | `goto-webhook-processor/index.ts:52-54` | Implement real HMAC verify (constant-time) against raw body; fail closed; do not deploy until fixed |
| **Critical** | Enrollment contract PDFs (member PHI/PII) exposed via public-read URLs | Tenant isolation / PHI | `generate-enrollment-contract/index.ts:801-805` (getPublicUrl) | Make bucket private; serve via short-lived signed URLs gated by authz; verify no public URLs persisted |
| **High** | OneDrive OAuth tokens stored with XOR obfuscation under default secret | Secrets / integrations | `202603070004:45-94` (XOR); `onedrive-oauth/index.ts:41` ("change-me-in-production") | Use AES-256-GCM (credentials.ts) or pgsodium/Vault; fail closed if secret unset; consider removing the orphaned function |
| **High** | `commission_transactions`/`commission_payouts` RLS enabled but no write policy | Authorization / RLS | `202601150001:464-498` (SELECT-only) | Add role-gated, org-scoped WITH CHECK write policies OR route writes through a service-role endpoint with explicit checks; add tests |
| **High** | Orphaned custom-roles RBAC engine = security theater | Authorization / RBAC | `security-control/page.tsx:147`; zero non-security references to `crm_role_permissions`/`crm_user_roles` | Wire crm_user_roles/permissions into `has_crm_role()`/RLS OR remove the tables/UI; surface a "non-functional" banner meanwhile |
| **High** | Three overlapping role systems enforced inconsistently | Authorization / RBAC | `types.ts:1246` vs `tenant.ts:30` vs commission routes; `team/page.tsx:159-163`; `unified-inbox-service.ts:435` (phantom `crm_user`) | Single authoritative role-to-capability matrix; normalize helpers; fix team-page gate + bogus filter; add cross-role boundary tests |
| **High** | Inconsistent cron-secret enforcement — several endpoints fail OPEN | Auth (cron) | `comms/cron:19`, `sequences/process:13`, `automation/cron:42` ("if (cronSecret)"); `workflow-processor` no auth | Make every cron/internal endpoint fail closed (match `email/process-queue`); add auth to workflow-processor; make deploy gate fail closed |
| **High** | Public/self-serve enrollment can attach records to wrong tenant via `organizations.limit(1)` | Tenant isolation | `enroll/actions.ts:143-151`; service-role public routes bypass RLS | Derive org only from trusted landing page/draft; reject when unresolved; audit every service-role public path for explicit org filter; add cross-tenant test |
| **Medium** | Destructive ops gated only at route-level `crm_role` while using service-role clients (RLS bypass) | Service-role / authz | `leads/convert/route.ts:6-17,37`; `records/[id]/merge/route.ts:16-27,52` | Enforce explicit role + org match against source record before mutating; add cross-tenant + insufficient-role tests; prefer calling-user RLS where possible |
| **Medium** | member→crm sync triggers swallow all errors as warnings, no alerting | Audit / data integrity | `202605300015:135-138,319-323` | Add a sync_failures/dead-letter table + alert on WHEN OTHERS; wire an error sink; keep non-fatal member write |
| **Medium** | SSO configurable but never enforced; security-control GET endpoints only auth-gated (info disclosure) | Auth / authz | `sso-config/route.ts:81`; `roles/route.ts:10-14` (GET auth-only) | Enforce `enforce_sso` in auth middleware or remove the toggle; admin-gate the roles/permissions GET endpoints |
| **Medium** | Campaigns send without suppression; no SMS STOP/opt-out automation | Compliance (CAN-SPAM/TCPA) | `campaigns/[id]/send/route.ts:280-318`; Twilio inbound has no STOP | Gate campaign sends on suppression + log to sent_emails; add STOP keyword detection that sets `do_not_sms` |
| **Medium** | PCI: full card/bank credentials transit `process-payment` body in plaintext | Secrets / PCI | `process-payment/index.ts:498-515` | Tokenize client-side (Accept.js/Stripe.js); remove `sk_placeholder` fallback; confirm no plaintext card logging |
| **Medium** | RLS added in later "hardening" passes; no FORCE ROW LEVEL SECURITY anywhere | RLS coverage | pricing RLS-OFF `202603110001` until `202603110004`; FORCE RLS count = 0 | Make "CREATE TABLE + ENABLE RLS + policies same migration" a CI-enforced convention; consider FORCE RLS on PII/PHI tables; CI fail on RLS-less new tables |
| **Medium** | Edge functions reference tables/RPCs with no committed migration; live schema not reproducible | RLS coverage / schema integrity | GoTo, OneDrive, legacy ticket tables; `call_logs`/`goto_settings` no `org_id` | Author migrations (org_id + RLS) for needed tables OR delete orphaned functions; add org_id + RLS to any VoIP tables before wiring |
| **Low** | No production error-tracking/observability sink for security-relevant failures | Audit / monitoring | `instrumentation.ts:84` ("production starts silent"); no Sentry/Datadog deps; tests not in CI | Wire an APM/error sink; route auth failures/RLS denials/payment/sync errors to it; run the cross-tenant/RLS DB specs in CI as a merge gate |
| **Low** | Legacy Vite SPA has its own Supabase client predating the cross-tenant remediation | Tenant isolation / migration debt | `src/lib/supabase.ts`; last changed 2026-04-08 (before `202605300012`) | Decommission SPA: remove root vite/netlify build target or repoint at a Next app; untrack dead `src/`; at minimum disable the Netlify deploy path |
| **Low** | Single shared OPENAI/GEMINI key across tenants; PHI to LLMs with no per-org kill switch or BAA controls | Secrets / compliance (PHI) | AI area: global key, hardcoded enable (`RecordDetailShellV2.tsx:981`), no metering | Add per-org AI enable flag + per-tenant keys/quotas; gate PHI prompts behind consent + BAA/DPA; add rate limiting + audit on AI routes |

### RLS / Tenant-Isolation Assessment

Tenant isolation at the database layer is the strongest part of the security posture and is genuinely (not aspirationally) sound. RLS is enabled on ~354 tables; the authorization helpers (`get_user_organization_id`, `get_user_role`, `is_super_admin`, `is_admin`) resolve org and role from the `profiles` table keyed on `auth.uid()` as `SECURITY DEFINER`/`STABLE` functions — NOT off JWT claims or `user_metadata` — which is the correct fail-closed model (`is_super_admin` COALESCEs to false). `search_path` is pinned on the SECURITY DEFINER helpers.

Credit where due: migration `202605300012` closed a real, previously-latent cross-tenant leak by org-scoping 20 staff/admin policies across 11 tables (members, enrollments, commissions, and other PII/PHI), adding `WITH CHECK` on write paths and gating on `is_super_admin() OR organization_id = get_user_organization_id()`. This is confirmed by an authenticated cross-tenant staging spec (`cross-tenant.db.spec.ts`) showing org-A reads return 0 foreign rows and own-org returns 1.

Tenancy-key duality (`org_id` vs `organization_id`) is mid-strangler: members/enrollments/advisors use `organization_id` natively, while the `crm_records` family was born on `org_id` and is being migrated additively (dual columns kept in lock-step by `sync_org_tenant_key()`). Both columns are FK-constrained to `organizations`, so isolation is intact today, but two structural risks remain: (1) the BEFORE trigger only fills NULLs and does not reconcile two conflicting non-null values (split-brain risk); and (2) new tables (`crm_activation_outbox`) are still being created on `org_id`.

Notable isolation exceptions: GoTo VoIP tables have no `org_id` and a single global `goto_settings` row; the sla-daemon would post all tenants' breach alerts to one shared Slack webhook; public enrollment (service-role, RLS-bypassing) depends on hand-written org filters plus a dangerous `organizations.limit(1)` fallback; and heavy service-role usage (615 DEFINER functions) means any single omitted org filter becomes a cross-tenant leak with no RLS backstop. Per-tenant **configurability** (vs isolation) is weak — branding, feature flags, SSO enforcement, and custom roles are stored but not applied/enforced.

### Checks Still Requiring LIVE `qa-auth-rls` / `qa-security` Probes

These claims are from static analysis and require live dynamic verification before sign-off:

1. **qa-auth-rls** — Authenticated two-tenant + anon probes against the post-`202605300012` policies on members/enrollments/commissions/crm_records, confirming org-A staff/admin cannot read or write org-B PII/PHI across all 11 remediated tables and write paths.
2. **qa-auth-rls** — Probe `commission_transactions`/`commission_payouts` to confirm whether ANY authenticated WRITE path exists (report finds only SELECT) and whether the admin approve/generate-payout UI fails closed or has an undocumented write policy.
3. **qa-auth-rls** — Verify `sync_org_tenant_key()` behavior when `org_id` and `organization_id` are set to DIFFERENT non-null values on `crm_records` (split-brain): reject, reconcile, or silently allow?
4. **qa-security** — Confirm whether `.env.vercel` was pushed to a remote / is in git history; verify the exposed service-role key is still valid against `sffisarikcreyyjzdjvb` and must be rotated.
5. **qa-security** — Live-test the `goto-webhook-processor` signature check (present-but-invalid `x-goto-signature`) to confirm the auth bypass; confirm whether the function is deployed.
6. **qa-security** — Confirm the `enrollment-contracts` bucket is public-read and that a contract PDF is retrievable by URL without auth (PHI exposure).
7. **qa-security** — Check whether the legacy Vite SPA / `netlify.toml` deploy path is live and whether its standalone Supabase client can reach prod data without the `202605300012` hardening.
8. **qa-security** — Verify FORCE ROW LEVEL SECURITY status and enumerate any LIVE tables lacking RLS (especially edge-function-referenced tables with no migration: `call_logs`, `goto_settings`, `oauth_tokens`, `sla_timers`, `ticket_events`).
9. **qa-security** — Confirm which cron/internal endpoints (`comms/cron`, `sequences/process`, `automation/cron`, `crm/scheduler/tick`, `workflow-processor`) are reachable unauthenticated when `CRON_SECRET` is unset / verify the `verify_jwt` configuration.
10. **qa-auth-rls** — Verify whether `enforce_sso` has any enforcement in the live auth flow, and that security-control roles/permissions GET endpoints are reachable by a non-admin authenticated org user (info disclosure).

---

## 8. Product Roadmap

Five phases, ordered so each unblocks the next: stop the bleeding → consolidate into one coherent CRM → productize for multi-tenant SaaS → add enterprise depth → expand the AI platform. Effort: **S** (≤2d) · **M** (≤1wk) · **L** (1–3wk) · **XL** (>3wk).

### Phase 1 — Critical Fixes
*Stop the silent failures, money/data-loss bugs, and security exposures that make the current product untrustworthy in prod. Nothing else is safe to build on until these are fixed.*

| Title | Why | Effort | Area |
|-------|-----|:------:|------|
| Rotate and purge the committed production service-role key | Live PIFH service-role key (RLS-bypassing) + anon key + URL committed in tracked `.env.vercel` — anyone with repo access has full prod DB access. | S | Production Readiness |
| Schedule `/api/automation/cron` (and `/api/crm/scheduler/tick`) in vercel.json | Sole driver of cadence advancement, delayed steps, scheduled workflows, and SLA escalation is unscheduled — an entire advertised automation class silently never runs. | S | Workflow Automation & Background Jobs |
| Fix sequence email send path (queued rows have no worker) | `executeEmailStep` writes `sent_emails(status='queued')` but `claim_pending_emails` only reads `notification_queue` — drips never send while the UI reports success. | M | Communications |
| Add INSERT/UPDATE RLS write policies for commission_transactions/payouts | SELECT-only RLS blocks the admin UI's user-authed approve/generate-payout writes — finance staff cannot approve commissions or generate payouts in prod. | S | Enrollment & Commissions |
| Fix process-commissions member attribution (`enrollments.member_id` does not exist) | Reads a non-existent column (it's `primary_member_id`), so member_id resolves null and corrupts member-level commission reporting. | S | Enrollment & Commissions |
| Resolve double-commission risk across the three ledger systems | Trigger (`commissions`) AND billing-driven edge fn (`commission_transactions`) can both pay one enrollment with no cross-check. Pick one path; disable the other. | M | Enrollment & Commissions |
| Apply the family-shared-email member sync fix (draft 016) | Bug B1 is live: the 2nd same-email family member is permanently invisible in the members module — active PHI/billing-completeness data loss. | M | Database & Schema Reality |
| Fix enrollment dead-end redirects to non-existent `/payment` and `/intake` | Public agreement page and wizard redirect to routes that don't exist — members hit a 404 immediately after signing, breaking the core flow. | S | Member Portal & Advisor/Agent Experience |
| Make process-payment honor per-tenant credentials and fix the create_profile contract | Edge fn reads platform env creds (all tenants share one merchant) despite a per-tenant UI, and the enrollment caller sends a mismatched payload shape. | M | External Integrations |
| Lock down GoTo webhook auth and disable the orphaned non-org-scoped VoIP stack | Authorizes any request with an `x-goto-signature` header present (no verification) and writes to no-org_id, no-migration tables — unauthenticated injection + cross-tenant commingling. | S | Communications |
| Fix the `/api/comms/templates ?category=` 500 (column does not exist) | The route filters by a renamed column, so any caller passing `category` errors at runtime in a core compose surface. | S | Template System |
| Remove fabricated/misleading data from Forecasting and Operations Center | Both present fabricated numbers as real (fake bars/targets; 100% mock counts + fake loading timer), risking revenue/ops decisions on invented data. | M | Reporting & Analytics |
| Disable XLSX/PDF export buttons that throw at runtime | `exportData` only implements csv/json; Excel/PDF buttons hit a default-case throw, producing an unhandled error on a core deliverable. | S | Reporting & Analytics |
| Wire vitest + DB/cross-tenant specs into CI as a merge gate | ~29 specs (incl. the strongest tenant-isolation coverage) exist but no CI runs them — money/enrollment/RLS regressions can merge to main undetected. | M | Production Readiness |

### Phase 2 — Core CRM Completion
*Finish or remove the half-built/orphaned features and collapse the duplicate systems so there is ONE coherent, fully-wired CRM to productize. Consolidation here directly enables per-tenant configurability in Phase 3.*

| Title | Why | Effort | Area |
|-------|-----|:------:|------|
| Consolidate the four automation/sequencing systems onto crm_workflows + one sequence engine | crm_workflows, crm_cadences, email_sequences, and dead automation_rules coexist; fixes don't propagate and dead CRUD lets operators build rules that never fire. | XL | Workflow Automation & Background Jobs |
| Implement durable execution for fire-and-forget triggers + real delay_wait | on_create/on_update run via `.catch()` without await and `delay_wait` is a no-op, so side effects drop on Lambda freeze and waits execute instantly. | L | Workflow Automation & Background Jobs |
| Build the staff ticket queue + detail in the Next.js CRM and wire SLA enforcement | Members file tickets into a write-only black hole — no staff queue/detail/assign/reply, no create notification, and SLA is config-only with no executor. | XL | Tickets, Support & SLA |
| Unify the two comms stacks and template stores | send-service vs comms/dispatcher with disjoint template stores — a template authored in Settings is invisible in the inbox composer; inbound SMS bypasses the unified inbox. | XL | Communications |
| Make campaigns compliant and trackable | Campaigns skip suppression (CAN-SPAM), never log to sent_emails, and never inject the tracking pixel/links — opens/clicks stay ~0 and analytics are wrong. | M | Communications |
| Add inbound SMS STOP/opt-out handling | No STOP detection on inbound Twilio; `do_not_sms` is only checked at send and never auto-set — a TCPA compliance gap. | S | Communications |
| Consolidate the three enrollment flows and two agent apps onto one path each | 3-4 partially-wired enrollment flows + two agent experiences risk divergent behavior and double-billing if the wrong flow is revived. | XL | Member Portal & Advisor/Agent Experience |
| Route CRM-internal enrollment creates through the idempotent RPC | CRM advisor-assisted and portal self-serve use raw inserts (no idempotency_key); self-serve also falls back to `organizations.limit(1)` (wrong-tenant hazard). | M | Enrollment & Commissions |
| Replace hardcoded stage taxonomy with crm_deal_stages everywhere | Kanban keys, pipeline-report names, and forecasting names are three different lists, so customizing stages breaks velocity/conversion/forecast charts. | M | Leads & Pipeline |
| Implement report chart rendering and a real scheduled-reports executor | The builder collects chart config but nothing draws charts, and `crm_scheduled_reports` rows are created with recipients but never delivered. | L | Reporting & Analytics |
| Wire the stubbed dashboard widgets to their existing RPCs and remove dead-end pages | ~12 widgets are stubbed to empty data even though working RPCs exist, and the Custom Dashboards page links to a non-existent `/new` route. | M | Reporting & Analytics |
| Reconcile the duplicate task APIs and fix owner-less calendar/booking writes | Two task CRUD APIs + a calendar New Event writing owner-less crm_tasks client-side; the booking endpoint promises an unsent email and creates no calendar/task. | L | Tasks, Calendar & Scheduling |
| Persist OAuth refresh tokens and add a calendar disconnect route + bookings read UI | Refreshed Google/Outlook tokens are discarded (in-memory only) so sync silently fails; disconnect 404s; bookings are write-only with no host UI. | M | Tasks, Calendar & Scheduling |
| Migrate portal pages onto the server data layer and remove fabricated member-facing data | Billing/documents/coverage/profile still query client-side with hardcoded benefits, IUA, group number, fake notification-save, and dead buttons. | L | Member Portal & Advisor/Agent Experience |
| Unify the two stage-history tables so automated status changes appear in the timeline | Auto-activation/blueprint transitions write `crm_stage_history` while the timeline reads `crm_deal_stage_history` — automated status changes are missing from the audit timeline. | M | Contacts & Members Lifecycle |
| Decommission the legacy Vite SPA and fix root build/deploy targets | ~34.7k LOC of unimported legacy ticketing SPA (pre-RLS-remediation client) is still the target of root build + netlify.toml; accidental redeploy exposes an un-hardened surface. | M | Frontend Architecture & Build/Migration Debt |

### Phase 3 — SaaS Productization
*Deliver the white-label/strangler payoff: make every promised per-tenant knob actually work, complete the tenant-key cutover, and turn stored-but-inert config into enforced behavior. This converts the consolidated CRM into a multi-tenant SaaS.*

| Title | Why | Effort | Area |
|-------|-----|:------:|------|
| Complete the `org_id → organization_id` tenant-key cutover | `crm_records` still keys uniqueness/ON CONFLICT/hot indexes on legacy `org_id`; the dual-column state is effectively permanent and new tables keep re-introducing `org_id`. | XL | Database & Schema Reality |
| Apply per-tenant branding/theming at the render layer | Branding/colors/logos are stored per-tenant but the only consumer is a learn-doc string — white-label is data-only and the member portal is hardcoded "Double Helix Hub". | L | Settings, Admin, RBAC & Configurability |
| Replace the three role systems with one enforceable, tenant-configurable RBAC | crm_role/profiles.role/organization_members.role are enforced inconsistently and the custom-roles engine is never consulted (security theater). | XL | Settings, Admin, RBAC & Configurability |
| Build the per-tenant pipeline/stage configuration UI (un-defer Phase 2A) | Pipeline settings are a redirect stub and the page falls back to 6 hardcoded stages — deal/stage taxonomy is not tenant-configurable. Now possible since Phase 2 reads crm_deal_stages. | L | Leads & Pipeline |
| Make stored feature flags and SSO enforcement actually take effect | `enable_self_enrollment`, `enrollment_auto_approve`, `require_payment_before_activation`, system-settings, and `enforce_sso` are saved but never read/enforced. | L | Settings, Admin, RBAC & Configurability |
| Seed default templates and modules on tenant creation; unify the template stores | Template seeding was a one-time backfill with no org-creation trigger, so new tenants start with zero templates — a provisioning gap that blocks onboarding. | M | Template System |
| Add a real per-tenant forecasting model with configurable targets/probabilities | Forecasting (cleaned in Phase 1) still has no per-tenant target or stage-probability config; each tenant needs its own quota and weighted-pipeline model. | M | Leads & Pipeline |
| Make per-tenant payment, telephony, and integration credentials/webhooks configurable | Authorize.Net, MyTelemedicine, OneDrive, and GoTo all read shared platform env creds, so every tenant shares one account — the biggest white-label gap. | L | External Integrations |
| Wire automated DB backups, an error-tracking sink, and a health endpoint | No automated backup (0-byte placeholder), no APM sink (console + Vercel logs only), and no `/api/health` — unacceptable for a multi-tenant SaaS SLA. | M | Production Readiness |
| Generalize the deploy gate beyond the hardcoded single PIFH tenant | The deploy gate hard-codes PIFH org id, owner UUIDs, and count floors, so it cannot validate a second onboarded org. | M | Production Readiness |
| Add server pagination to members list, revenue, and unbounded report reads | Members API capped at 200 with client-side search; Revenue + reports load entire tables client-side; analytics `.limit(10000)` — breaks at tenant scale. | M | Reporting & Analytics |
| Add reverse CRM → members sync and dead-letter alerting on sync failures | Sync is one-way so CRM edits never reach the portal source of truth, and triggers swallow errors as WARNINGs so members can exist with no crm_record silently. | L | Contacts & Members Lifecycle |

### Phase 4 — Enterprise Features
*With one consolidated, truly multi-tenant base and enforced RBAC/config, layer on the depth enterprise buyers expect: full hierarchies, compliance-grade money handling, template/report sophistication, and integration breadth.*

| Title | Why | Effort | Area |
|-------|-----|:------:|------|
| Build full multi-level downline + missing agent detail routes and attribution | The agent UI shows only direct reports despite the recursive DB function, `/agent/downline/[id]` 404s, member lists exclude downline, and conversion stats read 0. | L | Member Portal & Advisor/Agent Experience |
| Unify the three commission ledgers into one canonical, audited system with idempotency | After Phase 1 stops double-counting, the underlying duplication still leaves CRM and admin reading different tables; `createCommissionTransaction` lacks an idempotency_key. | XL | Enrollment & Commissions |
| Implement real ACH payout dispatch and correct payout method enums | The ACH path returns a synthetic reference and marks payouts 'paid' with no money movement, and method values mismatch the schema (check/wire fall to manual). | L | Enrollment & Commissions |
| Secure enrollment contract PDFs (remove public-URL PHI exposure) | Contracts are uploaded with `getPublicUrl`, so member PHI/PII is reachable by URL without auth in a multi-tenant bucket. | M | Enrollment & Commissions |
| Add template versioning/history/rollback and a real call-script feature | `version` is dormant (never used), there is no version history, and call scripts don't exist (only static client-side note templates). | L | Template System |
| Complete multi-module and JSONB-aggregation report execution | `execute_report_query` ignores `p_columns/p_filters` and `execute_report_aggregation` treats JSONB custom fields as literal columns, so grouped custom reports error or mis-group. | M | Reporting & Analytics |
| Implement renewal/anniversary and termination lifecycle automation | Only start-date activation and age-65 cancellation exist; there is no renewal/anniversary or termination automation despite `current_year_start_date` being present. | M | Contacts & Members Lifecycle |
| Add general recurring tasks, assignee picker, and a meeting entity with attendees | Tasks are effectively self-assign (no picker), there is no RRULE recurrence, and `/crm/meetings` is an empty 404 with no attendee/agenda management. | L | Tasks, Calendar & Scheduling |
| Build real e-signature, accounting, and CRM-sync integrations | DocuSign/PandaDoc, QuickBooks/Xero, and Salesforce/HubSpot/Zoho are OAuth-config + interface stubs with no adapter; enterprise buyers expect these. | XL | External Integrations |
| Maintain activity_log partitions and harden RLS provisioning | `activity_log` partitions are static through 2026m07 with no roll-forward cron, and RLS is added in later passes (a table can ship exposed). | M | Database & Schema Reality |

### Phase 5 — AI Platform Expansion
*With per-tenant config, metering, and a consolidated data spine in place, expand AI from the three working features into a governed, tenant-isolated platform capability.*

| Title | Why | Effort | Area |
|-------|-----|:------:|------|
| Add per-tenant AI enablement, keys, models, prompts, and a kill switch | AI is gated by a hardcoded `enabled` literal and a single global key serves all orgs, so one tenant's abuse exhausts everyone's rate limit/cost and no tenant can opt out of sending PHI. | L | AI Capabilities |
| Add usage metering, rate limiting, cost ceilings, and audit logging on AI calls | The live OpenAI endpoints have no per-org quota, rate limit, cost control, or audit log — required before AI can be a billable SaaS capability. | M | AI Capabilities |
| Establish a PHI/BAA-safe AI data path | field-suggest/email-draft send health-sharing member data to OpenAI with only prompt-level guardrails and no BAA/DPA controls in code. | L | AI Capabilities |
| Build AI inbound-email triage/classification and record/note summarization | email-intake is regex-only and there is no summarization in the live apps — high-value generalizable AI once the comms + ticket spine is consolidated. | L | AI Capabilities |
| Add AI next-best-action and AI-assisted task generation grounded in the unified data | War-room next-best-actions are manual and there is no AI task generation; the consolidated workflow/activity data makes grounded recommendations feasible. | L | AI Capabilities |
| Implement predictive lead scoring, churn, and sentiment as opt-in tenant models | Current scoring is rule-based and churn/lead-score are descriptive only; predictive models turn reporting into a forward-looking, per-tenant AI feature. | XL | AI Capabilities |
| Add RAG/embeddings knowledge retrieval (replace the leaked legacy implementation) | The only vector search is in the legacy SPA and ships `VITE_OPENAI_API_KEY` to the browser; there is no server-side RAG in the live apps. | L | AI Capabilities |

---

## 9. Methodology & Limitations

**Method.** This deliverable is the consolidated output of an **evidence-grounded static analysis** of the CRM-ECO repository. Each of 14 functional areas was audited by inspecting the real source tree — application routes, library code, Supabase migrations, edge functions, CI workflows, and configuration — and every finding is anchored to concrete `file:line` / path evidence, preserved throughout this report. Findings distinguish what is wired end-to-end from what is partial, broken, orphaned, deprecated, or merely planned/config-only. The audit followed the project's standing rules: inspect the real repo (no path/framework/schema assumptions), treat documentation as claims rather than ground truth, and verify multi-tenant isolation rather than assume it.

**Adversarial score re-verification.** The 9-dimension scorecard was subjected to an adversarial re-verification pass. Four dimensions — **Architecture (58), Security (47), UX (50), and Reporting (55)** — were independently re-checked against the live repository with explicit verdicts; in every case the original score **held** after the load-bearing claims (e.g., the committed `.env.vercel` service-role key, the unscheduled `/api/automation/cron`, the 404 enrollment dead-ends, the throwing report export, the injection-safe RPC allowlist) were confirmed verbatim from source. The remaining five dimensions (Scalability 48, SaaS Readiness 38, Automation 48, AI Readiness 33, Product Completeness 50) carry their original scores; they were **not** separately re-verified in this pass and should be treated as well-supported-but-unaudited. The overall completeness figure (~49%) is derived from the verified dimension scores and the per-area maturity spread (28–72), and is an analyst estimate, not a precise measurement.

**Limitations — claims requiring LIVE verification.** This is static analysis. Several load-bearing claims have **not** been confirmed against a running system or live database and require dynamic probes before being acted upon as fact (see §7 for the full list). In particular:

- **Live DB / RLS probes (`qa-auth-rls`):** the post-`202605300012` org-scoping must be confirmed with authenticated two-tenant + anon probes across all 11 remediated tables and write paths; the existence/absence of write policies on `commission_transactions`/`commission_payouts`; the `sync_org_tenant_key()` split-brain behavior on conflicting non-null keys; whether `enforce_sso` is enforced anywhere; and whether security-control GET endpoints leak the role/permission catalog to non-admins.
- **Security probes (`qa-security`):** whether the committed service-role key is still valid and present in remote history (and must be rotated); the GoTo webhook signature bypass; whether the `enrollment-contracts` bucket is genuinely public-read; whether the legacy Vite/netlify deploy path is live; FORCE-RLS status and any live tables lacking RLS (including edge-function-referenced tables with no migration); and which cron/internal endpoints are reachable unauthenticated when `CRON_SECRET` is unset.
- **Schema reality:** migration files are history, not truth. Several subsystems reference live-only tables (GoTo, OneDrive, legacy tickets) with no committed `CREATE TABLE`; the actual live schema and RLS state can only be confirmed against the database. Likewise, whether the dual-scheduled crons (age-65, weekly payout batches) and pg_cron jobs actually run is environment-dependent and unverified from the repo.
- **Runtime behavior:** "silently never runs" / "throws at runtime" / "404 dead-end" conclusions are inferred from static wiring (absent cron entries, missing routes, throwing code paths). They are high-confidence but should be confirmed by exercising the flows in a deployed environment.

No data was modified and no production writes were performed during this audit; all conclusions are read-only and reproducible from the cited evidence.
