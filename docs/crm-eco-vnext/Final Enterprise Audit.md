# Final Enterprise Audit

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **The capstone prompt — run last, and re-run after each major increment.**

---

## Original Prompt (verbatim)

This is the most important prompt. Perform a complete enterprise software audit.

Walk every page, button, tab, modal, popup, workflow, search, filter, report, API, table, trigger, automation, scheduled job, notification, permission, dashboard widget, tenant setting, role, integration, relationship, frontend component, backend endpoint, database table, migration, stored procedure, RLS policy, queue, cron, edge function, webhook, export, import, document, email, SMS, audit log, and AI workflow.

Identify: Missing features, Duplicate functionality, Dead code, Broken links, Broken workflows, Broken permissions, Broken APIs, Broken queries, Missing indexes, Database inconsistencies, Frontend inconsistencies, Schema inconsistencies, Tenant isolation issues, HIPAA risks, SOC2 risks, Security vulnerabilities, Performance bottlenecks, Accessibility issues, UX inconsistencies, Scalability concerns, Technical debt.

Provide an implementation plan, remediation roadmap, and quality score for each module. No area of the platform should remain unaudited.

---

## Current State (baseline for the audit)

This audit is not starting cold. This package (`00`–`23`) already contains the module-by-module Current State + Gap Analysis. The Final Audit's job is to **verify against reality**, quantify, and prioritize.

An architecture review has already run alongside this package (see the HTML report generated in `$TMPDIR`), surfacing six **deepening candidates** — the cross-cutting duplications where consolidation pays off most:

1. Shared list-view / DataTable module (Strong)
2. Documents module extraction — admin vs CRM forks (Strong)
3. Unified permission gate over `crm_permissions` (Strong)
4. Tenant resolver consolidation into `@crm-eco/lib/tenant` (Worth exploring)
5. Notification abstraction over 3 per-app tables (Worth exploring)
6. Admin API auth wrapper `withApi()` (Worth exploring)

## Consolidated Findings (from this package)

| Theme | Examples |
|---|---|
| Duplicate functionality | Documents (admin/CRM forks), tenant resolvers, members entity (`members` vs `crm_records`), notifications (3 systems), billing/invoices overlap |
| Missing platform layers | Configurable dashboard/nav, shared list-view, unified permission gate, shared automation/workflow, domain-event stream |
| Financial-correctness gaps | Idempotency keys, retry processor, enrollment→commission trigger, cancellation cascade |
| Compliance/security | Scattered role checks, webhook HMAC, formal HIPAA/SOC2 control mapping |
| CRM-only capabilities to platformize | Automation engine, sequences, approvals/blueprints, AI features |

## Build Notes / How to run this audit

- **Score each module 0–100** across: completeness, consistency, correctness, security, performance, UX. Produce a table.
- Cross-check every "Present" claim in `00`–`23` against the code before trusting it (this package is a map, not ground truth).
- Sequence remediation: foundation (`16`,`17`,`18`,`20`) → backbone (`02`) → deepenings (review candidates) → module gaps → review passes (`21`,`22`,`23`).
- Use subagents to parallelize: `qa-auth-rls` (tenant isolation), `qa-security`, `qa-performance`, `qa-data-lifecycle`, `qa-accessibility`; `explore` for dead-code/broken-link sweeps.
- Deliver: (1) scored module table, (2) prioritized remediation roadmap with effort, (3) go/no-go per `23`.
- Re-run this audit after each increment; it is the platform's regression gate.
