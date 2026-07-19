# Import, Deduping, and Data Quality

Imports are one of the fastest ways to corrupt a CRM. Treat every import as a controlled data migration.

## Import Pipeline

1. Upload file
2. Virus/type/size validation where applicable
3. Create import batch
4. Parse file
5. Map columns
6. Validate rows
7. Normalize values
8. Detect duplicates
9. Preview changes
10. Approve import
11. Apply in transaction/batches
12. Record row outcomes
13. Trigger limited safe workflows
14. Produce import report
15. Allow rollback or merge review where possible

## Dedupe Keys

Potential identifiers:

- Email
- Phone
- External ID
- Member/customer ID
- Company domain
- Account number
- Name + DOB where appropriate and compliant
- Address combinations
- Tenant-specific IDs

Never use global email uniqueness across tenants unless explicitly required.

## Duplicate Classes

- Exact duplicate
- Probable duplicate
- Same person, different account relationship
- Same account, different branch/location
- Same household member
- External sync duplicate
- Legacy duplicate requiring manual merge

## Merge Rules

Define precedence:

- Human-verified data beats imported data.
- More recent verified value may win.
- External system of record may win for specific fields.
- Do not overwrite non-empty fields blindly.
- Preserve activity history.
- Preserve source attribution.
- Preserve audit trail.

## Import Safety Rules

- Imports must be tenant-scoped.
- Imports must not trigger every automation by default.
- Bulk creates/updates must be audited.
- Failed rows must be inspectable.
- Mappings must be saved by tenant if reusable.
- External IDs must be unique by tenant and integration.
- Import preview must show create/update/skip/error counts.

## Data Quality Dashboard

Track:

- Duplicate contacts/accounts
- Records missing owner
- Records missing required fields
- Records stuck in stage beyond SLA
- Invalid emails/phones
- Orphaned activities
- Failed webhooks
- Failed imports
- Unmapped custom fields
- Unknown statuses

## Import Audit Prompt

```text
Audit the import system. Verify file parsing, column mapping, validation, dedupe keys, tenant scoping, preview, approval gate, row-level outcomes, rollback/merge behavior, workflow suppression, audit logs, and report reconciliation. Identify how imports could create duplicate contacts/accounts or write fields to the wrong module.
```
