# Canonical CRM Domain Model

Use this model as the baseline for CRM design and audit. Rename labels per tenant if needed, but preserve object boundaries.

## Identity and Tenant Objects

### Organization / Tenant

Represents a customer account in a SaaS CRM. Owns users, configuration, records, pipelines, fields, templates, reports, and integrations.

Required fields:

- id
- name
- slug
- status
- plan/tier
- timezone
- locale
- created_at
- updated_at

### User

Represents a login identity.

Required fields:

- id
- organization_id where tenant-scoped
- email
- name
- status
- last_login_at
- created_at
- updated_at

### Team

Represents a group such as Inside Sales, Outside Sales, Support, Enrollment, Customer Success, Advisors, or Admins.

### Role / Permission Set

Defines what a user can do. Roles are business-facing. Permission sets are system-facing.

## Core Relationship Objects

### Lead

A person or organization that has not yet been qualified or converted into the canonical customer/contact/account model.

Use a Lead when:

- The data is unqualified.
- Ownership and follow-up are needed.
- Conversion may create contact/account/deal/enrollment records.

Do not use Lead as a permanent customer record.

### Contact

A known person. Contacts may relate to accounts, households, companies, opportunities, tickets, enrollments, or subscriptions.

Required considerations:

- Email/phone uniqueness may be tenant-specific.
- A contact can have multiple relationships.
- Do not duplicate contacts for each pipeline unless there is a strong reason.

### Account / Company / Organization Entity

The business or group entity associated with contacts, deals, service, billing, contracts, memberships, or hierarchy.

For B2B CRMs, Account/Company is usually central.
For B2C CRMs, Contact or Household may be central.
For healthcare/enrollment CRMs, Member/Household/Group may be central.

### Household

A group of people related for family, coverage, membership, or billing purposes.

Use when dependent, spouse, family, or shared billing relationships matter.

## Commercial Objects

### Deal / Opportunity

A revenue or conversion opportunity.

Required fields:

- pipeline_id
- stage_id
- amount/value
- close_date
- probability or forecast category
- owner_id
- account/contact relationship
- source
- status

### Product / Plan

A sellable offering.

### Price / Rate

Price should be separate from product when prices vary by tenant, market, date, age, seat count, discount, or billing cadence.

### Quote / Proposal

A proposed commercial configuration before acceptance.

### Order / Enrollment / Subscription

Represents the accepted or active relationship after sale/conversion.

For enrollment systems, avoid treating an enrollment as merely a deal stage. It may require its own lifecycle, eligibility rules, effective dates, dependents, billing, documents, and fulfillment.

## Service Objects

### Ticket / Case

A support or operations request.

Required fields:

- subject
- description
- requester/contact
- owner/team
- status
- priority
- category
- SLA dates
- resolution
- closed_at

### Task

A to-do item assigned to a user, team, or queue.

### Activity

A historical interaction such as call, email, meeting, SMS, note, system event, or timeline item.

Activities should be append-only where possible.

## Configuration Objects

### Pipeline

A configurable process such as Sales Pipeline, Enrollment Pipeline, Support Pipeline, Renewal Pipeline, Implementation Pipeline, or Onboarding Pipeline.

### Stage

A state inside a pipeline. Must define ordering, probability, required fields, allowed transitions, and terminal behavior.

### Custom Field Definition

Defines tenant-specific fields without requiring schema changes.

Required fields:

- organization_id
- object_type
- field_key
- label
- data_type
- required
- options
- validation
- visibility
- reporting_enabled

### Custom Field Value

Stores values for custom field definitions. Must be tenant-scoped and object-scoped.

### View / Saved Filter

Defines list views, kanban boards, table layouts, filters, and sorting.

### Template

Defines email, SMS, task, document, or notification templates.

### Automation Rule

Defines trigger, condition, action, safety limits, and audit behavior.

## System Objects

### Audit Log

Immutable record of meaningful changes.

Must include:

- actor_id
- organization_id
- object_type
- object_id
- action
- before/after where safe
- timestamp
- request/session metadata

### Integration Connection

Represents a connection to Salesforce, Zoho, HubSpot, email, calendar, telephony, billing, forms, or external system.

### Sync State

Tracks cursor, external IDs, last sync time, direction, and conflict behavior.

### Import Batch

Tracks imported records, file metadata, mappings, errors, dedupe results, and rollback/merge state.

## Relationship Patterns

Use join tables when relationships are many-to-many:

- contacts_accounts
- contacts_households
- deals_contacts
- tickets_contacts
- campaigns_contacts
- users_teams
- records_tags
- records_files
- products_pricebooks

Do not force many-to-many relationships into comma-separated fields or JSON arrays unless the field is purely denormalized cache.

## Source-of-Truth Decision Matrix

| Concept | Canonical Location | Notes |
|---|---|---|
| Person identity | contacts | Leads convert into contacts when qualified. |
| Company/group identity | accounts/companies | Use tenant label customization if called Employer, Group, Client, etc. |
| Revenue pipeline | deals/opportunities | Do not overload contact status. |
| Support status | tickets/cases | Do not use deal stage for support. |
| Membership/enrollment | enrollments/subscriptions | Separate from deal when activation/eligibility/billing matter. |
| User ownership | owner_id plus team assignment | Use assignment history for changes. |
| Customer interactions | activities/timeline | Append-only preferred. |
| Custom tenant fields | custom_field_definitions/values | Avoid uncontrolled schema sprawl. |
| Reports | analytics views/materialized views | Must reconcile to source tables. |
