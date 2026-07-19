# CRM Module Blueprints

Use these blueprints to design or audit CRM modules.

## 1. Today / Command Center

Purpose: Give each user a prioritized daily operating view.

Must include:

- My tasks due today
- Overdue tasks
- New assigned leads
- Pipeline changes
- Urgent tickets/cases
- SLA risk
- Recent activity
- Notifications
- Quick actions
- Saved views

Common failures:

- Dashboard reads stale or derived data only.
- No permission filtering.
- No tenant scoping.
- No real next-action logic.

## 2. Leads

Purpose: Capture, qualify, route, nurture, and convert prospects.

Must include:

- Lead source
- Status/lifecycle
- Qualification fields
- Owner/team
- Contact info
- Timeline
- Tasks
- Score/priority
- Conversion action
- Duplicate detection

Essential workflows:

- New lead intake
- Auto-assignment/routing
- Speed-to-lead SLA
- Qualification
- Disqualification
- Conversion to contact/account/deal/enrollment
- Recycle/nurture

Common failures:

- Lead becomes permanent customer record.
- Conversion creates duplicate contacts.
- Status values overlap with deal stages.
- Source data is lost after conversion.

## 3. Contacts / People

Purpose: Maintain trusted person records.

Must include:

- Identity fields
- Communication preferences
- Relationships to account/household/deals/tickets/enrollments
- Timeline
- Consent/preferences where needed
- Dedupe/merge
- Owner or relationship manager when applicable

Common failures:

- Duplicate contacts per module.
- Person data stored separately in leads, members, dependents, and tickets without synchronization rules.
- Email/phone updates save to one record but display from another.

## 4. Accounts / Companies / Groups

Purpose: Maintain organization-level relationships.

Must include:

- Company/group profile
- Related contacts
- Opportunities/deals
- Contracts/subscriptions/enrollments
- Tickets/cases
- Notes/activity
- Owner/team
- Hierarchy/parent account where applicable

Common failures:

- Account and organization tables compete.
- Group-level billing is mixed into contact-level fields.
- Ownership is not inherited or clearly overridden.

## 5. Deals / Opportunities

Purpose: Track revenue or conversion opportunities.

Must include:

- Pipeline
- Stage
- Amount/value
- Close date
- Probability/forecast category
- Products/line items
- Contacts/account
- Owner/team
- Next step
- Lost reason
- Activity history

Essential workflows:

- Create opportunity
- Advance stage
- Require fields by stage
- Generate quote
- Close won/lost
- Convert to order/subscription/enrollment
- Forecast/report

Common failures:

- Stage is free text.
- Amount is stored inconsistently.
- Closed-won does not create downstream fulfillment object.
- Forecasts are based on stale or manually edited values.

## 6. Products / Plans / Services

Purpose: Define what can be sold, enrolled, quoted, or subscribed to.

Must include:

- Product catalog
- Active/inactive status
- Pricing model
- Eligibility rules
- Availability by tenant/market
- Versioning/effective dates
- Bundles/add-ons

Common failures:

- Product names hard-coded in frontend.
- Plan pricing stored on contact records only.
- No effective-date versioning.
- Reporting cannot distinguish product sold vs product active.

## 7. Quotes / Proposals

Purpose: Generate a proposed offer before acceptance.

Must include:

- Quote version
- Products/line items
- Pricing
- Discounts
- Expiration
- Approval state
- Generated document
- Acceptance event

Common failures:

- Quote overwrites deal amount without history.
- PDFs generated without immutable version record.
- No approval workflow for discounting.

## 8. Orders / Enrollments / Subscriptions

Purpose: Represent accepted, active, pending, cancelled, or renewed service relationships.

Must include:

- Effective date
- Status
- Product/plan
- Billing relationship
- Member/customer/contact/account links
- Dependents/covered people where applicable
- Documents
- Activation/fulfillment steps
- Cancellation/renewal logic

Common failures:

- Enrollment status is stored on contact only.
- Billing date lives in a separate module with no lineage.
- Dependents are not modeled as relationships.
- Active customer view reads stale deal data.

## 9. Tickets / Cases / Service

Purpose: Track customer issues, service requests, escalations, and resolutions.

Must include:

- Status
- Priority
- Category
- SLA
- Owner/team/queue
- Requester/contact/account
- Communication thread
- Resolution
- Escalation path

Common failures:

- Tickets do not link to customer timeline.
- Support team can see cross-tenant data.
- Status changes do not record audit events.
- No SLA or priority rules.

## 10. Activities / Timeline

Purpose: Provide a full history of interactions and system events.

Must include:

- Calls
- Emails
- SMS
- Meetings
- Notes
- Tasks
- Status changes
- Owner changes
- Automation events
- File/document events

Rules:

- Timeline should be append-only where possible.
- Sensitive or restricted details should not be overexposed.
- Activities must be linked to relevant objects.

## 11. Campaigns / Marketing

Purpose: Manage outreach, attribution, segmentation, and campaign performance.

Must include:

- Campaign metadata
- Audience membership
- Source attribution
- Email/SMS engagement
- Lead/deal influence
- Suppression and consent rules

Common failures:

- Campaign source is stored only as text on lead.
- No attribution after conversion.
- Unsubscribe/consent is ignored by automations.

## 12. Reports / Dashboards

Purpose: Make CRM data trustworthy for operations and leadership.

Must include:

- Pipeline reports
- Conversion reports
- Source reports
- Activity reports
- Forecasts
- SLA/service reports
- User/team performance
- Data quality reports
- Audit/security reports

Common failures:

- Reports are built from frontend labels.
- Closed-won does not reconcile with orders/enrollments.
- Counts differ by module because of duplicate status fields.

## 13. Admin / Settings

Purpose: Configure the CRM without code changes.

Must include:

- Users
- Teams
- Roles
- Pipelines
- Stages
- Custom fields
- Layouts
- Views
- Products/plans
- Templates
- Automations
- Integrations
- Import/export
- Audit logs

Common failures:

- Settings exist but frontend ignores them.
- Hard-coded options remain in forms.
- No permission to restrict who can edit configuration.

## 14. Integrations

Purpose: Connect CRM to forms, email, calendar, telephony, billing, docs, external CRMs, analytics, and AI.

Must include:

- Connection registry
- Credential storage
- External ID mapping
- Sync direction
- Conflict rules
- Webhook verification
- Retry/dead-letter queue
- Sync audit logs

Common failures:

- External IDs stored inconsistently.
- Sync jobs bypass tenant policies.
- Import overwrites canonical data without conflict review.
