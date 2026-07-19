# Zoho-Inspired CRM Patterns

Use these as general CRM implementation patterns, not as instructions to copy Zoho UI or proprietary implementation.

## Key Patterns

### Modules and Custom Modules

CRM modules should define object-specific records with layouts, fields, permissions, workflows, and reports. Custom modules can support vertical-specific objects when canonical CRM objects are insufficient.

Audit questions:

- Is this really a custom module, or should it be a field/relationship on an existing object?
- Are custom modules related to core objects through proper join/lookup relationships?
- Are custom modules tenant-scoped?

### Layouts and Sections

Different teams or pipelines may need different layouts, sections, and required fields.

Audit questions:

- Are layouts configuration-driven?
- Are required fields enforced server-side?
- Do layout fields map to real canonical fields?
- Are hidden fields still protected by API permissions?

### Workflow Rules

Workflow rules should trigger from record creation/update, field changes, or stage/status movement and perform controlled actions.

Audit questions:

- Does workflow depend on module/layout/section semantics?
- Are actions idempotent?
- Is there a way to test, disable, or audit workflow execution?

### Blueprint / Process Management

A blueprint-like process defines allowed states and transitions so a user cannot skip required business steps.

Audit questions:

- Is there a formal state machine?
- Are transition criteria defined?
- Are required fields enforced before transition?
- Are transition events audited?

### Approval Processes

Certain actions need approval, such as discounts, cancellations, refunds, high-value deals, plan changes, or restricted exports.

Audit questions:

- Who can request approval?
- Who can approve?
- What happens on approve/reject?
- Is approval history immutable?

### Data Administration

Import/export, dedupe, audit logs, recycle bin/archive, and storage management are core admin needs.

Audit questions:

- Are imports previewed and reversible?
- Are duplicates detected before create?
- Are exports permission-gated and audited?
- Are deletes soft-deleted or archived where required?

## Zoho-Like Modules to Consider

- Leads
- Contacts
- Accounts
- Deals
- Activities
- Tasks
- Events
- Calls
- Campaigns
- Products
- Quotes
- Sales Orders
- Purchase Orders
- Invoices
- Cases
- Solutions/Knowledge
- Vendors
- Custom Modules
- Workflows
- Blueprints
- Approvals
- Reports/Dashboards
- Audit Logs
- Integrations/Functions/Widgets

## Common Zoho-Style Mistakes in Custom Builds

- Creating custom modules for everything without source-of-truth rules.
- Layout customization changes UI but not validation/API.
- Workflow rules conflict with process transitions.
- Approval outcomes are not linked to record state.
- Imports bypass dedupe and audit trails.
