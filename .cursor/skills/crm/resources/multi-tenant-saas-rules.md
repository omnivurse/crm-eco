# Multi-Tenant SaaS Rules

A CRM that serves multiple organizations must be multi-tenant by design, not by convention.

## Tenant Ownership

Every tenant-owned row must include `organization_id`, `tenant_id`, or an equivalent tenant key.

Tenant-owned examples:

- Contacts
- Leads
- Accounts
- Deals
- Tickets
- Activities
- Tasks
- Products/plans if tenant-specific
- Pipelines/stages
- Custom field definitions
- Custom field values
- Views
- Templates
- Automations
- Imports
- Files/documents
- Reports
- Integration connections
- Audit logs

Global/system examples:

- System plans/tiers
- Global feature flags
- Public templates where intentionally shared
- Platform-level marketplace catalog

Global objects must be documented and protected.

## RLS / Authorization Rules

Never approve:

- Tenant data with no RLS.
- Tenant data with permissive `USING (true)` policies.
- Policies that trust client-provided tenant IDs.
- Admin screens that bypass authorization without service-role controls.
- Reports or search endpoints that can leak cross-tenant rows.
- Background jobs that run without tenant context.

## Server-Authoritative Tenant Context

Tenant context must come from authenticated membership, server session, or trusted service process.

Do not trust:

- URL tenant ID alone
- Form body tenant ID alone
- Client-side hidden fields
- Local storage
- Query parameters

## Tenant Configurability

CRM SaaS should allow tenant-level configuration for:

- Branding
- Terminology labels
- Pipelines
- Stages
- Required fields
- Custom fields
- Products/plans
- Roles
- Teams
- Assignment rules
- Templates
- Automations
- Reports
- Integrations

## Tenant Isolation Tests

Minimum tests:

1. User from tenant A cannot read tenant B contacts.
2. User from tenant A cannot update tenant B records.
3. Search cannot return tenant B results.
4. Reports cannot aggregate tenant B data.
5. Imports cannot write to tenant B.
6. Automations cannot act on tenant B.
7. Files cannot be accessed cross-tenant.
8. Admin impersonation is audited and permission-gated.
9. External webhooks resolve tenant context safely.
10. Custom fields are tenant-scoped.

## SaaS Readiness Verdicts

### Not Ready for SaaS

Any of:

- No tenant key on core tables.
- RLS missing or permissive.
- Provisioning is client-authoritative.
- Billing/plan access not enforced server-side.
- Hard-coded customer-specific fields/workflows.
- No audit logs.
- No tenant isolation tests.

### Pilot Ready

Requires:

- Tenant isolation enforced.
- Admin provisioning controlled.
- Critical workflows tested.
- Audit logs present.
- Backups and rollback plan.
- Limited tenants and manual onboarding.

### Self-Service Ready

Requires:

- Automated tenant provisioning.
- Billing/subscription enforcement.
- Tenant-safe customization.
- Onboarding flows.
- Usage limits.
- Observability.
- Data export/deletion policies.
- Support/admin tooling.
- CI tenant-leak gates.
