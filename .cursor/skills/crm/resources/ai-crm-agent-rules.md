# AI CRM Agent Rules

AI inside a CRM must be assistive, permission-aware, auditable, and grounded in trusted CRM data.

## AI Use Cases

- Summarize contact/account/deal/ticket history.
- Draft emails or SMS messages.
- Recommend next best action.
- Score leads or prioritize queues.
- Detect stale pipeline records.
- Identify duplicate records.
- Summarize calls/notes.
- Generate reports or insights.
- Assist admin configuration.
- Answer questions over CRM data.

## AI Safety Rules

- AI may only access records the user is authorized to access.
- AI summaries must cite or reference underlying CRM records where possible.
- AI must not invent CRM facts.
- AI-suggested actions must be reviewable before execution.
- Sending emails/SMS, bulk updates, merges, deletions, exports, or stage changes require confirmation unless explicitly designed as safe automation.
- AI outputs that affect records must be audit-logged.
- AI memory or embeddings must be tenant-isolated.
- Sensitive fields must be redacted or permission-gated.
- Prompts must not leak secrets, tokens, or cross-tenant data.

## AI Agent Action Classes

### Read-Only

Examples: summarize account, list overdue tasks, explain pipeline risk.

### Draft-Only

Examples: draft email, draft task plan, draft report.

### Confirm-Gated Write

Examples: send email, update stage, assign owner, create ticket, merge duplicate.

### Admin-Gated Write

Examples: modify workflow, change permissions, bulk import/export, create custom fields.

## CRM AI Anti-Patterns

- AI query bypasses RLS.
- Vector index mixes tenants.
- AI suggests changing records but no audit event is written.
- AI sends customer communication without review.
- AI uses stale report data without warning.
- AI generates fields that do not exist in schema.
- AI summarizes sensitive fields to unauthorized users.

## AI Feature Audit Prompt

```text
Audit this CRM AI feature. Verify authorization, tenant isolation, data grounding, prompt safety, redaction, action gating, audit logging, hallucination controls, stale-data warnings, vector/RAG isolation, and tests. Do not approve any AI write action without confirmation gates and audit events.
```
