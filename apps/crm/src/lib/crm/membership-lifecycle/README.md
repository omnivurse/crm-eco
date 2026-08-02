# MembershipLifecycle

Facade for **CRM `crm_records`** coverage transitions (contacts/members modules):

| Transition | Entry |
|------------|--------|
| Active → Cancelled (scheduled end date) | `applyScheduledEndDateCancelForRecord` / `…ForRecordView` |
| Age-65 auto-cancel | `applyAge65AutoCancelForRecord` |
| Pending → Active (start date) | `isActivationDue` / `applyPendingActivationForRecord` (from `pending-activation`) |

## Coordinating CRM + billing

`@/lib/crm/member-activation` exposes one coordinator interface:

- `activateCrmRecordsDue` — CRM `crm_records` Pending → Active
- `activateBillingDue` — billing `memberships` + `members` pending → active
- `activateAllDue` — ops convenience (cron schedules stay separate)

Billing `memberships` remain a **different adapter**. Do not merge table paths
without an explicit design; enrollment completion provisions `pending`
memberships and `activate-due-memberships` flips them live.
