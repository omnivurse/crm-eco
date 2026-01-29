# Self-Governing CRM Architecture

> **Status:** Saved for future consideration
> **Date:** January 2026

## Overview

A layered system that continuously prevents, detects, corrects, and audits data issues without relying on humans to notice.

---

## Building Blocks (in order of impact)

### 1. Data Quality Rules Engine (the "referee")

Create a first-class `data_quality_rules` system that runs on every write and on schedules.

**What it does:**
- Validates fields (format, required, allowed values)
- Validates relationships (a Deal must have an Account OR Contact, stage must belong to pipeline, etc.)
- Validates cross-record consistency (same email across multiple leads, mismatched state/zip, impossible dates)

**How it behaves:**
- **Hard stop** (block save) for critical rules
- **Soft stop** (save allowed) but creates a DQ Issue requiring follow-up
- **Auto-fix** for safe corrections (normalize phone, trim whitespace, casing, map "FLA→FL", etc.)

**Implementation:**
- DB constraints + triggers for "must never happen"
- Server-side Zod + rule engine for "business logic correctness"
- Scheduled runner for deep consistency checks

---

### 2. DQ Issues Table + Queue (visible governance)

Add a module: **Data Quality → Issues**

Each issue has:
- `entity_type` / `entity_id`
- `severity`: critical/high/medium/low
- `rule_key` + `message`
- `suggested_fix` (json patch)
- `status`: open/ignored/fixed
- `owner_user_id`, `due_date`
- Audit trail of changes

This turns "inconsistencies" into trackable work, not invisible rot.

---

### 3. "Two-Phase Writes" for Risky Changes

For changes that commonly introduce errors (deal stage jumps, member eligibility changes, billing processor edits):

- Stage changes become **proposed → validated → committed**
- High-risk edits can require approval (existing approvals module)
- Always write an `audit_event` + before/after diff

**Result:** The CRM prevents "silent corruption."

---

### 4. Automated Reconciliation Jobs (the "nightly accountant")

Run scheduled jobs that reconcile key domains:

- **Pipeline reconciliation:** stage vs expected close date vs probability
- **Billing reconciliation:** totals vs transactions vs invoices
- **Eligibility reconciliation:** member coverage vs eligibility file transfer status
- **Duplicates reconciliation:** fuzzy match leads/contacts/accounts weekly

These jobs produce DQ issues + summaries and optionally auto-fix safe cases.

---

### 5. Schema-level Guardrails (stop bad data at the door)

Use Postgres to enforce invariants:

- `CHECK` constraints (amount >= 0, dates not reversed)
- `NOT NULL` where truly required
- `UNIQUE` indexes (email per org, external IDs)
- Foreign keys + `ON DELETE` rules
- Generated columns for normalized search fields (`lower(email)`, `digits_only(phone)`)

This makes "bad states" impossible.

---

### 6. "Completeness Score" per record (like a credit score)

Compute a score (0–100) that reflects whether a Lead/Deal/Member record is usable.

**Example for a Lead:**
- +20 has email or phone
- +15 has source
- +15 has owner
- +20 has next_action task scheduled
- +30 has valid address (if needed)

**Expose it everywhere:**
- List views show score
- Dashboard shows "low completeness" buckets
- Automation: block exports to vendors unless score ≥ X

---

### 7. Anomaly Detection (catch "weird")

Add a lightweight anomaly detector:

- Sudden spike in declined payments
- A user editing 500 records in 2 minutes
- New leads missing sources suddenly
- Conversion rate shifts by 3σ week-over-week
- Unusual address patterns or repeated bank fields

These raise alerts + create issues + optionally rate-limit or require approval.

---

### 8. Golden Record + Conflict Resolution (source-of-truth enforcement)

Where multiple systems feed CRM (Zoho sync, member portal, imports):

- Define a **source priority per field** (e.g., billing address from billing system, phone from CRM unless verified by portal)
- Store field-level metadata: `last_source`, `last_verified_at`, `confidence`
- If two sources conflict, create a DQ issue instead of overwriting silently

---

### 9. Human-in-the-loop workflows (minimized)

Let humans handle only what machines can't:

- "Review queue" for critical issues
- Bulk fix UI (apply suggested patches to 50 items)
- Pattern-based rules authoring (admins can create rules without code)

---

### 10. Observability for Governance

Track governance KPIs:

- DQ issues opened vs resolved (by severity)
- Duplicate rate
- Completeness average per module
- Auto-fix rate
- Export failure rate
- "Time to clean" per issue type

Put this in a **Governance Dashboard**.

---

## Recommended Build Order

### Phase 1: Foundation
- `data_quality_rules` table + rule engine
- `data_quality_issues` table + basic UI
- Schema constraints on core tables

### Phase 2: Visibility
- Completeness score calculation
- DQ Issues queue page
- Dashboard widget showing health

### Phase 3: Automation
- Nightly reconciliation jobs
- Auto-fix for safe corrections
- Anomaly detection basics

### Phase 4: Advanced
- Golden record/field sources
- Two-phase writes for risky changes
- Full governance dashboard

---

## Domain Options

Choose which to govern first:

- **A) Leads/Deals/Pipeline** - Sales data quality (stage progression, required fields, duplicate detection)
- **B) Members/Billing/Eligibility** - Ops data quality (coverage validation, payment reconciliation)
- **C) Integrations/Imports** - Data entry quality (source tracking, conflict resolution, import validation)

---

## Notes

- Start permissive, tighten over time (avoid user rebellion)
- Watch for rule explosion - need deprecation strategy
- Consider async validation for non-critical rules (performance)
- Existing infrastructure supports this: Postgres/Supabase, modules system, approvals module, task system
