# Sales, Service, and Enrollment CRM Patterns

Use this file when designing vertical CRMs that combine sales, operations, support, enrollment, or membership workflows.

## Sales CRM Pattern

Lead → Qualification → Opportunity/Deal → Quote → Closed Won/Lost → Order/Subscription/Enrollment → Renewal/Upsell

Required source-of-truth separation:

- Lead qualification belongs to lead/contact lifecycle.
- Commercial intent belongs to deal/opportunity.
- Accepted commercial relationship belongs to order/subscription/enrollment.
- Product catalog belongs to products/plans.
- Billing belongs to billing/subscription objects.

## Service CRM Pattern

Customer/Member/Contact → Ticket/Case → Triage → Work Queue → Resolution → Satisfaction/Follow-up

Required source-of-truth separation:

- Customer identity belongs to contact/account/member.
- Service request belongs to ticket/case.
- Work tracking belongs to tasks/activities.
- SLA belongs to ticket/case.
- Communications belong to activity/conversation timeline.

## Enrollment CRM Pattern

Prospect/Lead → Applicant/Contact → Application/Enrollment → Eligibility Review → Product Selection → Billing Setup → Activation → Active Member/Customer → Renewal/Cancellation

Required source-of-truth separation:

- Person identity belongs to contact/member profile.
- Enrollment process belongs to enrollment/application.
- Coverage/product state belongs to enrollment/subscription/product relationship.
- Dependents belong to person relationships or enrollment members.
- Billing state belongs to billing/subscription/payment records.

## Hybrid CRM Warning

Do not collapse sales, enrollment, service, and billing into a single `status` field. Use separate lifecycles and link them.

Example:

- Contact lifecycle: New, Qualified, Customer, Former Customer
- Deal stage: Prospecting, Proposal, Negotiation, Closed Won, Closed Lost
- Enrollment status: Draft, Submitted, In Review, Approved, Active, Cancelled
- Ticket status: New, Open, Waiting, Escalated, Resolved, Closed
- Billing status: Trialing, Active, Past Due, Failed, Cancelled

Each status answers a different business question.
