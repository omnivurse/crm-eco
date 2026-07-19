# Integrations and Sync Rules

CRM integrations must preserve identity, tenant scope, conflict rules, and auditability.

## Integration Objects

Recommended records:

- `integration_connections`
- `integration_credentials`
- `external_object_mappings`
- `external_field_mappings`
- `sync_runs`
- `sync_events`
- `sync_errors`
- `webhook_events`

## External CRM Connector Pattern

When syncing with Salesforce, Zoho, HubSpot, Microsoft Dynamics, Pipedrive, or another CRM:

1. Define object mapping.
2. Define field mapping.
3. Define direction: inbound, outbound, bidirectional.
4. Define source-of-truth per field.
5. Define conflict resolution.
6. Store external IDs per tenant/system/object.
7. Use idempotency keys for webhooks.
8. Verify webhook signatures where available.
9. Rate-limit and retry safely.
10. Record sync run outcomes.
11. Surface failed syncs to admins.
12. Never bypass tenant permissions.

## Sync Direction Models

### One-Way Inbound

External system feeds CRM. CRM should not overwrite external data.

### One-Way Outbound

CRM sends selected changes to external system.

### Bidirectional

Requires field-level source-of-truth rules and conflict handling.

## Conflict Resolution

Options:

- CRM wins
- External system wins
- Last-write wins
- Human review
- Field-level policy
- System-specific policy

Do not use last-write-wins for critical business fields unless explicitly accepted.

## Webhook Rules

- Verify signature/token.
- Resolve tenant safely.
- Store raw event metadata where safe.
- Process idempotently.
- Retry with backoff.
- Dead-letter repeated failures.
- Do not expose secrets in logs.

## Connector Anti-Patterns

- External IDs stored in core object fields without source/system.
- Bidirectional sync with no conflict policy.
- Webhook writes records without tenant validation.
- Integration secrets stored in plaintext.
- Sync errors only visible in server logs.
- Field mappings hard-coded per customer.
- Automation fires repeatedly during sync replay.

## Connector Build Output

When designing a connector, include:

- Supported objects
- Field mapping table
- Sync direction
- Auth method
- Tenant resolution
- External ID strategy
- Webhook strategy
- Rate limit strategy
- Retry/error handling
- Conflict rules
- Admin UI
- Audit logs
- Tests
