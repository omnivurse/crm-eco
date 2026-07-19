# Salesforce-Inspired CRM Patterns

Use these as universal CRM design patterns, not as instructions to copy Salesforce UI or proprietary implementation.

## Key Patterns

### Lead → Account / Contact / Opportunity Conversion

A lead represents an unqualified prospect. When qualified, conversion creates or links to more durable objects such as contact, account/company, and opportunity/deal.

Audit questions:

- Does lead conversion preserve source attribution?
- Does conversion prevent duplicate contacts/accounts?
- Does owner assignment transfer correctly?
- Does lead status become terminal after conversion?
- Are activities moved or linked to the converted records?

### Account-Centric B2B Model

Companies/accounts often act as the hub for contacts, opportunities, cases, contracts, products, and activities.

Audit questions:

- Are contacts associated to the correct account?
- Can one contact relate to multiple accounts if needed?
- Are account hierarchy and parent-child relationships needed?
- Does reporting distinguish account owner from opportunity owner?

### Opportunity Pipeline and Forecasting

Deals/opportunities should have pipeline, stage, amount, close date, owner, and forecast semantics.

Audit questions:

- Are stages stable IDs with ordered sequence?
- Are probabilities/forecast categories defined?
- Are closed-won and closed-lost terminal?
- Is lost reason required?
- Does close-won create downstream order/subscription/enrollment?

### Activity-Driven Selling

Calls, emails, tasks, meetings, and notes should roll up to lead/contact/account/deal timelines.

Audit questions:

- Are activities linked to all relevant records?
- Are tasks assigned and due-dated?
- Can managers report on activity by owner/team?
- Are activities permission-filtered?

### Role Hierarchy / Team Visibility

CRM visibility often needs owner, team, manager, territory, and admin views.

Audit questions:

- Can reps see only appropriate records?
- Can managers see team records?
- Are admin powers audited?
- Does reporting respect visibility?

### Workflow / Flow Automation

Automation should handle routing, follow-ups, notifications, approvals, and field updates.

Audit questions:

- Are automations idempotent?
- Are approval actions audited?
- Are required fields enforced server-side?
- Can admins understand and safely modify workflows?

## Salesforce-Like Modules to Consider

- Leads
- Accounts
- Contacts
- Opportunities
- Tasks/Events
- Activities
- Campaigns
- Cases
- Products
- Price Books
- Quotes
- Orders
- Contracts
- Forecasts
- Reports/Dashboards
- Custom Objects
- Permission Sets/Roles
- Flows/Automations

## Common Salesforce-Style Mistakes in Custom Builds

- Building contact/account/deal concepts as unrelated tables.
- No conversion lineage from lead to durable records.
- Pipeline stage stored as raw text.
- Forecast/reporting values not tied to opportunity data.
- User role hierarchy ignored.
- Activities not rolled up to related objects.
