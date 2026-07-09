# MembershipLifecycle

Facade for **CRM `crm_records`** coverage transitions (contacts/members modules):

| Transition | Entry |
|------------|--------|
| Active → Cancelled (scheduled end date) | `applyScheduledEndDateCancelForRecord` / `…ForRecordView` |
| Age-65 auto-cancel | `applyAge65AutoCancelForRecord` |
| Pending → Active (start date) | helpers from `resolve-effective-start-date` (used by activate-pending cron) |

## Not in this module

`apps/crm/src/app/api/cron/activate-due-memberships` updates the billing
`memberships` + `members` tables. That is a different seam — enrollment
completion provisions `pending` memberships; the cron flips them live.
Do not fold that into CRM record cancel/activate without a bridging design.
