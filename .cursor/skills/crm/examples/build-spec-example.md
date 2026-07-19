# Build Spec Example: Team-Based Lead Views

## Objective

Allow admins to create teams such as Inside Sales and Outside Sales, assign users to teams, and let users view leads by team with reusable saved views.

## Correct CRM Objects

- users
- teams
- team_memberships
- leads
- lead_assignments or owner/team fields
- saved_views
- audit_logs

## Source of Truth

- Team membership lives in `team_memberships`.
- Lead owner lives in `leads.owner_id` or `lead_assignments` if assignment history is required.
- Lead team visibility derives from owner/team assignment rules, not frontend filters only.

## Required Features

- Admin can create/edit/archive teams.
- Admin can add/remove users from teams.
- Lead list can filter by team.
- Managers can see their team leads.
- Users can save custom views.
- Changes are audited.
- Tenant isolation applies to all team and lead records.

## Tests

- Add user to team and verify team view updates.
- Remove user from team and verify visibility changes.
- Tenant A team cannot access tenant B leads.
- Saved view persists after reload.
- Audit logs record team membership changes.
