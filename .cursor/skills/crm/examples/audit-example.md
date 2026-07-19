# Audit Example

## Scenario

The CRM has an `In Process` status and a start date visible on one screen, but the report query returns zero contacts with `status = In Process` and a start date.

## Correct Audit Reasoning

Do not assume the report is wrong. Investigate source-of-truth mismatch.

Possible causes:

- The visible date is stored on an enrollment/application record, not contact.
- The visible status is a pipeline stage, not contact status.
- The report filters `contacts.status` but the UI reads `enrollments.status`.
- The date field is named differently across modules.
- RLS prevents the report query from seeing related records.
- The frontend joins data client-side but the report query does not.

## Required Output

| Concept | UI Source | Report Source | Canonical Source | Issue | Fix |
|---|---|---|---|---|---|
| In Process status | enrollments.status | contacts.status | enrollments.status for enrollment pipeline | Report filters wrong object | Update report to join enrollment status or add documented projection |
| Start date | enrollments.effective_date | contacts.start_date | enrollments.effective_date | Date stranded from report perspective | Use canonical enrollment date in report |

## Safe Fix

1. Confirm all references read-only.
2. Decide canonical object.
3. Update report/query to use canonical object.
4. Add tests proving UI count and report count reconcile.
5. Only consider backfill/projection if multiple screens require contact-level summary.
