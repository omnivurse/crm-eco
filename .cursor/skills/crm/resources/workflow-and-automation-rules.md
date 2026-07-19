# Workflow and Automation Rules

CRM workflows must be deterministic, auditable, permission-aware, tenant-scoped, and safe against loops.

## Workflow Components

Every workflow must define:

- Trigger
- Object type
- Conditions
- Actions
- Actor/system identity
- Idempotency key
- Failure behavior
- Retry behavior
- Audit log event
- Permission boundary
- Tenant context
- Stop conditions

## Common Trigger Types

- Record created
- Record updated
- Stage/status changed
- Owner changed
- Task due/overdue
- Form submitted
- Email opened/clicked/replied
- Call completed
- Ticket escalated
- SLA breached
- Payment failed
- Enrollment submitted
- Integration event received
- Import completed

## Common Action Types

- Create task
- Assign owner/team
- Send notification
- Send email/SMS
- Update field
- Create deal/ticket/enrollment
- Move pipeline stage
- Add to campaign
- Create audit event
- Call webhook
- Generate document
- Request approval

## State Machine Standard

For every pipeline or lifecycle, document:

| State | Meaning | Entry Criteria | Required Fields | Allowed Next States | Exit Automation | Terminal? |
|---|---|---|---|---|---|---|

Rules:

- Stages must be stored as IDs, not only labels.
- Labels can be tenant-customized; semantics must remain governed.
- Required fields must be enforced server-side, not only in the UI.
- Stage changes must generate audit events.
- Terminal states must be protected from accidental reactivation.

## Required Workflow Safety Checks

- Idempotency: Re-running the workflow should not duplicate tasks, emails, tickets, or enrollments.
- Loop prevention: Field updates from a workflow must not endlessly retrigger itself.
- Permission safety: Automation must not reveal records to unauthorized users.
- Tenant safety: Automation must never cross tenants unless explicitly system-level and audited.
- Data quality: Automation must not overwrite human-entered fields without clear precedence rules.
- Failure path: Errors must be visible to admins and retriable.
- Auditability: Every material workflow action must leave a trace.

## CRM Workflow Anti-Patterns

- Workflow logic hidden only in frontend code.
- Business process stored as magic strings.
- Multiple automations update the same status field with no priority.
- Email/SMS sent without suppression/consent rules.
- Tasks created repeatedly on every save.
- Stage required fields enforced only visually.
- Lost reason not required on closed-lost.
- Closed-won does not trigger downstream order/enrollment/subscription creation.
- Support escalation has no SLA clock.
- Import triggers full sales automations unintentionally.

## Builder Instructions

When asked to create a workflow, output:

1. Workflow name
2. Business purpose
3. Trigger
4. Conditions
5. Actions
6. State changes
7. Required fields
8. Idempotency strategy
9. Permissions
10. Tenant scope
11. Audit events
12. Error handling
13. Tests
14. Admin configuration
15. Rollback/disable plan
