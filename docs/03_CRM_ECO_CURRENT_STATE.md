# CRM-Eco — Current State Inventory (as of 2026-05-21)

Captured from a deep-dive of `/Users/qloudagent/Documents/GitHub/crm-eco`.

## Monorepo

- **Type:** Turborepo + npm workspaces
- **Tech:** Next.js 15 App Router, React 19, TypeScript 5.3, Tailwind 3.4, Supabase, Zustand, React Query, React Hook Form, Zod, Radix UI, lucide-react, recharts
- **Node:** ≥18, npm 11.6.2
- **Latest migration:** `202605200001_carrier_schema_alignment.sql`

## Apps

| App | Path | Purpose |
|---|---|---|
| crm | `apps/crm/` | Main admin CRM interface |
| admin | `apps/admin/` | Super-admin / org management portal |
| portal | `apps/portal/` | Member / advisor self-service |
| advisor-portal | `apps/advisor-portal/` | Legacy advisor tools |
| website | `apps/website/` | Public marketing site |
| doublehelixhub | `apps/doublehelixhub/` | Specialized module |

## Packages

- `packages/lib/` — services + generated types (`src/types/database.ts`)
- `packages/enrollment/` — Self-Serve enrollment React components
- `packages/rates/` — Pricing/rate logic
- `packages/ui/` — Shared UI primitives

---

# ENROLLMENT — what exists

## Tables (verified from migrations)

| Table | Key columns |
|---|---|
| `enrollments` | id, organization_id, enrollment_number, primary_member_id (uuid → members), lead_id, advisor_id (uuid), enrollment_source, channel, status (draft/in_progress/submitted/approved/rejected/cancelled), selected_plan_id, product_id, requested_effective_date, effective_date, end_date, household_size, has_mandate_warning, has_age65_warning, external_vendor_enrollment_id, snapshot jsonb, custom_fields jsonb, **base_monthly_cost**, monthly_contribution_fee, annual_fee, administration_fee, association_fee, iua_fee, product_fee, initial_payment_paid, initial_payment_amount, initial_payment_date, initial_transaction_id, primary_is_smoker, primary_tobacco_date, first_billing_date, next_billing_date, permanent_bill_day, agreed_to_terms/_privacy/_guidelines (+ *_agreed_at), hold_*, refund_*, advisor_first_name/_last_name/_email/_level snapshot |
| `enrollment_steps` | id, organization_id, enrollment_id, step_key, is_completed, completed_at, payload jsonb |
| `enrollment_audit_log` | id, organization_id, enrollment_id, actor_profile_id, action, payload, created_at |
| `plans` | id, organization_id, name, code, product_line, coverage_category, tier, monthly_share, enrollment_fee, iua_amount, max_annual_share, is_active, metadata, custom_fields |
| `memberships` | id, organization_id, member_id, plan_id, advisor_id, membership_number, status (pending/active/terminated/paused), effective_date, end_date, **billing_amount**, billing_currency, billing_frequency, billing_status (ok/delinquent/cancelled), funding_type, primary_reason_for_joining, cancellation_reason, custom_fields |
| `dependents` | exists with name/dob/relationship/status |
| `enrollment_links` | slug, target_url, is_active, max_uses, expires_at, total_visits, unique_visits, total_conversions, conversion_rate |
| `enrollment_link_visits` | session_id, device_type, browser, OS, geo, referrer, UTM, page_views, scroll_depth, interactions jsonb |
| `enrollment_link_conversions` | links visits to enrollments, attribution model, time_to_convert, lifetime_value |
| `enrollment_link_analytics` | daily/weekly/monthly rollups |
| `import_jobs` + `import_job_rows` | CSV import schema (status, raw_data, normalized_data) |

## Routes / API

- CRM: `apps/crm/src/app/crm/enrollment/*` (server actions), `apps/crm/src/app/enrollments/`
- Admin: `apps/admin/src/app/(dashboard)/enrollments/{,/[id]}`
- Portal: `apps/portal/src/app/enrollments/{,/[id]}`, `apps/portal/src/app/enroll/[slug]/`, `apps/portal/src/app/agent/enrollments/`

## Components

- `packages/enrollment/src/components/SelfServe{Household,Intake,PlanSelection,Compliance,Payment}Step.tsx`
- `apps/crm/src/components/enrollment/{steps,wizard}/`
- `apps/crm/src/components/enrollments/create-enrollment-dialog.tsx`

## Services

- `apps/crm/src/lib/sequences/enrollment-service.ts` — **email sequence** processor, NOT the domain enrollment service
- `packages/lib/src/enrollment/{audit,rxPricing,warnings}.ts` — utilities only

## Edge Functions

- None dedicated to enrollment yet.

## Missing vs Saudemax

- No `enrollment_dependents` link table (saudemax pattern: enrollment_id × dependent_id with per-link status/reason)
- No `agreement_signatures` + signature pad + contract PDF
- No `legal_documents` table
- No `inactive_reasons` lookup
- No plan-change service (inactivate old + create new + pro-rata difference for post-20th)
- No auto-trigger creating billing schedule on enrollment becoming approved
- No auto-trigger creating signup commission on enrollment becoming approved
- No "20th-of-month-before-start" billing-date helper function
- Public landing page logic missing on `/enroll/[slug]` (route exists)

---

# BILLING — what exists

## Tables

| Table | Key columns |
|---|---|
| `payment_profiles` | id, organization_id, member_id, authorize_customer_profile_id, authorize_payment_profile_id, payment_type (credit_card/bank_account), last_four, card_type, expiration_date, billing_address (5 cols), is_default, is_active, nickname |
| `billing_schedules` | id, organization_id, enrollment_id, member_id, payment_profile_id, amount, frequency (monthly/quarterly/annual), billing_day (1-28), start_date, end_date, next_billing_date, last_billed_date, status (active/paused/cancelled/completed), pause_reason, paused_at, retry_count, max_retries, last_billing_status |
| `billing_transactions` | id, organization_id, billing_schedule_id, member_id, enrollment_id, payment_profile_id, transaction_type (charge/refund/void/adjustment), amount, processing_fee, net_amount (GENERATED), status (pending/processing/success/failed/voided/refunded), authorize_transaction_id, authorize_response_code, authorize_response_reason, authorize_auth_code, avs_response, cvv_response, error_code, error_message, submitted_at, processed_at, settled_at, billing_period_start, billing_period_end, invoice_number, metadata jsonb |
| `billing_failures` | id, organization_id, billing_schedule_id, billing_transaction_id, member_id, failure_reason, failure_code, amount, retry_attempt, next_retry_date, retry_scheduled, resolved, resolved_at, resolved_by, resolution_notes, resolution_type, member_notified, member_notified_at, notification_count, status |
| `invoices` | id, organization_id, member_id, enrollment_id, invoice_number (auto-INV-YYYY-XXXXXX), period_start, period_end, due_date, subtotal, processing_fee, adjustments, total, amount_paid, balance_due (GENERATED), status (draft/sent/paid/partial/overdue/cancelled/void), line_items jsonb, sent_at, paid_at, pdf_url |

## Services

- `packages/lib/src/billing/billing-service.ts` — **BillingService class** (~850 lines)
  - getOrCreateCustomerProfile, createPaymentProfile, getPaymentProfiles, deletePaymentProfile, setDefaultPaymentProfile, processPayment, processRefund, getTransactions, getBillingSchedules, createBillingSchedule, pauseBillingSchedule, resumeBillingSchedule, cancelBillingSchedule
  - 2.9% credit card processing fee baked in
  - Exponential backoff for retry: 3-14 days
- `packages/lib/src/billing/authorize-net.ts` — **AuthorizeNetService** (createCustomerProfile, createPaymentProfile, chargeCustomerProfile, refundTransaction, deletePaymentProfile)
- `apps/crm/src/lib/integrations/adapters/payments/stripe.ts` — **Stripe adapter** (createCustomer, createPaymentIntent, refundPayment, createSubscription) — not active

## Routes

- Admin: `/billing`, `/billing/list`, `/billing/schedules`, `/billing/transactions`, `/billing/failures`, `/billing/invoices`, `/billing/summary`, `/billing/declined/today`, `/billing/payment-processors`, `/billing/nacha`, `/billing/nacha/{export,import}`
- Portal: `/billing` (member view)

## Edge Functions

- `supabase/functions/process-billing/` — exists
- `supabase/functions/process-payment/` — exists
- `supabase/functions/admin-*`, `send-*`, `flow-runner`, `workflow-processor`, `sla-daemon` — adjacent

## Missing vs Saudemax

- No automated daily billing cron (process-billing exists but not scheduled / not batched-circuit-breaker style)
- No retry processor consuming `billing_failures.next_retry_date`
- No dunning email sequence (attempt 1/2/3/abandoned)
- No invoice PDF generation
- No `billing_automation_config` (singleton) or `billing_job_runs` (audit)
- No trigger syncing `billing_schedules.amount` when enrollment cost changes
- No trigger cancelling future billing when enrollment goes cancelled
- No `price_change_schedules` + `price_change_audit` tables
- No Authorize.Net webhook handler with HMAC validation
- No idempotency-key column on `billing_transactions`

---

# COMMISSIONS — what exists

## Tables

| Table | Key columns |
|---|---|
| `agent_levels` | id, organization_id, name, code, level_rank, min_active_members, max_active_members, min_monthly_enrollments, min_downline_agents, base_commission_multiplier, is_active, color, icon |
| `commission_rates` | id, organization_id, product_id, benefit_type_id, agent_level_id, signup_commission, monthly_commission, annual_commission, signup_commission_percent, monthly_commission_percent, override_commission_percent, override_levels_deep, effective_date, end_date, is_active |
| `commissions` | id, organization_id, advisor_id, enrollment_id, member_id, billing_id, commission_type, source_advisor_id, override_level, base_amount, commission_rate, commission_rate_type, commission_amount, vendor_cost, net_amount, commission_period date, status (pending/approved/paid/reversed/held), status_reason, payment_batch_id, paid_at, payment_method, payment_reference, metadata jsonb |
| `commission_adjustments` | id, organization_id, advisor_id, adjustment_type, amount, description, enrollment_id, commission_id, effective_period, status (pending/approved), approved_by, approved_at, rejection_reason, created_by |
| `advisor_commission_summary` | denormalized rollups: id, organization_id, advisor_id, period_month UNIQUE, total_enrollments, active_members, signup_commissions, monthly_commissions, override_commissions, bonus_commissions, adjustments, clawbacks, gross_commissions, net_commissions, amount_paid, amount_pending |
| `commission_payment_batches` | batch_number (PAY-YYYYMM-###), description, period_start, period_end, payment_date, total_commissions, total_amount, total_advisors, status (draft/approved/processed), approved_by, processed_by |
| `commission_payouts` | per-advisor payout records (existing) |
| `commission_ledger` | id, organization_id, advisor_id, commission_id, amount, product_type, status (available/scheduled/paid/reversed/held), payout_batch_id, payout_id, reversed_at, reversed_reason, UNIQUE per commission |
| `payout_item_ledger_links` | links multiple ledger entries to a single payout item |

**advisors table extensions:** agent_level_id, commission_eligible, commission_hold, commission_hold_reason, enrollment_code (UNIQUE), total_lifetime_commissions, current_month_commissions, pending_commissions

## Services

- `packages/lib/src/commissions/commission-service.ts` — **CommissionService**
  - getAdvisorTier, calculateCommission, createCommissionTransaction, generateOverrides (uses `get_advisor_upline` RPC for upline chain — optimized single-roundtrip)
- `packages/lib/src/commissions/payout-compliance.ts` — holds/safeguards
- `apps/crm/src/lib/payouts/providers/{stripe-connect,ach,manual}.ts` — payout providers with shared interface

## Database functions

- `calculate_enrollment_commission(enrollment_id, commission_type)`
- `get_advisor_upline(advisor_id, max_levels)` — recursive CTE
- `get_advisor_downline_count(advisor_id)`
- `trg_commission_to_ledger()` — auto-creates ledger entries on commission insert/status change
- `create_payout_batch(org_id, period_start, period_end, description)` — advisory-lock-protected batch creator

## Routes / API

- Admin pages: `/commissions`, `/commissions/list`, `/commissions/summary`, `/commissions/transactions`, `/commissions/tiers{,/new,/[id]}`, `/commissions/payouts`
- CRM API: `/api/commissions/{,summary-by-type,ledger,hierarchy,audit,fraud-flags{,/[flagId]},reversals}`, `/api/commissions/payouts/{generate,[batchId]/{,approve,reconcile,anomalies,logs}}`
- Portal: `/agent/commissions`, `/agent/enrollments`

## Missing vs Saudemax

- No DB trigger inserting signup commission on enrollment becoming approved
- No monthly accrual cron (calculateCommission exists, no scheduler)
- generateOverrides exists but is not invoked from any scheduled job
- No trigger cancelling pending commissions on enrollment cancel
- No tier auto-recalculation on member-count change (capability via `get_advisor_downline_count` but no trigger)
- No payout batch UI fully end-to-end (RPC + APIs exist; UI to drive the full lifecycle missing)
- No agent-portal view splitting own commissions vs override receipts cleanly
- No adjustment UI wired to the existing `commission_adjustments` table

---

# CROSS-CUTTING

## Records model

- `crm_records` (id uuid, org_id, module_id, owner_id, title, status, stage, email, phone, system jsonb, data jsonb, search tsvector) — Zoho-style flexible storage
- Modules: contacts, leads, deals, opportunities, plus dependents module
- `crm_modules`, `crm_fields`, `crm_views`, `crm_layouts`

## Multi-tenancy / RLS

- `organizations` (id, name, slug UNIQUE, settings)
- `organization_members` links profiles to orgs with roles
- `profiles` (user_id → auth.users, organization_id, role)
- RLS helper functions: `get_user_organization_id()`, `get_user_role()`, `get_user_advisor_id()`
- Multi-org tenancy uses `organization_members` for admin + CRM; portal is still single-org

## Production tenant

- PIFH org_id = ac6e7228-…
