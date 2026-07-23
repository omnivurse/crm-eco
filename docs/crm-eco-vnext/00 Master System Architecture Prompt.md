# 00 — Master System Architecture Prompt

> Part of the **CRM-ECO Enterprise Enrollment Platform — Master Build Prompt Package**.
> Read `README.md` first for the recommended build order and how to use this package.

---

## Original Prompt (verbatim)

Act as an enterprise SaaS software architect.

You are designing CRM-ECO Enterprise Enrollment.

This system must exceed Salesforce Health Cloud, Zoho CRM, HubSpot Enterprise, AgencyBloc, and other enrollment systems.

Your objective is NOT to clone an existing application.

Instead:

- Discover every module
- Discover every workflow
- Discover every permission
- Discover every relationship
- Discover every automation
- Discover every report
- Discover every integration
- Discover every dashboard widget

Then produce the complete enterprise blueprint. Nothing should be overlooked. Every page, modal, popup, search, bulk action, export, import, API endpoint, database table, notification, scheduled job, and permission should be documented.

Everything must be designed for: SaaS, Multi-Tenant, HIPAA, SOC2, Enterprise Scale, AI Ready.

Produce a complete enterprise software specification before any code is written.

---

## Current State (what already exists)

CRM-ECO is **not greenfield**. It is a Turborepo + npm-workspaces monorepo on Next.js 15 (App Router), React 19, TypeScript 5.3, Tailwind 3.4, Supabase (Postgres + RLS + Edge Functions), Zustand, React Query, Radix UI.

Apps:

| App | Path | Role |
|---|---|---|
| admin | `apps/admin/` | Enrollment/operations back office (the target of this package) |
| crm | `apps/crm/` | Zoho-style CRM: records, automation, sequences, AI |
| portal | `apps/portal/` | Member/advisor self-service |
| advisor-portal | `apps/advisor-portal/` | Legacy advisor tools |
| website | `apps/website/` | Public marketing + public enroll landing |
| doublehelixhub | `apps/doublehelixhub/` | Specialized module |

Shared packages: `@crm-eco/lib` (services, generated DB types, billing, commissions, audit, tenant constants, email, realtime), `@crm-eco/ui` (Radix primitives + audit-log UI + app-switcher + branding), `@crm-eco/enrollment` (self-serve wizard), `@crm-eco/rates` (E123 rate engine).

The multi-tenant, HIPAA-aware, audited foundation the prompt asks us to "design" **already exists in part** — see `16 Security Permissions.md`, `17 Tenant Configuration.md`, `18 Database Architecture.md`. The job of vNext is to **modernize, unify, and complete** it, not re-derive it.

## Gap Analysis (vNext vs today)

The five vNext principles and where the codebase stands:

1. **Configurable over hard-coded** — Partial. Feature flags (`crm_feature_flags`), plan gates (`check_org_plan_feature`), and org branding exist. But dashboards, list views, forms, and nav are still hard-coded per page.
2. **Unified entity model** — Weak. Members exist twice (admin `members` vs CRM `crm_records`); notes/tasks/documents/notifications are per-app silos. No shared "timeline + notes + attachments + audit + AI" mixin.
3. **Workflow-first** — CRM-only. A real automation engine exists in `apps/crm/src/lib/automation/` but admin actions do not route through it.
4. **AI-native** — CRM-only and feature-scoped (field-suggest, email-draft, import mapping). No per-module copilot pattern.
5. **Enterprise-ready foundation** — Strong bones (RLS, unified audit, roles) but uneven enforcement (scattered role-string checks) and forked infrastructure (tenant resolvers, documents UI).

## Build Notes (how to approach)

- **Do not rebuild the foundation.** Consolidate it. The highest-leverage work is turning shallow, duplicated modules into deep shared ones (see the architecture review report generated alongside this package).
- Treat each numbered prompt as one build increment: implement, verify against its Gap Analysis, then move on.
- Anchor all domain naming to `CONTEXT.md`. Record load-bearing decisions as ADRs in `docs/adr/`.
- Foundation prompts (16 Security, 17 Tenant, 18 Database, 02 Navigation, 19 Workflow, 20 API) should land before module deep-dives, because every module depends on them.
