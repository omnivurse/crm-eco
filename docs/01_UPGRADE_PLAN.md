# CRM-Eco Upgrade Plan — Match SaudeMax Production Functionality

**Reference project:** `/Users/qloudagent/Desktop/Desktop/APPLICATIONS/saudemax-admin-system` (React + Vite + Supabase, production-tested)
**Target project:** `/Users/qloudagent/Documents/GitHub/crm-eco` (Next.js App Router monorepo, **in production**)
**Hard rule across every prompt:** NO DATA LOSS. The CRM-Eco database is live. All work is **additive**.

---

## Critical guardrails — paste at the top of every Cursor session

```
HARD RULES — DO NOT VIOLATE:
1. The CRM-Eco database is in PRODUCTION. No data loss is acceptable.
2. Migrations must be ADDITIVE only:
   - CREATE TABLE IF NOT EXISTS
   - ALTER TABLE … ADD COLUMN IF NOT EXISTS
   - CREATE INDEX IF NOT EXISTS
   - CREATE OR REPLACE FUNCTION / TRIGGER (idempotent)
   - NEVER use DROP TABLE, DROP COLUMN, TRUNCATE, or destructive ALTERs.
   - If a column type must change, do a 3-step expand-migrate-contract: add new col, backfill, switch readers/writers, leave the old col with a deprecation comment. Do not drop in the same PR.
3. Every new table MUST:
   - have organization_id uuid NOT NULL referencing organizations(id)
   - enable RLS
   - have policies using helper functions get_user_organization_id() / get_user_role() / get_user_advisor_id() (already exist — search migrations for examples)
4. Tenant scope: PIFH org_id = ac6e7228-… (already in memory). Test data must respect org isolation.
5. Latest existing migration is 202605200001_… — new migrations start at 202605210001 and increment.
6. Two separate databases between saudemax and crm-eco — DO NOT attempt cross-DB queries. Use the saudemax repo only as a STRUCTURAL reference.
7. Before any destructive-looking SQL or shell command, STOP and ask.
8. When in doubt about an existing table's schema, run `\d table_name` mentally (read the migration file) before adding columns.
9. App: Next.js 15 App Router, React 19, Supabase, Authorize.Net primary / Stripe adapter present. Do NOT switch primary processor without approval.
10. After any DB change, regenerate `packages/lib/src/types/database.ts` and run `tsc --noEmit` in each affected app.
```

---

## What CRM-Eco already has (no rebuild needed)

| Domain | Existing assets |
|---|---|
| Enrollment | `enrollments`, `enrollment_steps`, `enrollment_audit_log`, `plans`, `memberships`, `dependents`, `enrollment_links*` tables; `packages/enrollment/src/components/SelfServe*Step.tsx`; `apps/crm/src/components/enrollment/{steps,wizard}`; `apps/portal/src/app/enroll/[slug]/`; `apps/crm/src/lib/sequences/enrollment-service.ts` (email sequences only — not the domain service) |
| Billing | `billing_schedules`, `billing_transactions`, `billing_failures`, `payment_profiles`, `invoices`; `packages/lib/src/billing/billing-service.ts` (BillingService class w/ Authorize.Net); `packages/lib/src/billing/authorize-net.ts`; `supabase/functions/process-billing/`, `supabase/functions/process-payment/` |
| Commissions | `agent_levels`, `commission_rates`, `commissions`, `commission_adjustments`, `advisor_commission_summary`, `commission_payment_batches`, `commission_ledger`, `payout_item_ledger_links`; `packages/lib/src/commissions/{commission-service.ts, payout-compliance.ts}`; admin pages under `apps/admin/src/app/(dashboard)/commissions/`; payout providers in `apps/crm/src/lib/payouts/providers/{stripe-connect,ach,manual}.ts` |

## Schema reality — column names that diverge from the saudemax reference

These were verified against `supabase/migrations/`. Cursor must use the LEFT column, not the saudemax name on the right.

| Use this (crm-eco) | NOT this (saudemax) | Notes |
|---|---|---|
| `enrollments.base_monthly_cost` | `enrollments.monthly_cost` | Canonical cost on the enrollment. Triggers and services reference this. |
| `memberships.billing_amount` | — | The recurring-charge source of truth once an enrollment is approved and a membership exists. Long-term, billing schedules should derive from this. |
| `enrollments.end_date` | `enrollments.inactive_date` | Already exists — set when an enrollment is cancelled/terminated. |
| `enrollments.status='approved'` | `enrollments.status='Active'` | Status enum is lowercase: `draft / in_progress / submitted / approved / rejected / cancelled`. Treat `approved` as saudemax's `Active`. |
| `enrollments.primary_member_id` (uuid → members.id) | `member_id` (text, e.g. "MPB001") | crm-eco uses a uuid `members` table. |
| `enrollments.advisor_id` (uuid → advisors.id) | `agent_id` (int) | Advisors use uuid PKs. |
| `enrollments.permanent_bill_day` | `billing_day` | Day-of-month for recurring charges. |
| `enrollments.enrollment_source` + `enrollments.channel` | `enrollments.source` | Use the existing two columns; do not add `source`. |
| `enrollments.agreed_to_terms/_privacy/_guidelines` + `*_agreed_at` | (saudemax has no click-through bools) | Click-through acceptance is already tracked. The new `agreement_signatures` table is for the PDF + drawn-signature layer on top — both coexist. |
| `dependents` (existing table, has its own `status` column) | `dependents` master + `enrollment_dependents` link | crm-eco already has `dependents`. We still need `enrollment_dependents` as the **link table** between `enrollments` and `dependents` with per-link `status` / `inactive_reason`. |

**Already-present columns on `enrollments` (do NOT re-add in Prompt 1):**
- `initial_payment_paid`, `initial_payment_amount`, `initial_payment_date`, `initial_transaction_id`
- `primary_is_smoker`, `primary_tobacco_date`
- `first_billing_date`, `next_billing_date`, `permanent_bill_day`
- `end_date`, `enrollment_date`
- `annual_fee`, `administration_fee`, `association_fee`, `iua_fee`, `product_fee`, `monthly_contribution_fee`
- `hold_date`, `hold_reason`, `hold_return_date`, `hold_amount`
- `refund_requested`, `refund_requested_date`, `refund_provided`, `refund_provided_date`
- `agreed_to_terms/_privacy/_guidelines` (+ timestamps)
- `pricing_matrix_id`, `benefit_type_id`, `iua_id`, `plan_type`, `product_id`
- `advisor_first_name/_last_name/_email/_level` (snapshot copies)

## What is MISSING vs SaudeMax (the gap)

### Enrollment gaps
- `enrollment_dependents` table with per-dependent status + inactive_reason
- `agreement_signatures` table + signature pad component + contract-PDF edge function
- `legal_documents` table for templated contracts
- Standardized `inactive_reasons` enum/lookup
- Plan-change service (inactivate old enrollment + create new + pro-rata difference billing for post-20th changes)
- Auto-trigger to create billing schedule when enrollment becomes Active
- Auto-trigger to create signup commission when enrollment activates
- "Billing date = 20th of month BEFORE start date" date math helper
- Public enrollment landing page wired to agent codes (route exists; logic missing)

### Billing gaps
- `billing_automation_config` (singleton config) + `billing_job_runs` (run log)
- Cron-scheduled charge sweep with: batch size, rate limit, circuit breaker, idempotency keys
- Failed-payment retry processor consuming `billing_failures.next_retry_date`
- Dunning email sequence (attempt 1/2/3/abandoned)
- Trigger `sync_billing_schedule_on_enrollment_update` (when `enrollments.base_monthly_cost` changes, all active monthly schedules auto-update)
- Trigger to cancel future billing on `enrollments.status → Inactive/Cancelled`
- `price_change_schedules` + `price_change_audit` tables + scheduler
- Authorize.Net webhook handler (`payment.auth`/`capture`/`void`/`refund`)
- Admin "Declined Today" view + "Billing Sync Check" page

### Commissions gaps
- DB trigger to insert signup commission on enrollment INSERT
- Monthly commission accrual cron (currently calculate exists but no scheduler)
- Auto-override commissions via `generateOverrides()` invoked from the same accrual job
- Trigger to mark commissions `cancelled` on enrollment cancel
- Tier recalculation on member-count change (using `get_advisor_downline_count`)
- Commission payout UI flow (preview → approve → process → reconcile)
- Agent portal: own commissions + downline override breakdown
- Adjustment workflow UI (uses existing `commission_adjustments` table)

---

# CURSOR PROMPT SERIES

Execute these in order. Each prompt is self-contained — copy the whole block into Cursor's composer. After each prompt finishes: review the diff, run `pnpm typecheck` or `npm run typecheck` in the affected app, then commit before moving on.

---

## PROMPT 1 — Schema additions (additive migration)

```
You are working on /Users/qloudagent/Documents/GitHub/crm-eco — a PRODUCTION Supabase database. NO DATA LOSS allowed.

Create a new migration file at supabase/migrations/202605210001_enrollment_billing_commission_gaps.sql.

Rules:
- Only additive DDL. CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
- Every new table must have organization_id uuid NOT NULL REFERENCES organizations(id), enable RLS, and add SELECT/INSERT/UPDATE/DELETE policies using get_user_organization_id().
- Do not modify existing tables' columns except via ADD COLUMN IF NOT EXISTS.

Add the following:

1. Table: enrollment_dependents (LINK table — joins existing enrollments to existing dependents)
   - id uuid PK default gen_random_uuid()
   - organization_id uuid NOT NULL
   - enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE
   - dependent_id uuid NOT NULL REFERENCES dependents(id) ON DELETE RESTRICT
   - relationship text NOT NULL CHECK (relationship IN ('spouse','child','domestic_partner','other'))
   - status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
   - inactive_date date
   - inactive_reason text REFERENCES inactive_reasons(code)
   - custom_fields jsonb DEFAULT '{}'::jsonb
   - created_at timestamptz default now(), updated_at timestamptz default now()
   - unique (enrollment_id, dependent_id) — a given dependent appears once per enrollment
   - indexes: (organization_id), (enrollment_id), (dependent_id), (status)
   - NOTE: `dependents` table already exists with name/dob/etc. Don't duplicate those columns here. Per-link inactive_reason is intentional — saudemax tracks "remove child 1" / "remove spouse" granularly.

2. Table: legal_documents
   - id uuid PK
   - organization_id uuid NOT NULL
   - document_type text NOT NULL (e.g. 'enrollment_agreement','membership_terms','compliance_disclosure')
   - document_name text NOT NULL
   - product_id uuid REFERENCES plans(id) (nullable; null = applies to all)
   - content_html text NOT NULL  -- mustache-style {{member_name}} placeholders
   - version int NOT NULL DEFAULT 1
   - status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived'))
   - effective_date date
   - created_by uuid REFERENCES profiles(id)
   - created_at, updated_at
   - unique (organization_id, document_type, version)

3. Table: agreement_signatures
   - id uuid PK
   - organization_id uuid NOT NULL
   - enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE
   - legal_document_id uuid REFERENCES legal_documents(id)
   - agreement_type text NOT NULL
   - signature_png text  -- base64 PNG
   - signer_name text NOT NULL
   - signer_ip inet
   - signer_user_agent text
   - signed_at timestamptz NOT NULL DEFAULT now()
   - pdf_storage_path text  -- supabase storage path
   - pdf_generated_at timestamptz
   - metadata jsonb DEFAULT '{}'
   - indexes: (enrollment_id), (organization_id)

4. Table: inactive_reasons (lookup, seeded)
   - code text PK
   - description text NOT NULL
   - category text CHECK (category IN ('plan_change','cancellation','non_payment','admin','age_out','other'))
   - Seed with: plan_change_add_spouse, plan_change_remove_spouse, plan_change_add_child, plan_change_remove_child, plan_change_add_family, plan_change_to_member_only, plan_change_iua, plan_change, member_requested_cancellation, non_payment, age_out, admin_cancellation, expired_payment_method
   - This table is GLOBAL (not org-scoped) — RLS with read-all-authenticated policy.

5. Table: billing_automation_config (singleton per org)
   - id uuid PK
   - organization_id uuid NOT NULL UNIQUE
   - enabled boolean NOT NULL DEFAULT false
   - charge_day_of_month int NOT NULL DEFAULT 20 CHECK (charge_day_of_month BETWEEN 1 AND 28)
   - charge_hour_utc int NOT NULL DEFAULT 14 CHECK (charge_hour_utc BETWEEN 0 AND 23)
   - batch_size int NOT NULL DEFAULT 10
   - rate_limit_ms int NOT NULL DEFAULT 500
   - max_retries int NOT NULL DEFAULT 3
   - circuit_breaker_threshold int NOT NULL DEFAULT 5
   - last_run_date date
   - last_run_at timestamptz
   - updated_at timestamptz

6. Table: billing_job_runs
   - id uuid PK
   - organization_id uuid NOT NULL
   - started_at timestamptz NOT NULL DEFAULT now()
   - completed_at timestamptz
   - status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed','skipped'))
   - trigger_source text NOT NULL CHECK (trigger_source IN ('cron','manual','retry'))
   - target_date date
   - skip_reason text
   - processed int DEFAULT 0
   - succeeded int DEFAULT 0
   - failed int DEFAULT 0
   - total_amount numeric DEFAULT 0
   - circuit_breaker_triggered boolean DEFAULT false
   - duration_ms int
   - summary jsonb
   - error_message text
   - indexes: (organization_id, started_at desc), (status)

7. Table: price_change_schedules
   - id uuid PK
   - organization_id uuid NOT NULL
   - plan_id uuid NOT NULL REFERENCES plans(id)
   - scheduled_date date NOT NULL
   - status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled'))
   - old_pricing_snapshot jsonb
   - new_pricing_snapshot jsonb
   - affected_enrollments_count int DEFAULT 0
   - processed_count int DEFAULT 0
   - failed_count int DEFAULT 0
   - notify_members boolean DEFAULT true
   - notes text
   - created_by uuid REFERENCES profiles(id)
   - executed_by uuid REFERENCES profiles(id)
   - executed_at timestamptz
   - error_log jsonb
   - created_at, updated_at
   - index (organization_id, scheduled_date)

8. Table: price_change_audit
   - id uuid PK
   - organization_id uuid NOT NULL
   - schedule_id uuid NOT NULL REFERENCES price_change_schedules(id)
   - enrollment_id uuid NOT NULL REFERENCES enrollments(id)
   - billing_schedule_id uuid REFERENCES billing_schedules(id)
   - old_amount numeric
   - new_amount numeric
   - change_reason text
   - applied_at timestamptz NOT NULL DEFAULT now()
   - notification_sent boolean DEFAULT false
   - notification_sent_at timestamptz
   - immutable: no UPDATE policy, INSERT only

9. ALTER existing tables — additive columns only (use ADD COLUMN IF NOT EXISTS).
   IMPORTANT: most of the cost/payment/status columns I was going to add are ALREADY on `enrollments`. See "Schema reality" at the top of this doc. Only add what is genuinely missing:
   - enrollments: add columns
       inactive_reason text REFERENCES inactive_reasons(code)  -- pairs with the existing end_date column
       last_modified_by uuid REFERENCES profiles(id)            -- trigger expects this for audit
   - billing_schedules: add
       idempotency_key text UNIQUE
       last_failure_id uuid REFERENCES billing_failures(id)
   - billing_transactions: add idempotency_key text UNIQUE
   - commissions: ensure source_advisor_id, override_level columns exist (they do per the map — verify with information_schema and skip if present)

   DO NOT add these (already exist; verify with information_schema if unsure):
   - initial_payment_paid, primary_is_smoker, end_date, next_billing_date,
     first_billing_date, permanent_bill_day, monthly_contribution_fee,
     enrollment_source, channel, agreed_to_terms/_privacy/_guidelines.
   - There is no `monthly_cost` column — the canonical is `base_monthly_cost`. Do NOT add `monthly_cost`.

After CREATE TABLE, enable RLS and add the four policies (SELECT/INSERT/UPDATE/DELETE) per table using get_user_organization_id() guard, e.g.:
    CREATE POLICY "tenant_select" ON enrollment_dependents FOR SELECT
      USING (organization_id = get_user_organization_id());
For price_change_audit add only SELECT + INSERT policies (no UPDATE/DELETE).

At the end of the file, NOTIFY pgrst, 'reload schema';

Then:
- Run the migration locally (supabase db push --linked) ONLY after I review it.
- Regenerate types: npm run db:types (or the equivalent script in package.json).

Do NOT touch existing data. Do NOT add ON DELETE CASCADE on FKs pointing to large operational tables (enrollments, plans) — use ON DELETE RESTRICT or NO ACTION except where I specified CASCADE above.

Print the migration file content for me to review before writing.
```

---

## PROMPT 2 — Triggers: enrollment ↔ billing ↔ commissions auto-sync

```
Continuing CRM-Eco production work. NO DATA LOSS rule still in force.

Create supabase/migrations/202605210002_enrollment_billing_commission_triggers.sql.

All functions use CREATE OR REPLACE so they're idempotent. All triggers use DROP TRIGGER IF EXISTS … then CREATE TRIGGER (safe pattern — only drops the trigger meta, not data).

CRM-Eco column names (verified — use these, NOT saudemax's):
- cost column on enrollments: `base_monthly_cost` (NOT `monthly_cost`)
- end column on enrollments: `end_date` (NOT `inactive_date`)
- active status value: `'approved'` (NOT `'active'`)
- cancelled status value: `'cancelled'` (NOT `'inactive'` / `'terminated'`)
- start date column: `effective_date`
- advisor FK: `advisor_id` uuid (NOT `agent_id`)
- member FK: `primary_member_id` uuid (NOT `member_id` text)
- billing day column on enrollments: `permanent_bill_day`

1. Function compute_first_billing_date(p_effective_date date) RETURNS date
   Logic: return the 20th of (p_effective_date - interval '1 month').
   Example: p_effective_date 2026-06-01 → returns 2026-05-20.
   Edge case: if computed date < CURRENT_DATE, return CURRENT_DATE (don't schedule into the past).

2. Function generate_billing_schedule_on_enrollment_active()
   Trigger: AFTER INSERT OR UPDATE OF status ON enrollments
   Fires when NEW.status = 'approved' AND NEW.initial_payment_paid = true AND no active billing_schedule exists for NEW.id.
   Action: INSERT INTO billing_schedules (organization_id, enrollment_id, member_id, payment_profile_id, amount, frequency, billing_day, start_date, next_billing_date, status) VALUES (NEW.organization_id, NEW.id, NEW.primary_member_id, <default profile>, NEW.base_monthly_cost, 'monthly', COALESCE(NEW.permanent_bill_day, 20), NEW.effective_date, compute_first_billing_date(NEW.effective_date), 'active').
   Pull payment_profile_id from: SELECT id FROM payment_profiles WHERE member_id = NEW.primary_member_id AND is_default AND is_active LIMIT 1.
   If none found: skip schedule creation and INSERT into enrollment_audit_log (organization_id, enrollment_id, actor_profile_id=NEW.last_modified_by, action='payment_profile_missing', payload jsonb).

3. Function sync_billing_schedule_on_enrollment_update()
   Trigger: AFTER UPDATE OF base_monthly_cost ON enrollments
   When NEW.base_monthly_cost IS DISTINCT FROM OLD.base_monthly_cost AND NEW.status = 'approved':
     UPDATE billing_schedules SET amount = NEW.base_monthly_cost, updated_at = now()
     WHERE enrollment_id = NEW.id AND frequency = 'monthly' AND status = 'active';
   Log to enrollment_audit_log with actor_profile_id = NEW.last_modified_by, action='billing_amount_synced', payload jsonb with old/new amount.

4. Function cancel_future_billing_on_enrollment_cancelled()
   Trigger: AFTER UPDATE OF status ON enrollments
   When NEW.status = 'cancelled' AND OLD.status <> 'cancelled':
     UPDATE billing_schedules SET status='cancelled', updated_at=now()
     WHERE enrollment_id = NEW.id AND status IN ('active','paused');
     UPDATE commissions SET status='reversed', status_reason=COALESCE(NEW.inactive_reason,'enrollment_cancelled'), updated_at=now()
     WHERE enrollment_id = NEW.id AND status='pending';
   Also set NEW.end_date = COALESCE(NEW.end_date, CURRENT_DATE) via a BEFORE UPDATE companion trigger if end_date is null on the cancel transition.

5. Function create_signup_commission_on_enrollment()
   Trigger: AFTER UPDATE OF status ON enrollments
   When NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.advisor_id IS NOT NULL AND NEW.initial_payment_paid = true:
     - Look up advisor: SELECT commission_eligible, agent_level_id INTO … FROM advisors WHERE id = NEW.advisor_id. Skip if not eligible.
     - Skip if a signup commission already exists: SELECT 1 FROM commissions WHERE enrollment_id = NEW.id AND commission_type = 'new_business'.
     - Look up rate: SELECT signup_commission FROM commission_rates WHERE organization_id = NEW.organization_id AND agent_level_id = <advisor level> AND (product_id = NEW.product_id OR product_id IS NULL) AND is_active AND effective_date <= CURRENT_DATE AND (end_date IS NULL OR end_date > CURRENT_DATE) ORDER BY product_id NULLS LAST LIMIT 1.
     - Insert into commissions: organization_id, advisor_id, enrollment_id, member_id=NEW.primary_member_id, commission_type='new_business', base_amount=NEW.base_monthly_cost, commission_amount=<rate>, status='pending', commission_period=date_trunc('month', CURRENT_DATE)::date.
     - Leave a `-- TODO: overrides handled by Prompt 9 monthly accrual` comment; do NOT call generate_overrides from this trigger (keeps trigger fast + idempotent).

6. Function recompute_advisor_tier_on_membership_change()
   Trigger: AFTER INSERT OR UPDATE OF status ON memberships
   On status change to/from 'active':
     UPDATE advisors SET
       agent_level_id = (SELECT id FROM agent_levels al WHERE al.organization_id = NEW.organization_id
                          AND al.is_active
                          AND (SELECT count(*) FROM memberships m WHERE m.advisor_id = NEW.advisor_id AND m.status='active') BETWEEN al.min_active_members AND COALESCE(al.max_active_members, 1e9)
                          ORDER BY al.level_rank DESC LIMIT 1)
     WHERE id = NEW.advisor_id;

7. At end: NOTIFY pgrst, 'reload schema';

For each function, wrap the body in a BEGIN/EXCEPTION block that logs to enrollment_audit_log on failure and re-raises so the parent transaction sees the failure. Do NOT silently swallow errors — that's a footgun in production.

Pre-flight checks before writing (Cursor: run these and STOP if any answer surprises you):
- Confirm columns on enrollments: base_monthly_cost, end_date, advisor_id (uuid), primary_member_id (uuid), effective_date, initial_payment_paid, permanent_bill_day, status (text enum). These were verified to exist as of migration 202605200001. If any are missing, STOP and report.
- Confirm columns on billing_schedules: organization_id, enrollment_id, member_id, payment_profile_id, amount, frequency, billing_day, start_date, next_billing_date, status.
- Confirm columns on commissions: organization_id, advisor_id, enrollment_id, member_id, commission_type, base_amount, commission_amount, status, status_reason, commission_period.

Print the file before writing.
```

---

## PROMPT 3 — Enrollment domain service (unified enrollment + plan change)

```
Create packages/lib/src/enrollment/enrollment-service.ts.

This is the equivalent of saudemax's unifiedEnrollmentService. It must handle:
1. createEnrollment(input) — for new enrollments
2. changePlan(input) — for plan changes (inactivate old + create new + optional pro-rata difference)
3. cancelEnrollment(enrollmentId, reason)
4. Coverage activation — finalize leaves membership `pending`; `activate-due-memberships` cron flips live on effective_date (do not use a separate enrollments activate API)

Reference (not to be imported, separate database):
/Users/qloudagent/Desktop/Desktop/APPLICATIONS/saudemax-admin-system/src/lib/unifiedEnrollmentService.ts

Structure:

export class EnrollmentService {
  constructor(private supabase: SupabaseClient, private organizationId: string) {}

  async createEnrollment(input: CreateEnrollmentInput): Promise<EnrollmentResult>
  async changePlan(input: ChangePlanInput): Promise<EnrollmentResult>
  async cancelEnrollment(enrollmentId: string, reasonCode: string, notes?: string): Promise<EnrollmentResult>
  // (removed) activateFutureEnrollment — use finalize + activate-due-memberships cron

  // Helpers
  private async computeFirstBillingDate(startDate: Date): Promise<Date>  // 20th of month before start
  private async computeProRataDifference(oldEnrollment, newPlan, startDate): Promise<number>
}

Types (in same file or a sibling types.ts):

interface CreateEnrollmentInput {
  primaryMemberId: string;          // crm_records.id (member module)
  planId: string;
  advisorId?: string;
  dependents?: DependentInput[];
  effectiveDate?: string;           // defaults to 1st of next month
  paymentProfileId?: string;        // creates schedule only if present
  source: 'agent_portal'|'website'|'admin'|'import';
  customFields?: Record<string, unknown>;
}

interface ChangePlanInput {
  existingEnrollmentId: string;
  newPlanId: string;
  dependentsToAdd?: DependentInput[];
  dependentsToInactivate?: { dependentId: string; reason: string }[];
  changeReasonCode: string;          // from inactive_reasons lookup
  allowNextMonthWithDifferencePayment?: boolean;  // post-20th handling
  effectiveDate?: string;            // override default 1st-of-next-month
}

interface DependentInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  relationship: 'spouse'|'child'|'domestic_partner'|'other';
}

interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  oldEnrollmentId?: string;
  differenceBillingId?: string;
  errors?: { code: string; message: string }[];
}

Behavior:

createEnrollment:
- Validate plan_id exists and is active for the org
- Validate primaryMemberId exists in crm_records for the org
- Compute effective_date = input.effectiveDate ?? first-day-of-next-month
- Open a single Supabase RPC transaction (call an RPC named create_enrollment_tx) — see note below
- Inside the RPC:
  - Insert into enrollments with status='draft' initially (so triggers don't fire prematurely)
  - Insert enrollment_dependents rows
  - Update enrollments.status='approved' and initial_payment_paid=false (no payment collected yet at this step)
  - Return the new enrollment_id
- After RPC: if paymentProfileId given, attempt initial payment via BillingService.processPayment; on success set initial_payment_paid=true via UPDATE (which will fire generate_billing_schedule_on_enrollment_active and create_signup_commission_on_enrollment triggers).

changePlan:
- Fetch existingEnrollment; verify status='active' or 'approved'
- Compute newEffectiveDate. If today >= 20th of current month and the requested effective date is the 1st of next month:
    - If allowNextMonthWithDifferencePayment: keep newEffectiveDate; compute pro-rata difference for remaining days of CURRENT month at the new rate; create a one-time billing_transactions row of type 'charge' for the difference and process it.
    - Else: bump newEffectiveDate to the 1st of the month AFTER next.
- Inactivate old: UPDATE enrollments SET status='cancelled', end_date=last-day-of-current-month, inactive_reason=input.changeReasonCode (this fires cancel_future_billing_on_enrollment_cancelled from Prompt 2)
- Inactivate removed dependents: UPDATE enrollment_dependents SET status='inactive', inactive_date=…, inactive_reason=per-dependent reason
- Create new enrollment via createEnrollment (carrying over active dependents not in dependentsToInactivate)
- Return both ids + difference billing id if applicable

cancelEnrollment:
- UPDATE enrollments SET status='cancelled', end_date=now()::date, inactive_reason=reasonCode

Important:
- All multi-step operations must be wrapped in a transaction. Create a Postgres RPC `create_enrollment_tx(p_org_id, p_payload jsonb)` in a new migration 202605210003_enrollment_rpc.sql so the inserts are atomic at the DB level. The service calls that RPC.
- Do NOT use the supabase-js client's "single batched insert" pattern across tables — it isn't transactional.
- All inserts include organization_id = this.organizationId.
- Throw typed errors (class EnrollmentError extends Error with code: string) — never return string error messages from internal calls.

Add to packages/lib/src/enrollment/index.ts: export * from './enrollment-service'.

After writing:
- npm run typecheck inside packages/lib
- Show me the file before I commit.
```

---

## PROMPT 4 — Contract PDF generation (edge function + signature pad)

```
Add contract generation matching saudemax's generate-enrollment-contract edge function.

1. apps/admin/src/app/api/contracts/generate/route.ts (Next.js Route Handler — NOT a Supabase edge function)
   Reason: PDF generation needs @sparticuz/chromium which runs in Vercel's Node.js runtime, not Deno. Keep this on Vercel.
   - export const runtime = "nodejs"; export const maxDuration = 60;
   - POST body: { enrollment_id: string, agreement_type: string }
   - Auth: require a service token in Authorization header (env: INTERNAL_API_TOKEN) — only the portal's submit action and admin "regenerate" button should call it.
   - Steps:
     a. Use the admin Supabase client (service-role from server env) to fetch enrollment + member + plan + organization + the captured signature_png from agreement_signatures (if not yet captured, return 400 — must sign first).
     b. Fetch the matching legal_documents row (organization_id, document_type=agreement_type, status='active', highest version).
     c. Render content_html with mustache replacement of {{member_name}}, {{member_dob}}, {{plan_name}}, {{base_monthly_cost}}, {{effective_date}}, {{organization_name}}, {{signed_at}}, {{signer_name}}. Embed the signature_png as a <img src="data:image/png;base64,..."> inside a "Signature" block.
     d. Sanitize the rendered HTML server-side with isomorphic-dompurify BEFORE passing to puppeteer (legal_documents content is admin-authored but we still sanitize defense-in-depth).
     e. Launch puppeteer-core + @sparticuz/chromium-min:
         const browser = await puppeteer.launch({
           args: chromium.args,
           executablePath: await chromium.executablePath(process.env.CHROMIUM_PACK_URL),
           headless: true,
         });
         const page = await browser.newPage();
         await page.setContent(html, { waitUntil: 'networkidle0' });
         const pdf = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' } });
         await browser.close();
     f. Upload the PDF to Supabase Storage bucket 'contracts' at path enrollments/{enrollment_id}/{agreement_type}-v{version}-{timestamp}.pdf (timestamp suffix so regenerations don't clobber).
     g. UPDATE agreement_signatures SET pdf_storage_path=…, pdf_generated_at=now() WHERE enrollment_id AND agreement_type matches; or INSERT if no row.
     h. Return { success: true, storage_path, signed_url: <createSignedUrl 1h> }.
   - Add `@sparticuz/chromium-min` and `puppeteer-core` to apps/admin/package.json. Set CHROMIUM_PACK_URL env var to the sparticuz CDN tarball matching the installed version (pin in README).

2. Storage bucket: ensure 'contracts' bucket exists with private access. If creating in a migration, use the supabase_storage extension or run `select storage.create_bucket(...)`. RLS policy: only authenticated users in same org can SELECT.

3. apps/portal/src/components/signature-pad.tsx
   - Canvas-based, captures strokes, returns base64 PNG via onCapture(dataUrl)
   - Mobile-friendly (touch + pointer events)
   - Clear + redraw buttons

4. apps/portal/src/app/enroll/[slug]/agreement/page.tsx
   - Renders the legal_documents.content_html (read-only, html-sanitized via isomorphic-dompurify both server and client)
   - Below: <SignaturePad onCapture={…}/>
   - On submit, calls a server action that:
       a. INSERTs agreement_signatures with signature_png, signer_name, signer_ip, signer_user_agent, signed_at=now()
       b. fetch()es POST /api/contracts/generate (the Next.js route from step 1) with Authorization: Bearer ${INTERNAL_API_TOKEN}
       c. Waits for the PDF to be ready (timeout 30s; if it times out, return success but mark agreement_signatures.metadata.pdf_pending=true so a backend retry can run later)
   - On success, advance the wizard.

5. apps/admin/src/app/(dashboard)/enrollments/[id]/agreements/page.tsx
   - Lists all agreement_signatures for the enrollment
   - "Download PDF" button → server action that calls supabase.storage.from('contracts').createSignedUrl(path, 3600)
   - "Regenerate" button → re-POSTs /api/contracts/generate (idempotent — overwrites the storage path with a new timestamp suffix)

Hard rules:
- Sanitize legal_documents.content_html before rendering (server-side too, before passing to the renderer).
- Never expose service_role key client-side.
- The signature PNG should be capped at ~150KB (resize/compress canvas output). Reject larger payloads.

After this prompt:
- Add a seed legal_documents row for testing under the PIFH org.
- Show the file diff and a sample seed before committing.
```

---

## PROMPT 5 — Automated billing processor (cron, batched, circuit breaker)

```
Upgrade the existing supabase/functions/process-billing/ edge function (or create a sibling supabase/functions/billing-cron/) to match saudemax's billing-processor.

Read the existing process-billing function first to understand what's there; do NOT rewrite from scratch if the bones are usable.

Behavior:

Trigger: POST /functions/v1/billing-cron with service-role auth.
Input body: { organization_id?: string, target_date?: string (YYYY-MM-DD), force?: boolean, dry_run?: boolean }
If organization_id omitted, process every org that has billing_automation_config.enabled = true.

For each org:
1. Insert billing_job_runs row, status='running', trigger_source='cron' (or 'manual' if force=true).
2. Idempotency check: if a billing_job_runs row for this org+target_date already exists with status='success' AND force=false, set status='skipped', skip_reason='already_completed', return early.
3. Fetch config from billing_automation_config (batch_size, rate_limit_ms, max_retries, circuit_breaker_threshold).
4. Query: SELECT bs.*, e.status as enrollment_status FROM billing_schedules bs JOIN enrollments e ON bs.enrollment_id = e.id WHERE bs.organization_id = $1 AND bs.status='active' AND bs.next_billing_date <= $2 AND e.status IN ('active','approved') ORDER BY bs.next_billing_date.
5. Initialize circuit_breaker_failures = 0.
6. For each schedule in batches of batch_size:
   a. If circuit_breaker_failures >= threshold: stop processing; mark run circuit_breaker_triggered=true.
   b. For each schedule in the batch (sequential within batch, with rate_limit_ms delay):
      - Build idempotency_key = `${schedule.id}|${target_date}|${schedule.next_billing_date}` (deterministic).
      - Check billing_transactions for matching idempotency_key — if found AND status='success', skip and advance the schedule.
      - Call BillingService.processPayment({ scheduleId, idempotencyKey }) — modify BillingService.processPayment to accept idempotency_key, write it to billing_transactions on insert, and short-circuit if an identical key already exists.
      - On success: BillingService already updates the schedule's next_billing_date. Increment counters.
      - On failure: BillingService already creates a billing_failures row. Increment circuit_breaker_failures if the failure is a network/gateway error (E00001, timeout, 5xx); do NOT increment for decline errors (insufficient funds, expired card) — those are normal.
      - Wait rate_limit_ms before next charge.
   c. After each batch, sleep 100ms.
7. Finalize billing_job_runs: status='success' if circuit_breaker_failures < threshold and we got through everything; else 'failed'. Populate processed/succeeded/failed/total_amount/duration_ms/summary.

Dry run mode: if dry_run=true, run the query and return what WOULD be charged, do NOT call Authorize.Net, do NOT write billing_transactions or billing_failures.

Scheduling — VERCEL CRON (NOT pg_cron):
- Add to apps/admin/vercel.json (or create if missing):
    {
      "crons": [
        { "path": "/api/cron/billing-charge", "schedule": "0 14 * * *" }
      ]
    }
- Create apps/admin/src/app/api/cron/billing-charge/route.ts:
    export const runtime = 'nodejs';
    export const maxDuration = 300; // 5 min (Pro plan limit)
    export async function GET(req: Request) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      // Invoke the Supabase Edge Function with service-role auth, OR run inline:
      const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/billing-cron`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      return Response.json(await res.json(), { status: res.status });
    }
- Vercel automatically injects an Authorization: Bearer ${CRON_SECRET} header when CRON_SECRET is set as an env var. Set CRON_SECRET in Vercel project env (Production scope).
- Document in the runbook: pause a misfiring cron by removing the entry from vercel.json and redeploying, or disable it from the Vercel dashboard.

Hardening:
- Wrap each charge in try/catch — never let one bad charge kill the whole batch.
- Log charge attempts to billing_job_runs.summary.attempts (jsonb array) only in non-prod / when summary.size_kb < 256.
- All Authorize.Net responses persisted to billing_transactions (already the BillingService behavior).

Admin UI:
- apps/admin/src/app/(dashboard)/billing/runs/page.tsx — list billing_job_runs, filter by status + date, click into a run to see the summary jsonb pretty-printed and the related billing_failures.

Show me:
- The diff to process-billing or the new billing-cron file
- The new migration file
- The new admin UI file
before I deploy.
```

---

## PROMPT 6 — Retry processor + dunning emails

```
Add the failed-payment retry loop and dunning emails. NO destructive changes to billing_failures rows — only INSERT/UPDATE.

1. supabase/functions/billing-retry/index.ts
   - POST { organization_id?: string, dry_run?: boolean }
   - Query: SELECT bf.*, bs.payment_profile_id, bs.amount, m.email, m.first_name FROM billing_failures bf JOIN billing_schedules bs ON bs.id = bf.billing_schedule_id … WHERE bf.resolved = false AND bf.next_retry_date <= CURRENT_DATE AND bf.retry_attempt < (SELECT max_retries FROM billing_automation_config WHERE organization_id = bf.organization_id) AND bf.retry_scheduled = true
   - For each failure:
     a. Call BillingService.processPayment for the schedule. Use idempotency_key = `retry|${bf.id}|${bf.retry_attempt+1}`.
     b. On success: UPDATE billing_failures SET resolved=true, resolved_at=now(), resolution_type='payment_succeeded' WHERE id=bf.id; do NOT delete the row (audit trail). Invoke notify-payment-recovered email.
     c. On failure: UPDATE billing_failures SET retry_attempt = retry_attempt+1, next_retry_date = CURRENT_DATE + (CASE retry_attempt WHEN 0 THEN 1 WHEN 1 THEN 3 WHEN 2 THEN 7 ELSE 14 END), member_notified = false WHERE id=bf.id. Then invoke notify-payment-failed email (with retry_attempt context).
     d. If retry_attempt+1 >= max_retries on the failed branch: UPDATE billing_failures SET resolved=true, resolution_type='abandoned', resolved_at=now(); invoke notify-payment-abandoned email; mark the billing_schedule status='paused' (NOT cancelled — admin must explicitly cancel).
   - Return summary.

2. Email templates — add to apps/admin/src/lib/email-templates/ (or wherever existing templates live):
   - payment-failed-attempt-1.tsx
   - payment-failed-attempt-2.tsx
   - payment-failed-attempt-3.tsx
   - payment-abandoned.tsx
   - payment-recovered.tsx
   Each uses Resend (or the existing email provider — read send-email function first to determine).

3. Schedule via Vercel Cron daily at 16:00 UTC (two hours after the main charge run gives time for it to finish):
   - Append to apps/admin/vercel.json crons array:
       { "path": "/api/cron/billing-retry", "schedule": "0 16 * * *" }
   - Create apps/admin/src/app/api/cron/billing-retry/route.ts — same shape as billing-charge route from Prompt 5, but POSTs to /functions/v1/billing-retry.

4. Admin UI: apps/admin/src/app/(dashboard)/billing/failures/page.tsx (extend if exists)
   - Filters: unresolved, next_retry_date today, attempt count
   - "Retry now" button calls billing-retry with { failure_id }
   - "Mark resolved manually" → UPDATE resolved=true, resolution_type='manually_resolved', resolved_by=auth.uid()
   - "Waive" → resolution_type='waived'

Hard rule: never insert a duplicate billing_failures row for the same billing_transaction_id. Add a unique partial index in migration 202605210005_billing_failures_unique.sql:
  CREATE UNIQUE INDEX IF NOT EXISTS billing_failures_unique_txn ON billing_failures (billing_transaction_id) WHERE billing_transaction_id IS NOT NULL;

Show diffs before applying.
```

---

## PROMPT 7 — Price change scheduler

```
Build the price-change workflow on top of the price_change_schedules / price_change_audit tables from Prompt 1.

1. packages/lib/src/billing/price-change-service.ts — new file.
   class PriceChangeService:
   - schedulePriceChange(input: { planId, scheduledDate, newPricingSnapshot, notes, notifyMembers })
     - SELECT current pricing snapshot from plans (or a plan_pricing table if one exists — check first)
     - INSERT into price_change_schedules with status='pending', old_pricing_snapshot, new_pricing_snapshot
     - Compute affected_enrollments_count = count of active enrollments on this plan
   - previewPriceChange(scheduleId) — returns list of affected enrollments + old/new base_monthly_cost per enrollment, without writing.
   - executePriceChange(scheduleId)
     - UPDATE schedule status='processing'
     - For each active (status='approved') enrollment on the plan:
         compute new base_monthly_cost from new_pricing_snapshot (age bracket + tier)
         INSERT into price_change_audit (snapshot of old + new amount, billing_schedule_id)
         UPDATE enrollments SET base_monthly_cost = new_amount, last_modified_by = <executor profile id>  -- fires sync_billing_schedule_on_enrollment_update trigger from Prompt 2
     - Update schedule.status='completed', processed_count, failed_count
     - If notifyMembers: enqueue notification emails (separate edge function)
   - cancelScheduledPriceChange(scheduleId) — only allowed while status='pending'

2. supabase/functions/apply-price-change/index.ts
   - POST { schedule_id }
   - Calls PriceChangeService.executePriceChange
   - Idempotent: if status != 'pending', return early with current status

3. Vercel Cron daily 10:00 UTC:
   - Append to apps/admin/vercel.json crons: { "path": "/api/cron/price-change", "schedule": "0 10 * * *" }
   - apps/admin/src/app/api/cron/price-change/route.ts:
       Auth-check CRON_SECRET → SELECT id FROM price_change_schedules WHERE organization_id IN (orgs) AND status='pending' AND scheduled_date <= CURRENT_DATE → for each, POST to /functions/v1/apply-price-change with { schedule_id } sequentially (price changes are infrequent — no need to parallelize).

4. Admin UI: apps/admin/src/app/(dashboard)/billing/price-changes/
   - list page: pending / completed / failed tabs
   - new page: form (plan, scheduled_date, notes, notify_members toggle); shows preview count before submit
   - [id] page: shows status, audit rows, "execute now" button (if pending)

Safety:
- Add a guard: a plan cannot have two pending schedules with overlapping scheduled_dates within the same month — enforce via a partial unique index plus a check at submit time.
- price_change_audit is immutable — no UPDATE policy.

Print diffs before committing.
```

---

## PROMPT 8 — Authorize.Net webhook handler

```
Add a webhook handler so Authorize.Net async events update our records.

1. supabase/functions/authnet-webhook/index.ts
   - POST endpoint, validates HMAC SHA-512 of the request body using AUTHNET_WEBHOOK_SIGNATURE_KEY (env var). Reject if mismatch.
   - INSERT raw event into a new table payment_webhooks (event_type, event_id, payload jsonb, signature_valid bool, processed bool default false) — see migration below. Use event_id (Authorize.Net's notificationId) as a unique constraint to dedupe replays.
   - Switch on event_type:
       'net.authorize.payment.authcapture.created' → UPDATE billing_transactions SET status='success' WHERE authorize_transaction_id = payload.id
       'net.authorize.payment.refund.created' → UPDATE billing_transactions SET status='refunded'
       'net.authorize.payment.void.created' → status='voided'
       'net.authorize.payment.authorization.created' → status='processing'
       For each: also update the linked invoices row if any (status='paid' on capture).
   - Set processed=true, processed_at=now() on success. On exception: processing_error=err.message.

2. supabase/migrations/202605210007_payment_webhooks.sql
   CREATE TABLE IF NOT EXISTS payment_webhooks (
     id uuid PK,
     organization_id uuid,  -- nullable; resolved from authorize_customer_profile_id lookup
     event_id text UNIQUE NOT NULL,
     event_type text NOT NULL,
     payload jsonb NOT NULL,
     signature_valid boolean NOT NULL,
     processed boolean NOT NULL DEFAULT false,
     processed_at timestamptz,
     processing_error text,
     created_at timestamptz default now()
   );
   Index on (processed, created_at), (event_type).
   Enable RLS — only service role can read (no user-facing access).

3. Document the operator step: register the webhook URL in Authorize.Net merchant interface pointing to https://<project>.supabase.co/functions/v1/authnet-webhook. Subscribe to authcapture, refund, void, authorization events.

4. Add a Slack/email alert on webhooks where signature_valid=false — that's a security event. Reuse existing send-email function.

Print files before committing.
```

---

## PROMPT 9 — Commissions: monthly accrual job + override automation

```
Create the recurring commission engine.

1. supabase/functions/commissions-accrual/index.ts
   - POST { organization_id?: string, period_month?: 'YYYY-MM-01', dry_run?: boolean }
   - For each org (if not specified, every org with active enrollments):
     - Determine period_month (default = first of current month).
     - Query active enrollments: SELECT e.*, a.commission_eligible, a.agent_level_id, a.id as advisor_id FROM enrollments e JOIN advisors a ON e.advisor_id = a.id WHERE e.organization_id = $1 AND e.status IN ('active','approved') AND e.initial_payment_paid = true AND a.commission_eligible = true.
     - For each enrollment:
       a. Compute monthly commission using CommissionService.calculateCommission({ enrollmentId, advisorId, grossAmount: e.monthly_cost, transactionType: 'renewal', periodStart: period_month, periodEnd: end-of-month }).
       b. Skip if a commission for (advisor_id, enrollment_id, commission_type='renewal', commission_period=period_month) already exists.
       c. CommissionService.createCommissionTransaction(...) — inserts with status='pending'.
       d. Call CommissionService.generateOverrides({ enrollmentId, sourceAdvisorId: advisor_id, grossAmount, periodStart, periodEnd, maxLevels: 5 }) which uses the existing get_advisor_upline RPC — inserts override commissions for upline. Already implemented; just invoke.
   - All ops idempotent: each insert checks for existing row first.
   - Return { processed, skipped, errors }.

2. Vercel Cron monthly on the 1st at 02:00 UTC:
   - Append to apps/admin/vercel.json crons: { "path": "/api/cron/commissions-accrual", "schedule": "0 2 1 * *" }
   - apps/admin/src/app/api/cron/commissions-accrual/route.ts — same auth pattern; POSTs to /functions/v1/commissions-accrual with {} (the edge function fans out by org internally).
   - Each Edge Function run inserts a row into a new commissions_job_runs table (mirror of billing_job_runs) — create that table in a new migration 202605210008_commissions_job_runs.sql.

3. Audit:
   - Add migration to create commissions_job_runs (mirror of billing_job_runs but for commissions).

4. Trigger handle-off:
   - Prompt 2's create_signup_commission_on_enrollment trigger handles signup commissions on enrollment activation.
   - This new accrual job handles monthly + override commissions.
   - The cancel_future_billing_on_enrollment_inactive trigger from Prompt 2 already reverses pending commissions on cancellation.

5. Admin UI: apps/admin/src/app/(dashboard)/commissions/runs/page.tsx
   - List commissions_job_runs
   - "Run now for {month}" button → POST to commissions-accrual with {period_month, organization_id}
   - "Dry run" toggle

Print diffs first.
```

---

## PROMPT 10 — Commission payouts UI + bulk processor

```
Wire up the existing payout infrastructure (commission_payment_batches, commission_payouts, commission_ledger, payout-compliance.ts) into an end-to-end admin workflow.

1. apps/admin/src/app/(dashboard)/commissions/payouts/page.tsx (extend if exists)
   - "New Payout Batch" button → opens dialog: select period_start, period_end, description.
   - Calls existing RPC create_payout_batch(org_id, period_start, period_end, description) — that's already in the DB.
   - Lists all batches with status badges, total_amount, total_advisors.

2. apps/admin/src/app/(dashboard)/commissions/payouts/[batchId]/page.tsx (extend or create)
   - Header: batch_number, status, total_amount, total_advisors, period.
   - Tabs:
     - Items: per-advisor breakdown (commission_payouts rows), payment_method, net_amount, compliance_status.
     - Anomalies: rows from /api/commissions/payouts/[batchId]/anomalies (already exists). Block approval if unresolved anomalies.
     - Audit: rows from commission_ledger linked to this batch.
   - Buttons:
     - "Approve" → POST to /api/commissions/payouts/[batchId]/approve (already exists).
     - "Process Payout" (only if approved AND no unresolved anomalies):
         → invokes a new edge function payouts-process which for each commission_payout in the batch picks the configured provider (advisor.payout_provider = 'stripe_connect' | 'ach' | 'manual') and calls the matching apps/crm/src/lib/payouts/providers/<provider>.ts.
         → On success: UPDATE commission_payouts.status='paid', commissions.status='paid' for linked ledger entries.
     - "Reconcile" → POST to existing /api/commissions/payouts/[batchId]/reconcile.

3. supabase/functions/payouts-process/index.ts (new)
   - POST { batch_id }
   - Acquires advisory lock on the batch (pg_try_advisory_xact_lock(hashtext(batch_id)))
   - Iterates commission_payouts WHERE batch_id=$1 AND status='approved'
   - For each: call payout-compliance.ts checkHolds(advisor_id) — skip with status='held' if any
   - Dispatch to provider; capture provider_reference; on success → status='paid', paid_at=now() and cascade to commission_ledger.status='paid' (via existing trigger if it exists, else explicit UPDATE).
   - Idempotent: status guard prevents double-processing.

4. Agent portal: apps/portal/src/app/agent/commissions/page.tsx (extend)
   - Tabs: Pending / Paid / Reversed / Held
   - Sections: "My direct commissions" (commission_type='new_business' or 'renewal') and "Override commissions" (commission_type='override' where source_advisor_id != me)
   - Monthly chart from advisor_commission_summary

5. Compliance gate:
   - Hard rule in payouts-process: skip and log when commission_hold=true on the advisor or any open commission_adjustments with status='pending' for that advisor in the batch period.

Print all new files before committing.
```

---

## PROMPT 11 — Public enrollment landing page (/enroll/[slug])

```
The route apps/portal/src/app/enroll/[slug]/page.tsx exists but I want it to match saudemax's public landing flow.

Behavior:
- [slug] is enrollment_links.slug (already implemented). Resolve the link → advisor_id + target plan + UTM context. Track the visit (existing enrollment_link_visits flow).
- The page is unauthenticated and shows: hero, plan highlights, FAQ, trust badges, CTA "Start Enrollment".
- Clicking CTA routes to /enroll/[slug]/start which begins the multi-step wizard:
    1. /enroll/[slug]/intake — personal info (uses SelfServeIntakeStep)
    2. /enroll/[slug]/household — dependents (uses SelfServeHouseholdStep)
    3. /enroll/[slug]/plan — plan select (uses SelfServePlanSelectionStep)
    4. /enroll/[slug]/agreement — render legal_documents + signature pad (from Prompt 4)
    5. /enroll/[slug]/payment — collects card/ACH details, posts to BillingService.createPaymentProfile + processPayment
    6. /enroll/[slug]/done — success screen with contract download

State management:
- Use a server-side draft enrollment record: on /intake submit, INSERT enrollments with status='draft' and stash the link_id + advisor_id. Subsequent steps UPDATE that draft. Final submit (/payment success) flips status='approved' and initial_payment_paid=true.
- Persist the draft enrollment_id in a signed cookie ('enroll_draft_id') so the user can resume mid-flow.

Validation matches saudemax:
- Age 18–99 on primary
- Household composition depends on plan tier (Member Only / Member+Spouse / Member+Children / Member+Family)
- Email uniqueness check against existing members

Conversion attribution:
- On status='approved', call the existing enrollment_link_conversions logic (already in 202602070005 migration) so the link's conversion_rate updates.

Bot protection:
- Add Google reCAPTCHA v3 on the final submit. NEXT_PUBLIC_RECAPTCHA_SITE_KEY + server-side validation in the submit action.

Do NOT use any client component that imports the full BillingService — only call API routes. Server-side: hit /api/enrollment/draft and /api/enrollment/submit which wrap EnrollmentService + BillingService.

Print all new files + the API route files before committing.
```

---

## PROMPT 12 — Verification + smoke tests

```
Final pass: prove the new system works end-to-end against the PIFH org (organization_id = ac6e7228-…) WITHOUT touching production data unfairly.

1. scripts/smoke-enrollment-billing-commission.ts (node script, ts-node compatible)
   - Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
   - All inserts use organization_id = a "smoke_test" org seeded by this script in a transaction (NOT the PIFH org). Generate a UUID, insert org, seed minimal data, run flow, then output cleanup instructions.
   - Steps:
     a. Create test member (crm_records member module entry)
     b. Create test plan with a known monthly rate
     c. Create test advisor with agent_level
     d. Call /api/enrollment/draft → updates → /api/enrollment/submit
     e. Verify: enrollments row exists with status='approved', initial_payment_paid=true, monthly_cost matches plan
     f. Verify: billing_schedules row created with correct next_billing_date (20th of month before start)
     g. Verify: commissions row created with commission_type='new_business', status='pending'
     h. Verify: agreement_signatures row exists with pdf_storage_path set
     i. Verify: enrollment_audit_log has correct entries
     j. Trigger billing-cron with force=true, dry_run=false
     k. Verify: billing_transactions success row appears, schedule advanced
     l. Trigger commissions-accrual for current month, dry_run=false
     m. Verify: monthly + override commissions inserted
     n. Cancel the enrollment via /api/enrollments/[id]/cancel
     o. Verify: schedule status='cancelled', commissions status='reversed'
   - Script prints PASS/FAIL per step and exits non-zero on any failure.
   - DO NOT delete the test data — print the smoke_test org id and a one-line SQL command the operator can run after review.

2. Add to package.json scripts:
   "smoke:enroll-billing-comm": "tsx scripts/smoke-enrollment-billing-commission.ts"

3. Add a section to docs/RUNBOOK.md (create if missing) covering:
   - How to deploy the new edge functions
   - The env vars added (PDF_RENDERER_URL, AUTHNET_WEBHOOK_SIGNATURE_KEY, RECAPTCHA_SITE_KEY/SECRET)
   - Vercel Cron entries in apps/admin/vercel.json + how to disable in an incident (toggle in Vercel dashboard OR remove from vercel.json and redeploy)
   - Rollback steps if a billing-cron run misfires (manual UPDATE billing_schedules SET next_billing_date = next_billing_date - interval '1 month' WHERE last advanced incorrectly — example)
   - Where logs live (billing_job_runs, commissions_job_runs, payment_webhooks)

4. Tail off with: `npm run typecheck` in every app and resolve all errors. Then build all three apps: `npm run build -w apps/admin && npm run build -w apps/crm && npm run build -w apps/portal`.

Print the smoke script and runbook before running anything.
```

---

# Execution checklist (you, the operator)

- [ ] Verify the right accounts are connected (`gh auth status`, `vercel whoami`, `supabase projects list`) — should be the CRM-Eco/Double-Helix accounts, NOT omnivurse or saudemax.
- [ ] Confirm the PIFH org id is correct in `.env.local`.
- [ ] Take a fresh Supabase backup before running migrations. `supabase db dump --linked --file backups/pre-upgrade-$(date +%F).sql`
- [ ] Run Cursor prompts 1 → 12 in order. After each: review diff, typecheck, commit, then push.
- [ ] Deploy Supabase edge functions: `supabase functions deploy billing-cron billing-retry apply-price-change authnet-webhook commissions-accrual payouts-process`
- [ ] Deploy admin app to Vercel — the Vercel Cron entries activate on the next production deploy.
- [ ] Register Authorize.Net webhook URL → `https://<supabase-project>.supabase.co/functions/v1/authnet-webhook`.
- [ ] Set env vars:
       Vercel (admin app, Production scope): CRON_SECRET, INTERNAL_API_TOKEN, CHROMIUM_PACK_URL, NEXT_PUBLIC_RECAPTCHA_SITE_KEY, RECAPTCHA_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
       Supabase project secrets: AUTHNET_WEBHOOK_SIGNATURE_KEY, AUTHORIZE_NET_API_LOGIN_ID, AUTHORIZE_NET_TRANSACTION_KEY, RESEND_API_KEY
- [ ] Run the smoke test against a fresh smoke_test org.
- [ ] Manually flip `billing_automation_config.enabled = true` for PIFH only AFTER smoke test passes.

# What I deliberately did NOT do

- Re-mapped crm_records to use saudemax's `members` text-id pattern. CRM-Eco uses uuid `crm_records.id` with a member module — keep it. The enrollment service references `primary_member_id` as a crm_records uuid.
- Add FTNI processor. CRM-Eco uses Authorize.Net (and has Stripe adapter ready). Don't fragment processors mid-upgrade.
- Touch the existing `enrollments`, `billing_schedules`, `commissions` schemas beyond additive columns. Those tables hold production data.
- Bake any service-role keys or Authorize.Net secrets into migrations or commits.

# Pre-kickoff decisions — RESOLVED

1. **Cost column on enrollments** — `base_monthly_cost numeric(10,2)`. Memberships have `billing_amount`. There is no `monthly_cost` column; do not add one. See the "Schema reality" section at the top.
2. **Smoke test target** — fresh `smoke_test` org (slug `smoke-test-YYYYMMDD`). Cleanup script prints a one-line DELETE for the operator to run after review.
3. **Scheduler** — Vercel Cron in `apps/admin/vercel.json`, route handlers under `apps/admin/src/app/api/cron/*`, each handler verifies `Authorization: Bearer ${CRON_SECRET}` then forwards to the matching Supabase Edge Function with the service-role key. NOT pg_cron.
4. **PDF renderer** — Next.js Route Handler running on Vercel's Node.js runtime with `puppeteer-core` + `@sparticuz/chromium-min`, loaded from a CDN tarball via `CHROMIUM_PACK_URL`. NOT Browserless, NOT a Supabase edge function (Deno doesn't run @sparticuz/chromium).
