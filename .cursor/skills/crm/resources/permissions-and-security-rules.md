# Permissions and Security Rules

CRM permissions must protect customer records while allowing teams to operate efficiently.

## Permission Layers

### Tenant Membership

Can the user access this organization at all?

### Role

What general capabilities does the user have?

Examples:

- Owner
- Super Admin
- Admin
- Manager
- Sales Rep
- Support Rep
- Enrollment Specialist
- Advisor
- Read-only Analyst
- Billing User
- Auditor

### Team

Which records are visible through team ownership or assignment?

### Object Permissions

Can the user create, read, update, delete, export, import, merge, assign, or configure this object type?

### Record Permissions

Can the user access this specific record?

### Field Permissions

Can the user view or edit sensitive fields?

### Action Permissions

Can the user perform business actions such as convert lead, close deal, approve discount, cancel subscription, send email, export data, or impersonate user?

## Visibility Models

Common visibility options:

- Own records only
- Team records
- Role hierarchy
- Territory
- Queue
- All tenant records
- Specific object-level access
- Restricted/sensitive records

## Required Admin Controls

- Create/edit users
- Assign roles
- Assign teams
- Deactivate users
- Transfer ownership
- Audit permission changes
- Control export/import access
- Control automation editing
- Control integration credentials
- Control custom field/layout changes

## Sensitive Actions Requiring Audit

- Export data
- Bulk update/delete
- Merge records
- Change owner
- Change stage/status terminal state
- Change product/price/billing amount
- View restricted fields
- Impersonate user
- Modify RLS/permission config
- Connect/disconnect integration
- Run import
- Run migration/backfill

## Common Permission Failures

- Admin UI visible to all authenticated users.
- Manager can see all tenants instead of team records.
- API enforces permissions but reporting endpoint does not.
- Frontend hides button but endpoint allows action.
- Support role can edit billing without permission.
- Bulk export has no audit event.
- Custom fields ignore field-level permissions.

## Permission Test Matrix

For each module, test:

| Role | Create | Read Own | Read Team | Read All | Update | Delete | Export | Configure | Restricted Fields |
|---|---|---|---|---|---|---|---|---|---|

Also test:

- Tenant A user denied tenant B record.
- Deactivated user denied access.
- Role change takes effect immediately.
- Field-level restrictions apply in API and UI.
- Reports respect same visibility rules.
