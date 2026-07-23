# 17 — Tenant Configuration

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Foundation prompt.**

---

## Original Prompt (synthesized in package voice)

Build enterprise **Tenant Configuration**: per-org branding, feature flags, plan/entitlement gates, configurable nav, configurable dashboards/forms/fields, notification defaults, domain/subdomain routing, and a settings surface where an org admin can configure the platform without code. Configuration is data, not deployments.

---

## Current State

Real, partial "config as data".

- Tenant model: `organizations` (name, slug, domain, plan, branding, settings), `organization_members` (role/plan/branding).
- Resolution: `apps/admin/src/lib/tenant.ts` + `apps/crm/src/lib/tenant.ts` (header → cookie → subdomain → membership); shared constants only in `@crm-eco/lib/tenant` (`dh_active_org`, `x-active-org`). Middleware injects tenant headers.
- Feature flags: `crm_feature_flags` + resolver `apps/crm/src/lib/crm/feature-flags.ts` (with user `ui_preferences` override).
- Plan gates: `check_org_plan_feature()` (migration `202605070007_org_plan_gates.sql`).
- Admin settings: `settings/page.tsx` (branding, feature toggles, notification emails, subdomain/domain).

## Gap Analysis

| vNext area | Status |
|---|---|
| Branding per org | Present |
| Feature flags | Present (CRM); admin uses toggles |
| Plan/entitlement gates | Present |
| Domain/subdomain routing | Present |
| Configurable nav | Missing (static `navSections`) |
| Configurable dashboards | Missing (ties to `01`) |
| Configurable forms/fields | Partial — CRM `crm_fields`/`crm_layouts` exist; admin tables are fixed |
| Tenant resolver duplication | **Yes** — two forks |

## Build Notes

- Consolidation target (architecture review, Candidate 4): **unify the two tenant resolvers into `@crm-eco/lib/tenant`**; both apps import one resolver. Removes drift and centralizes the isolation-critical path.
- Promote feature flags to a shared resolver (not CRM-only) so admin gates features the same way.
- Nav/dashboard/widget config (from `01`/`02`) should read from a tenant-config store seeded by plan + role.
- The CRM `crm_fields`/`crm_layouts` metadata model is the template for "configurable forms" — extend it rather than inventing a second field system.
