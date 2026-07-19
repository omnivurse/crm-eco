# Prompt Examples

## Full CRM Audit

```text
Use the CRM Master Architect skill. Audit this CRM project before making changes. Map current modules, routes, tables, APIs, RLS policies, workflows, reports, and settings. Identify duplicate fields, wrong source-of-truth decisions, frontend/backend mismatches, missing workflow state machines, tenant isolation risks, and reporting reconciliation issues. Do not change code. Produce a prioritized repair plan with exact acceptance criteria and tests.
```

## Build a New CRM Module

```text
Use the CRM Master Architect skill. Design the [module name] module correctly for a multi-tenant CRM SaaS. First identify whether this should be a new object, existing object extension, custom field, custom module, join table, workflow, or report. Produce the data model, API/server actions, frontend screens, permissions, audit logs, workflows, reports, tests, and release gate. Avoid duplicate source-of-truth fields.
```

## Fix Duplicate Fields

```text
Use the CRM Master Architect skill. Perform a read-only duplicate-field and source-of-truth audit for [concept/module]. Find every table, column, API, frontend component, report, RPC, and workflow that references overlapping concepts. Classify each duplicate as canonical, alias, derived, legacy, import-only, external mapping, or wrong. Produce a safe migration/backfill/deprecation plan. Do not drop or rename anything yet.
```

## Vertical Slice Sync Audit

```text
Use the CRM Master Architect skill. Run a vertical slice synchronization audit for [feature]. Prove that database, RLS, API/server actions, frontend save, frontend read, cache invalidation, permissions, audit logs, reports, and tests all use the same canonical source. Identify exactly where the chain breaks and provide implementation-ready fixes.
```

## Multi-Tenant SaaS Readiness

```text
Use the CRM Master Architect skill. Audit this CRM for external SaaS tenant readiness. Check organization_id/tenant_id coverage, RLS policies, provisioning, role/team permissions, custom fields, settings, reports, imports, integrations, audit logs, billing gates, and tenant-leak tests. Produce a NOT READY / PILOT READY / SELF-SERVICE READY verdict.
```

## CRM Connector

```text
Use the CRM Master Architect skill. Design a connector between this CRM and [Salesforce/Zoho/HubSpot/other]. Define object mappings, field mappings, sync direction, source-of-truth per field, external IDs, conflict rules, webhooks, retries, dead-letter handling, admin UI, audit logs, and tests.
```

## Coding Agent Fix Prompt

```text
Use the CRM Master Architect skill and follow production-safe rules. First perform read-only discovery for [issue]. Then produce a minimal additive fix plan. Do not run migrations, delete fields, rename columns, change RLS, or write production data without explicit approval. Include files to inspect, tables to verify, acceptance criteria, tests, and rollback plan.
```
