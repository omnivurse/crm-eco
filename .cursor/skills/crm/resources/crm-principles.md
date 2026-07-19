# CRM Principles

A CRM is not a contact table. A CRM is a system of record and system of action for relationships, revenue, service, lifecycle movement, accountability, and communication history.

## CRM Must Answer These Questions

1. Who is this person or organization?
2. What is their relationship to us?
3. What stage are they in?
4. Who owns the relationship?
5. What happened previously?
6. What should happen next?
7. What are we allowed to see or do?
8. What revenue, service, membership, or operational value is associated?
9. What workflow is active?
10. What data is trusted for reporting?

## Core CRM Operating Layers

### Relationship Layer

Defines people, organizations, households, companies, members, contacts, accounts, and their relationships.

### Lifecycle Layer

Defines whether a record is new, qualified, active, inactive, churned, lost, enrolled, pending, in process, closed, renewed, escalated, or resolved.

### Work Layer

Defines tasks, calls, meetings, tickets, follow-ups, SLAs, queues, ownership, and next actions.

### Commercial Layer

Defines opportunities, deals, quotes, products, prices, subscriptions, orders, contracts, renewals, and revenue.

### Service Layer

Defines tickets, cases, issues, requests, escalations, support queues, service SLAs, resolutions, and customer satisfaction.

### Configuration Layer

Defines tenant-specific pipelines, fields, views, roles, teams, templates, automations, products, labels, and dashboards.

### Intelligence Layer

Defines scoring, routing, segmentation, forecasting, recommendations, alerts, anomalies, and AI assistance.

### Trust Layer

Defines permissions, audit logs, tenant isolation, retention, exports, privacy, compliance, and change history.

## Implementation Principle

Every CRM feature must be designed as a complete vertical slice.

Incomplete CRM feature examples:

- A form exists but does not save to the canonical table.
- A database column exists but no frontend reads it.
- An API returns data but ignores permissions.
- A status can be selected but has no transition rules.
- A report shows numbers that do not reconcile.
- A workflow sends notifications but does not record an audit event.
- An import creates records without dedupe/merge logic.

## CRM Quality Standard

A CRM module is production-grade only when it has:

- Clear object boundaries
- Canonical source of truth
- Valid state machine
- Permissions and visibility rules
- Audit trail
- Reporting definitions
- Import/export behavior
- Error handling
- Tests
- Admin configuration
- Documentation
