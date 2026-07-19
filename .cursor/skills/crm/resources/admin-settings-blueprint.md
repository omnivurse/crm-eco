# Admin Settings Blueprint

A configurable CRM needs a strong admin/settings model.

## Settings Areas

### Organization Settings

- Name
- Logo/branding
- Timezone
- Fiscal year
- Business hours
- Currency
- Locale
- Domain/workspace settings

### Users and Teams

- Users
- Invitations
- Roles
- Teams
- Team membership
- Ownership transfer
- Deactivation

### Pipelines and Stages

- Pipeline name
- Object type
- Stage name
- Stage order
- Stage probability
- Required fields
- Allowed transitions
- Automation hooks
- Terminal states

### Fields and Layouts

- Custom fields
- Field sections
- Layouts by role/team/pipeline
- Required fields
- Field visibility
- Validation
- Picklist/options

### Products / Plans

- Product catalog
- Pricing
- Bundles/add-ons
- Eligibility
- Availability
- Effective dates

### Templates

- Email templates
- SMS templates
- Task templates
- Document templates
- Notification templates

### Automations

- Workflow rules
- Assignment rules
- SLA rules
- Notifications
- Approval processes
- Webhooks

### Integrations

- Email/calendar
- Forms
- Telephony/SMS
- Billing
- External CRM connectors
- Webhooks/API keys

### Reports and Views

- Saved views
- Dashboards
- Report definitions
- Metrics
- Sharing/permissions

### Audit and Security

- Login history
- Export history
- Permission changes
- Automation changes
- Integration changes
- Bulk updates

## Settings Anti-Patterns

- Settings screen updates a table but frontend uses hard-coded values.
- Options are stored in code arrays.
- Required fields exist only in UI.
- Custom field definitions have no data type enforcement.
- Tenant admins can break global schema.
- Changes are not audited.

## Settings Test

For any configurable item:

1. Admin changes setting.
2. User UI reflects setting.
3. API validates against setting.
4. Reports still reconcile.
5. Permission model still applies.
6. Audit event records setting change.
