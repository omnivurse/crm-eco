# CRM Master Architect

A drop-in Claude custom skill for building, auditing, repairing, and scaling CRM systems correctly.

This skill is designed for CRM-ECO, ARYX, Olyron Core CRM, healthcare/enrollment CRMs, sales CRMs, service CRMs, multi-tenant SaaS CRMs, and any project where the system must manage people, organizations, pipelines, workflows, permissions, automations, reporting, and customer history.

## What This Skill Does

CRM Master Architect helps an AI coding or product agent:

- Understand how a complete CRM should work.
- Design CRM modules correctly from the beginning.
- Audit existing CRM builds for broken logic, duplicate fields, bad schema, unwired frontend, and tenant/security flaws.
- Create implementation plans that do not create duplicated tables or conflicting status models.
- Align database, API, frontend, permissions, automations, audit logs, and reporting.
- Produce safe prompts for Cursor, Claude Code, Codex, or similar coding agents.
- Build configurable multi-tenant CRM SaaS systems instead of hard-coded client-specific systems.

## Install

For Claude custom skills, place the folder here:

```text
.claude/skills/crm-master-architect/
```

The required file is:

```text
.claude/skills/crm-master-architect/SKILL.md
```

For Cursor-style projects, also copy:

```text
cursor-rules/crm-master-architect.mdc
```

into:

```text
.cursor/rules/crm-master-architect.mdc
```

## Recommended Use

Use this skill before:

- Building a new CRM module.
- Adding a pipeline, status, or workflow.
- Creating new tables or custom fields.
- Refactoring member/contact/account logic.
- Wiring frontend forms to backend data.
- Creating reports or dashboards.
- Building automations.
- Connecting Salesforce, Zoho, HubSpot, or another CRM.
- Preparing a CRM for multi-tenant SaaS use.
- Deploying CRM changes to production.

## Best Opening Prompt

```text
Use the CRM Master Architect skill. Audit this CRM project before any build work. Identify current modules, intended source-of-truth objects, duplicate fields, broken frontend/backend wiring, workflow gaps, tenant/RLS risks, reporting issues, and production readiness. Do not change code yet. Produce a prioritized repair plan with acceptance criteria and tests.
```

## Package Layout

```text
crm-master-architect/
├── SKILL.md
├── README.md
├── resources/
│   ├── ai-crm-agent-rules.md
│   ├── audit-output-template.md
│   ├── build-output-template.md
│   ├── canonical-crm-domain-model.md
│   ├── crm-principles.md
│   ├── crm-test-plan.md
│   ├── data-architecture-and-schema-rules.md
│   ├── diagnostics-wrong-build-checklist.md
│   ├── frontend-api-sync-audit.md
│   ├── hubspot-patterns.md
│   ├── import-deduping-data-quality.md
│   ├── integrations-and-sync-rules.md
│   ├── module-blueprints.md
│   ├── multi-tenant-saas-rules.md
│   ├── permissions-and-security-rules.md
│   ├── project-drop-in-rules.md
│   ├── release-gate.md
│   ├── reporting-and-dashboard-rules.md
│   ├── salesforce-patterns.md
│   ├── workflow-and-automation-rules.md
│   └── zoho-patterns.md
├── examples/
│   ├── audit-example.md
│   ├── build-spec-example.md
│   └── prompt-examples.md
├── config/
│   ├── audit-output-schema.json
│   ├── build-spec-schema.json
│   ├── crm-object-map.json
│   ├── module-maturity-model.json
│   └── severity-model.json
└── cursor-rules/
    └── crm-master-architect.mdc
```

## Core Philosophy

A CRM should not become a pile of screens and tables. A CRM should be a governed operating system for relationship history, ownership, lifecycle state, revenue/service motion, communication, automations, permissions, and reporting.

The biggest CRM build failures this skill is designed to catch are:

- Duplicate fields that represent the same business concept.
- Statuses and dates stranded on the wrong object.
- Frontend forms writing to one table while dashboards read another.
- Unclear lead/contact/account/opportunity boundaries.
- Hard-coded client workflows instead of tenant-configurable workflows.
- Weak tenant isolation.
- Missing audit logs.
- Automation loops.
- Reports that do not reconcile to source tables.
- Imports that create duplicate people, accounts, or memberships.
- Features that look done in the UI but are not wired end-to-end.

## Production Safety

This skill assumes the safest workflow:

1. Read-only discovery.
2. Current-state map.
3. Source-of-truth decision.
4. Additive/reversible design.
5. Dry run.
6. Pilot on limited data.
7. Verification.
8. Explicit approval before production writes.

Never use this skill as permission to run destructive database changes without review.
