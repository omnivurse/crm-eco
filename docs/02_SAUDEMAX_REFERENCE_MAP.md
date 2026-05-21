Perfect! Now I have a comprehensive understanding of the system. Let me create an exhaustive structured map of the three subsystems:

---

# EXHAUSTIVE SYSTEM ARCHITECTURE MAP: SAUDEMAX ADMIN SYSTEM

## TECH STACK & OVERVIEW

**Framework & Architecture:**
- Frontend: React 18 + Vite + React Router v6 (SPA)
- Backend: Supabase (PostgreSQL + Edge Functions in Deno/TypeScript)
- Payment: Authorize.Net (production), FTNI (alternative processor)
- Email: Resend (via edge functions)
- Authentication: Supabase Auth (JWT)
- Real-time: PostgreSQL triggers + RLS policies
- Styling: Tailwind CSS + Framer Motion

**Folder Structure:**
```
src/
├── app/                    # Bootstrap (main.tsx, App.tsx)
├── core/auth/              # AuthContext, ProtectedRoute, auth guards
├── features/
│   ├── admin/              # Admin portal (dashboard, members, agents, products, billing, commissions, reports)
│   ├── agent/              # Agent portal (downline, commissions, reporting)
│   ├── auth/               # SignIn, SignUp, ResetPassword
│   └── enrollment/         # Public enrollment flows (saudemax & mpb brands)
├── lib/                    # Services (billing, payment, commission, enrollment)
├── components/             # Shared UI (modals, tables, forms)
├── routes/                 # AppRouter composition
└── pages/                  # Legacy pages
supabase/
├── migrations/             # 305+ SQL migration files (incremental DB schema)
└── functions/              # 40+ Edge Functions (payment, billing, enrollment, email)
```

---

# SUBSYSTEM 1: ENROLLMENT SYSTEM

## 1.1 DATABASE SCHEMA (CORE TABLES)

### Enrollment Tables

| Table | Key Columns | Relationships | Purpose |
|-------|----------|---------------|---------|
| **enrollments** | `id` (uuid), `member_id` (text FK), `product_id` (uuid FK), `agent_id` (int FK), `iua_id` (uuid FK), `plan_type` (text), `monthly_cost` (numeric), `status` ('Active'\|'Inactive'\|'Future Active'\|'Cancelled'), `start_date` (date), `inactive_date` (date), `inactive_reason` (text), `initial_payment_paid` (bool), `enrollment_date` (timestamp), `primary_is_smoker` (bool), `source` (text) | FK: members, products, agents, iua_levels | Core enrollment record; tracks member's plan, cost, and lifecycle. Status changes trigger billing/commission cancellation. |
| **enrollment_dependents** | `id` (uuid), `enrollment_id` (uuid FK), `dependent_id` (uuid FK), `relationship` (text), `status` ('Active'\|'Inactive'), `inactive_date` (date), `inactive_reason` (text) | FK: enrollments, dependents | Links dependents (spouse/children) to specific enrollments. Allows partial plan changes (add/remove spouse). |
| **dependents** | `id` (uuid), `member_id` (text FK), `first_name`, `last_name`, `middle_name`, `relationship`, `date_of_birth`, `ssn` (encrypted), `status` | FK: members | Master list of all dependents for a member. |
| **products** | `id` (uuid), `name`, `description`, `status` (bool), `vendor_cost_type` ('per_plan_per_month'\|'flat_per_membership'), `vendor_cost_amount` (numeric) | — | Health plans offered (MPB Health, Saudemax, etc.). |
| **product_benefit_types** | `id` (uuid), `product_id` (uuid FK), `name` (text, e.g., "Member + Spouse"), `description` | FK: products | Plan tiers (Member Only, Member+Spouse, Member+Family, etc.). |
| **product_pricing_matrices** | `id` (uuid), `product_id` (uuid FK), `benefit_type_id` (uuid FK), `age_bracket_id` (uuid FK), `amount` (numeric), `effective_date` (date), `status` ('active'\|'inactive') | FK: products, benefit_types, age_brackets | Monthly premium by age bracket and plan tier. Supports historical pricing changes. |
| **product_iua_levels** | `id` (uuid), `product_id` (uuid FK), `name`, `amount` (numeric), `description` | FK: products | Indemnity/deductible levels. |
| **iua_levels** | `id` (uuid), `amount` (numeric) | — | IUA/indemnity amounts. |
| **enrollment_logs** | `id` (uuid), `enrollment_id` (uuid FK), `action_type` ('created'\|'updated'\|'status_change'\|'billing_sync'\|etc.), `action_data` (jsonb), `created_by` (uuid FK users), `created_at` (timestamp) | FK: enrollments, users | Audit trail of all enrollment changes; tracks who changed what and when. |
| **agreement_signatures** | `id` (uuid), `enrollment_id` (uuid FK), `agreement_type` (text), `signature_data` (jsonb), `signed_date` (timestamp) | FK: enrollments | Stores signed agreements/contracts for compliance. |

### Related Master Tables

| Table | Key Columns | Purpose |
|-------|----------|---------|
| **members** | `id` (text, e.g., "MPB001"), `first_name`, `last_name`, `date_of_birth`, `email`, `phone`, `address`, `city`, `state`, `zip`, `ssn` (encrypted), `status` ('active'\|'inactive'), `agent_id` (int FK agents) | Member master record. Links to all enrollments, dependents, payments. SSN encrypted for HIPAA compliance. |
| **agents** | `id` (int, 6-digit), `first_name`, `last_name`, `email`, `phone`, `status` ('active'\|'inactive'\|'suspended'), `role` ('Agent'\|'Agency'), `parent_agent_id` (int FK), `enrollment_code` (unique), `commission_eligible` (bool) | Agent/broker hierarchy. Parent_agent_id enables multi-level structure. |
| **users** | `id` (uuid), `email`, `full_name`, `role` ('super_admin'\|'admin'\|'manager'\|'agent'), `status` ('active'\|'inactive'), `user_metadata.userType` | Supabase auth users; controls access to admin/agent portals. |

### Contract & Agreement Tables

| Table | Key Columns | Purpose |
|-------|----------|---------|
| **legal_documents** | `id` (uuid), `document_type` (text), `document_name`, `content_html` (text), `status` ('draft'\|'active'), `created_at` | Stores HTML/PDF templates for enrollment agreements, disclosures. |
| **enrollment_agreements** | `id` (uuid), `enrollment_id` (uuid FK), `agreement_type`, `file_path` (text, in Supabase Storage), `signed_by`, `signed_date`, `pdf_generated_at` | Links signed PDF contracts to enrollments. |

---

## 1.2 TYPESCRIPT INTERFACES (KEY TYPES)

**File:** `/src/lib/unifiedEnrollmentService.ts` & related

```typescript
interface UnifiedEnrollmentParams {
  memberId: string;
  productId: string;
  agentId: number;
  planType: string;
  iuaId: string;
  monthlyCost: number;
  primaryIsSmoker: boolean;
  dependentsToAdd: string[]; // dependent_ids
  dependentsToInactivate?: { enrollmentDependentId: string; reason: string }[];
  existingEnrollmentId?: string; // For plan changes
  enrollmentInactiveReason?: string;
  startDate?: string; // Optional, defaults to first of next month
  allowNextMonthWithDifferencePayment?: boolean; // For post-20th plan changes
}

interface UnifiedEnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  isPlanChange?: boolean;
  oldEnrollmentId?: string;
  differencePaymentAmount?: number;
  error?: string;
}

interface Enrollment {
  id: uuid;
  member_id: text;
  product_id: uuid;
  agent_id: integer;
  plan_type: text;
  monthly_cost: numeric;
  status: 'Active' | 'Inactive' | 'Future Active' | 'Cancelled';
  start_date: date;
  inactive_date: date | null;
  inactive_reason: text | null;
  initial_payment_paid: boolean;
  primary_is_smoker: boolean;
  enrollment_date: timestamp;
  iua_id: uuid;
  source: text; // 'agent_portal', 'website', 'admin', etc.
}

interface EnrollmentDependent {
  id: uuid;
  enrollment_id: uuid;
  dependent_id: uuid;
  relationship: string;
  status: 'Active' | 'Inactive';
  inactive_date: date | null;
  inactive_reason: text | null;
}
```

---

## 1.3 ENROLLMENT FLOW (HAPPY PATH)

### New Enrollment Flow (Public Landing → Signed Contract)

**Flow Step 1: Landing Page & Agent Link**
- User lands on `/enroll/{agentId}` or `/enroll/{agentId}/landing`
- Routes: `EnrollmentLandingRouter` (file: `/src/features/enrollment/pages/EnrollmentLandingRouter.tsx`)
- Displays hero, benefits, FAQs, testimonials
- Agent code in URL is stored for commission tracking

**Flow Step 2: Product Selection**
- Route: `/enroll/{agentId}/product/{productId}` or `/enroll/{agentId}/landing/product/{productId}`
- Component: `ProductEnrollmentRouter` → `ProductEnrollment.tsx` (Saudemax) or `ProductEnrollmentMPB.tsx` (MPB)
- Fetches product pricing matrix by age/plan type
- User selects plan (Member Only, Member+Spouse, Member+Family)

**Flow Step 3: Multi-Step Enrollment Form** (SaúdeMax variant)
- **Component:** `EnrollmentFlow.tsx` with step states
- **Step 1 - Personal Info:** `PersonalInfoForm.tsx` → first/last name, DOB, email, phone
- **Step 2 - Address & Dependents:** `AddressDependentsForm.tsx` → address, spouse (if plan requires), children (if plan requires)
- **Step 3 - Agreement:** `LegalAgreementStep.tsx` → signature pad, contract PDF download
- **Step 4 - Review & Submit:** `ReviewSubmitForm.tsx` → summary, payment method entry (ACH/Card)
- Form state managed via `unifiedEnrollmentService`
- Validates DOB range (typically 18–99 years old)

**Flow Step 4: Initial Payment Collection**
- Component: `ReviewSubmitForm.tsx` or embedded payment form
- Payment processor: Authorize.Net or FTNI (via edge function `/functions/v1/payment`)
- Collects card or ACH details
- **CRITICAL:** No PCI data stored locally; passed directly to payment gateway
- Creates `payment_profiles` record in Supabase (gateway profile ID only, not card data)
- Marks `enrollments.initial_payment_paid = true` only on successful charge

**Flow Step 5: Database Insertion & Triggers**
```
User clicks "Submit" 
  ↓
POST /enroll request → ProductEnrollment component → unifiedEnrollmentService.createOrChangeEnrollment()
  ↓
Supabase RPC call: insert into enrollments table
  ↓
Trigger fires: generate_billing_records()
  ├── Creates one-time "Enrollment Fee" billing record (if extra cost exists)
  ├── Creates monthly billing schedule
  └── Creates annual billing record (if separate annual cost)
  ↓
Trigger fires: trigger_signup_commission() 
  └── Creates "signup" commission record for agent
  ↓
Edge function: generate-enrollment-contract
  ├── Pulls legal template from legal_documents table
  ├── Renders HTML with member/plan details
  ├── Converts to PDF via headless browser
  ├── Uploads to Supabase Storage: /enrollments/{enrollment_id}/contract.pdf
  └── Updates agreement_signatures table
  ↓
Edge function: notify-new-enrollment (async)
  └── Sends confirmation email to member + admin
  ↓
Front-end: Redirects to /enrollment-success?enrollment_id={id}
```

**Flow Step 6: Success Page & Contract Download**
- Route: `/enrollment-success`
- Component: `EnrollmentSuccess.tsx`
- Shows "Enrollment Complete" message, plan details
- Provides download link for signed contract (from Supabase Storage)
- Displays next billing date (20th of month before start)

### Plan Change Flow (Member Modifies Existing Enrollment)

**Trigger:** Member upgrades from "Member Only" → "Member+Family"
- **Service:** `unifiedEnrollmentService.createOrChangeEnrollment()` with `existingEnrollmentId`
- **Logic:**
  1. **Inactivate old enrollment** → set `status='Inactive'`, `inactive_date=end_of_month`, `inactive_reason='plan_change_add_family'`
  2. **Inactivate removed dependents** → e.g., if plan change removes children
  3. **Create new enrollment** → same member, new plan, start date = 1st of next month, duplicate active dependents
  4. **Keep dependents where applicable** → e.g., spouse remains if upgrading to add children
  5. **Trigger billings update** → old enrollment's future monthly billing cancels; new enrollment gets new schedules
  6. **Handle timing constraint:** If today >= 20th, cannot start next month (billing already processed). Must start month-after-next or pay difference.
  7. **Create price difference billing** (if `allowNextMonthWithDifferencePayment=true`) for pro-rata adjustment

---

## 1.4 FORMS, VALIDATION & STATE MANAGEMENT

### Enrollment Form Components

| Component | File Path | Responsibility |
|-----------|-----------|-----------------|
| **PersonalInfoForm** | `src/features/enrollment/saudemax/components/PersonalInfoForm.tsx` | Collects member name, DOB, email, phone; validates DOB range |
| **AddressDependentsForm** | `src/features/enrollment/saudemax/components/AddressDependentsForm.tsx` | Address entry; conditional dependent fields based on plan_type; shows spouse/children selectors |
| **PlanSelectionForm** | `src/features/enrollment/saudemax/components/PlanSelectionForm.tsx` | Renders plan cards from pricing matrix; calculates cost based on member age + selected plan |
| **LegalAgreementStep** | `src/features/enrollment/saudemax/components/LegalAgreementStep.tsx` | Displays agreement HTML, signature pad (canvas drawing), PDF preview download |
| **ReviewSubmitForm** | `src/features/enrollment/saudemax/components/ReviewSubmitForm.tsx` | Summary of all collected data; payment method collection (Card/ACH forms); final "Submit" button |
| **AgreementQuestionsForm** | `src/features/enrollment/mpb/components/AgreementQuestionsForm.tsx` | MPB variant: dynamic questions from `agreement_questions` table |

### Validation Rules

**PersonalInfoForm:**
- First/Last name: non-empty, ≥2 characters
- DOB: valid date, within 18–99 years old (product-specific)
- Email: valid format, no duplicates for new members
- Phone: optional, valid format if provided

**AddressDependentsForm:**
- Address: required (state code matched against `us_states` lookup)
- Dependent selection:
  - Plan = "Member Only" → no dependents required
  - Plan = "Member + Spouse" → exactly 1 spouse (or verified none)
  - Plan = "Member + Children" → 1+ children
  - Plan = "Member + Family" → 1 spouse + 1+ children

**PlanSelectionForm:**
- Plan type selected (from product's `product_benefit_types`)
- Monthly cost calculated by `computePricingAgeBracketMemberAge()` (matches DOB to age bracket in pricing matrix)

**LegalAgreementStep:**
- Signature captured (not empty canvas)
- User confirms understanding of plan terms

**ReviewSubmitForm:**
- Payment method selected
- Card: name, number (16 digits, Luhn check), exp, CVV
- ACH: account, routing, account type
- Billing address (optional, defaults to enrolled address)

### State Management

- **React Hooks:** `useState` for form data, errors, step index
- **No Redux/Zustand** (simple flow, no shared state needed)
- **useContext:** `LanguageContext` for i18n (Spanish/Portuguese support)
- **Custom service:** `unifiedEnrollmentService` handles DB writes
- **Error boundaries:** `AgreementStepErrorBoundary` wraps signature pad step

---

## 1.5 STATUS TRANSITIONS & STATE MACHINE

### Enrollment Lifecycle

```
┌─────────────────┐
│  Draft/Pending  │ (not created yet, user filling form)
└────────┬────────┘
         │ User completes all steps + payment succeeds
         ↓
┌─────────────────┐
│  Active         │ (start_date reached, eligible for billing)
└────────┬────────┘
         │ (monthly/annual billings run)
         │
         ├─── Plan Change Requested ───→ Old enrollment marked Inactive (inactive_date = end-of-month)
         │                                New enrollment created (status=Active, start_date=1st of next month)
         │
         └─── Cancellation Requested ───→ Marked Inactive (status=Inactive, inactive_reason='cancelled_by_member')
                                          ├── Future billing schedules → status='cancelled'
                                          └── Commissions marked cancelled

┌──────────────────────────┐
│  Future Active           │ (start_date is in future; not yet active)
└──────────┬───────────────┘
           │ start_date reached (via daily cron or manual trigger)
           ↓
        Active
```

### Status Values & Meanings

| Status | Condition | Triggers | Billing Effect |
|--------|-----------|----------|-----------------|
| **Active** | Enrollment is current and eligible for charges | Monthly/annual billings run; commissions accrue | Schedule active, charges processed |
| **Inactive** | Enrollment ended (cancellation, plan change, or age-out) | Cancels future billings; ends commission accrual | Schedules → status='cancelled' |
| **Future Active** | Enrollment created but start_date not yet reached | Awaiting first billing date | Schedules exist but marked 'paused' until start_date |
| **Cancelled** | Explicitly terminated by member or admin | Same as Inactive; more specific intent | All future charges cancelled |

### Inactive Reasons (Audit Trail)

**File:** `/src/lib/inactiveReasons.ts`

```typescript
INACTIVE_REASONS = {
  PLAN_CHANGE_ADD_SPOUSE: 'plan_change_add_spouse',
  PLAN_CHANGE_REMOVE_SPOUSE: 'plan_change_remove_spouse',
  PLAN_CHANGE_ADD_CHILD: 'plan_change_add_child',
  PLAN_CHANGE_REMOVE_CHILD: 'plan_change_remove_child',
  PLAN_CHANGE_ADD_FAMILY: 'plan_change_add_family',
  PLAN_CHANGE_TO_MEMBER_ONLY: 'plan_change_to_member_only',
  PLAN_CHANGE_IUA: 'plan_change_iua',
  PLAN_CHANGE: 'plan_change',
  MEMBER_REQUESTED_CANCELLATION: 'member_requested_cancellation',
  NON_PAYMENT: 'non_payment',
  AGE_OUT: 'age_out',
  ADMIN_CANCELLATION: 'admin_cancellation',
  // ...and more
};
```

---

## 1.6 MULTI-TENANCY & AGENT-ORG SCOPING

### Agent Hierarchy

| Concept | Implementation | Example |
|---------|-----------------|---------|
| **Agent** | `agents` table, `id` = 6-digit integer (e.g., 100001) | Roberto Silva (100001) - Agency |
| **Parent Agent** | `agents.parent_agent_id` = int FK to agents | Maria Santos (100002) has parent_agent_id=100001 |
| **Hierarchy Depth** | Recursive; no depth limit | Roberto → Maria → Ana → (unlimited descendants) |
| **Commission Split** | Parent earns "override" on child's enrollments | If Maria (Advisor level) signs a member, Roberto (Agency) earns override |
| **Agent Products** | `agent_product_access` table: agent_id → product_id | Each agent can access assigned products |
| **Sub-Agent Enrollments** | When agent enrolls a member, `enrollments.agent_id = child_agent_id` | Member enrolled by Maria (100002) has agent_id=100002 |

### Enrollment Scoping

- **Member created by agent** → `members.agent_id = agent_id`
- **Enrollment belongs to agent** → `enrollments.agent_id = agent_id`
- **Agent sees own members/enrollments** → RLS policy filters by `agents.id = auth.user.agent_id`
- **Admin sees all** → RLS policy allows superadmin/admin full access

### Agent Portal (Multi-Agent View)

**File:** `/src/features/agent/pages/AgentDownline.tsx`
- Agent logs in → sees their direct downline (sub-agents)
- Can click to view sub-agent's downline (cascade view)
- Can see all members enrolled by self + entire downline tree
- Commission report shows own + override commissions

---

## 1.7 CONTRACT/AGREEMENT SIGNING & STORAGE

### Contract Generation Flow

**File:** `supabase/functions/generate-enrollment-contract/index.ts`

1. **Trigger:** After enrollment created + initial payment approved
2. **Input:** 
   - Enrollment ID
   - Member details (name, DOB, address)
   - Plan details (type, coverage period, premium)
3. **Execution:**
   - Fetch legal template from `legal_documents` table (by product + agreement_type)
   - Render template HTML with mustache-style variable replacement: `{{member_name}}`, `{{monthly_cost}}`, etc.
   - Convert HTML → PDF via headless browser (Puppeteer or similar service)
   - Upload PDF to Supabase Storage: `/enrollments/{enrollment_id}/enrollment-contract.pdf`
   - Insert record in `agreement_signatures` table
4. **Storage:**
   - Bucket: `contracts` (Supabase Storage)
   - Path: `enrollments/{enrollment_id}/enrollment-contract.pdf`
   - Access: Private RLS; only authenticated users + admin can download

### Signature Pad Component

**File:** `/src/components/SignaturePad.tsx`

```typescript
interface SignaturePadProps {
  onCapture: (signatureData: string) => void; // Base64 PNG of signature
  disabled?: boolean;
}
```

- Canvas-based drawing
- Captures strokes as user draws
- Returns Base64 PNG on "Done"
- Stored in `agreement_signatures.signature_data` (JSONB) with PNG base64

### Contract Download & Display

**File:** `/src/components/EnrollmentContractDownload.tsx`
- Displays "Download Contract" button after enrollment success
- Link: Direct download from Supabase Storage
- Fallback: If PDF not yet generated, shows "Generating..." with auto-refresh

---

## 1.8 FRONT-END ROUTES & ENTRY POINTS

### Public Routes (No Auth Required)

| Route | Component | File |
|-------|-----------|------|
| `/enroll/{agentId}` | EnrollmentLandingRouter | `features/enrollment/pages/EnrollmentLandingRouter.tsx` |
| `/enroll/{agentId}/landing` | MPBLandingPage | `features/enrollment/mpb/MPBLandingPage.tsx` |
| `/enroll/{agentId}/product/{productId}` | ProductEnrollmentRouter | `features/enrollment/pages/ProductEnrollmentRouter.tsx` |
| `/enrollment-success` | EnrollmentSuccessRouter | `features/enrollment/pages/EnrollmentSuccessRouter.tsx` |

### Admin Routes (Enrollment Management)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/admin/enrollments` | Enrollments | List all enrollments; filter by status, product, agent; search by member |
| `/admin/enrollments/{enrollmentId}` | EnrollmentEdit | Edit enrollment: cost, plan, dependents, dates; view billing schedules; perform plan changes |
| `/admin/enrollment-setup` | EnrollmentSetup | Admin one-off enrollment creation (no form, direct data entry) |
| `/admin/enrollment-analytics` | EnrollmentAnalytics | Charts: enrollments by product, status, month; revenue trends |
| `/admin/enrollment-logs` | EnrollmentLogs | Audit trail: all enrollment changes with user, timestamp, reason |

---

## 1.9 INTEGRATION POINTS & TRIGGERS

### Automatic Triggers on Enrollment Actions

| Action | Trigger Function | Effect |
|--------|------------------|--------|
| **Enrollment created (initial_payment_paid=true)** | `generate_billing_records()` | Creates billing records for one-time fees + monthly/annual schedules |
| | `trigger_signup_commission()` | Creates "signup" commission for enrolling agent |
| **Enrollment status → Inactive** | `update_billing_records()` | Cancels all pending billing records for that enrollment |
| **Enrollment monthly_cost updated** | `sync_billing_schedule_on_enrollment_update()` | Updates all active monthly billing schedules to new cost |
| **Enrollment start_date updated** | `update_billing_records()` | Recalculates due dates for billing schedules |

### Edge Functions Invoked During Enrollment

| Function | Trigger | Responsibility |
|----------|---------|-----------------|
| `payment` | Form submission (ReviewSubmitForm) | Process initial payment via Authorize.Net; return success/decline |
| `generate-enrollment-contract` | After enrollment + payment success | Generate & upload contract PDF |
| `notify-new-enrollment` | After contract generated | Send welcome email to member + notification to admin |
| `send-mpb-enrollment-pending` | After enrollment created (for MPB brand) | Notify member agreement is pending signature |

### Webhook Integrations

- **Authorize.Net webhooks** → `supabase/functions/payment-webhook/index.ts`
  - Listens for `payment.auth`, `payment.capture`, `payment.void`, `payment.refund` events
  - Updates `payment_transactions` table
  - Marks `billing` records as "Paid" or "Failed"
  - Triggers email notifications (receipt or failure)

---

## 1.10 KEY GOTCHAS & NON-OBVIOUS BEHAVIORS

### Billing Date = 20th (Month BEFORE Start Date)

**CRITICAL:** If member starts coverage 2025-05-01, first billing runs on **2025-04-20** (not May 20).
- Annual billing similarly: if start 2025-05-01, annual charge on 2026-04-20
- See `billingService.setupRecurringBilling()` and `unifiedEnrollmentService.getBillingDateForStart()`

### Plan Change After 20th of Month

**Constraint:** If today >= 20th and plan change targets next month, billing already ran.
- **Solution 1:** Force start to month-after-next (e.g., today=May 25 → start July 1)
- **Solution 2:** Allow next-month start + charge difference: `allowNextMonthWithDifferencePayment=true`
  - If old plan $150/mo, new plan $200/mo, starts May 1 (today=May 25)
  - Bill: $50 × 11 days remaining in May = ~$18 additional charge created

### Enrollment Dependents Inactive Reasons (Per-Dependent)

**When plan changes from "Member+Spouse+2Children" → "Member+Family":**
- Old enrollment marked Inactive with `inactive_reason='plan_change_add_family'`
- Each removed dependent has **individual** `enrollment_dependent` record marked Inactive:
  - `inactive_reason='removing_child_1'`, `inactive_reason='removing_child_2'`, etc.
- This granularity matters for compliance audits

### Pricing Resolution (Age Bracket Matching)

**File:** `src/features/enrollment/pricingResolution.ts`

```typescript
function computePricingAgeBracketMemberAge(dob: string, productId: uuid) {
  // Calculate member age today
  const age = Math.floor((today - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  
  // Fetch product's pricing matrix age brackets
  // Find bracket where bracket.min_age <= age < bracket.max_age
  // Return pricing for that bracket + selected benefit_type
  
  // GOTCHA: Age bracket typically changes annually.
  // If member born Jan 1990, today May 2025: age = 35
  // On Jan 1, 2026: age = 36 (bracket might change)
}
```

Member's premium may auto-adjust on birthday (if annual pricing runs). Some products don't, depending on rules.

### Contract PDF Generation Timing

**Edge function is async; PDF may not be ready immediately after enrollment.**
- On success page, shows "Generating..." initially
- Auto-fetches PDF every 2 seconds with `setInterval`
- If PDF > 30s to generate, displays fallback: "Contract will be emailed to you"
- This matters for immediate download requests

---

---

# SUBSYSTEM 2: BILLING SYSTEM

## 2.1 DATABASE SCHEMA (BILLING TABLES)

### Core Billing Tables

| Table | Key Columns | Relationships | Purpose |
|-------|----------|---------------|---------|
| **billing_schedules** | `id` (uuid), `enrollment_id` (uuid FK), `member_id` (text FK), `billing_type` ('monthly'\|'annual'), `amount` (numeric), `next_billing_date` (date), `status` ('active'\|'paused'\|'cancelled'), `created_at`, `updated_at` | FK: enrollments, members | Recurring billing schedule. One per enrollment + billing type. Controls when charges run. |
| **billing** | `id` (uuid), `enrollment_id` (uuid FK), `member_id` (text FK), `product_id` (uuid FK), `billing_type` ('Monthly'\|'Yearly'\|'One-time'), `description` (text), `amount` (numeric), `status` ('Pending'\|'Paid'\|'Failed'\|'Cancelled'), `due_date` (date), `paid_at` (timestamp), `payment_method` (text), `transaction_id` (text), `error_message` (text), `notes` (text) | FK: enrollments, members, products | Individual billing record (invoice). Created by billing processor or manual admin action. |
| **billing_failures** | `id` (uuid), `billing_schedule_id` (uuid FK), `enrollment_id` (uuid FK), `member_id` (text FK), `billing_type` (text), `amount` (numeric), `failure_reason` (text), `retry_count` (int), `next_retry_date` (date), `max_retries` (int, default 3), `status` ('pending'\|'resolved'\|'abandoned'), `created_at`, `updated_at` | FK: billing_schedules, enrollments | Tracks failed payment attempts; retry logic (max 3 retries, spaced by days). |
| **payment_profiles** | `id` (uuid), `member_id` (text FK), `customer_profile_id` (text), `payment_profile_id` (text), `card_last4` (text), `card_type` (text), `expiration_date` (text), `is_default` (bool), `status` ('active'\|'inactive'\|'expired'), `created_at`, `updated_at` | FK: members | Payment method stored with Authorize.Net. `customer_profile_id` + `payment_profile_id` are gateway identifiers, not sensitive card data. |
| **payment_transactions** | `id` (uuid), `member_id` (text FK), `enrollment_id` (uuid FK), `billing_id` (uuid FK), `transaction_id` (text), `transaction_type` ('charge'\|'refund'\|'void'\|'auth'\|'capture'), `amount` (numeric), `status` ('pending'\|'approved'\|'declined'\|'error'\|'held_for_review'), `response_code` (text), `response_message` (text), `auth_code` (text), `avs_response`, `cvv_response`, `created_at`, `updated_at` | FK: members, enrollments, billing | Full transaction log; every payment attempt recorded (approved or declined). |
| **billing_automation_config** | `id` (int, =1), `enabled` (bool), `run_day_of_month` (int), `run_hour_utc` (int), `last_run_date`, `last_run_at`, `updated_at` | — | Global config: when automated billing runs. E.g., day=20, hour=14 UTC → runs every 20th at 2pm UTC. |
| **billing_job_runs** | `id` (uuid), `started_at` (timestamp), `completed_at`, `status` ('running'\|'success'\|'failed'\|'skipped'), `trigger_source` (text, e.g., 'cron'\|'manual'), `target_date` (date), `skip_reason` (text), `details` (text), `summary` (jsonb), `error_message` (text), `charge_feed_id` (uuid FK) | FK: billing_charge_feeds | Log of each billing processor run; tracks success/failure + count details. |
| **billing_charge_feeds** | `id` (uuid), `name`, `slug`, `organization_id` (uuid FK), `enabled` (bool), `timezone` (text), `charge_day_of_month` (int), `charge_hour` (int), `product_ids` (uuid[]), `last_run_date`, `last_run_at`, `created_at`, `updated_at` | FK: organizations | Billing schedule per org/product mix. Multi-tenancy support. |
| **price_change_schedules** | `id` (uuid), `product_id` (uuid FK), `scheduled_date` (date), `status` ('pending'\|'processing'\|'completed'\|'failed'\|'cancelled'), `old_pricing_snapshot` (jsonb), `new_pricing_snapshot` (jsonb), `affected_enrollments_count` (int), `processed_count`, `failed_count`, `created_by` (uuid FK users), `executed_by`, `executed_at`, `error_log` (jsonb), `notes` (text) | FK: products, users | Tracks all scheduled price changes across active enrollments. |
| **price_change_audit** | `id` (uuid), `schedule_id` (uuid FK), `enrollment_id` (uuid FK), `member_id` (text FK), `billing_schedule_id` (uuid FK), `old_monthly_amount`, `new_monthly_amount`, `old_age_bracket`, `new_age_bracket`, `change_reason`, `applied_by` (uuid FK), `applied_at`, `notification_sent` (bool), `notification_sent_at` | FK: price_change_schedules, enrollments, billing_schedules, users | Audit record per enrollment affected by price change; immutable. |

### Related Payment Tables

| Table | Key Columns | Purpose |
|-------|----------|---------|
| **payment_subscriptions** | `id` (uuid), `member_id` (text FK), `enrollment_id` (uuid FK), `subscription_id` (text, from gateway), `name`, `amount`, `interval_length`, `interval_unit` ('days'\|'months'\|'years'), `start_date`, `status` ('active'\|'suspended'\|'cancelled'\|'expired'), `next_billing_date`, `past_occurrences`, `created_at`, `updated_at` | FK: members, enrollments | Subscription record from Authorize.Net (rarely used in this system; more for future API integration). |
| **payment_webhooks** | `id` (uuid), `event_type` (text), `event_id` (text), `payload` (jsonb), `processed` (bool), `processing_error` (text), `created_at` | — | Stores incoming Authorize.Net webhook events; queue for processing. |

---

## 2.2 BILLING PROCESSOR FLOW (MONTHLY CHARGING)

### Automatic Billing Trigger (Daily Cron)

**File:** `supabase/functions/billing-processor/index.ts`

**Trigger:** Runs daily at configured time (default: 20th of month, 14:00 UTC)

**Execution Path:**

```
1. Cron invokes: POST /functions/v1/billing-processor
   ├── Input: action='process_due_payments', target_date=YYYY-MM-DD, force=bool
   └── Authorization: Service role key (backend-only)

2. Query: SELECT * FROM billing_schedules 
   WHERE status='active' AND next_billing_date <= target_date

3. For each schedule:
   a. Fetch enrollment (status='Active' or 'Future Active')
   b. Fetch member (get payment_profile_id, customer_profile_id)
   c. Batch charges in groups of 10 (rate limiting: 500ms delay between requests)
   
4. For each charge:
   a. Call Authorize.Net API: charge customer profile
      ├── POST https://secure.authorize.net/xml/v1/request.json
      ├── Body: { createTransactionRequest: { transactionRequest: { transactionType: 'authCapturTransaction', ... } } }
      └── Wait for response: approved/declined/error
   
   b. Log to payment_transactions table (regardless of result)
   c. If approved:
      ├── Create/update billing record: status='Paid', paid_at=now()
      ├── Update billing_schedule: next_billing_date += 1 month
      └── Send receipt email
   
   d. If declined/error:
      ├── Create billing record: status='Failed', error_message=response
      ├── Insert billing_failures record: status='pending', retry_count=0, next_retry_date=today+1
      └── Send failure email

5. Circuit Breaker:
   ├── Open after 5 consecutive API failures
   ├── Stops processing, logs alarm
   ├── Auto-recovery: retry after 30 seconds

6. Response Summary:
   {
     success: true,
     processed: 72,
     failed: 0,
     total_amount: 26311.00,
     duration_ms: 36000,
     batches: 8,
     circuit_breaker_triggered: false
   }
```

### Key Features

| Feature | Details |
|---------|---------|
| **Batch Size** | 10 per batch; 8 batches = 80 total max per run |
| **Rate Limit** | 500ms delay between API calls; Authorize.Net limit ~500 req/min |
| **Retry Logic** | Failed billing → retry up to 3 times (days 1, 2, 3 after failure) |
| **Circuit Breaker** | Auto-stop after 5 API failures in sequence; prevents cascading |
| **Idempotency** | Each charge attempt has UUID idempotency key; duplicate calls ignored |
| **Notifications** | Email sent for success (receipt) + failure (payment failed, retry info) |
| **Skipping Logic** | Skips: inactive enrollments, cancelled schedules, members without payment profile |

---

## 2.3 BILLING OPERATIONS: ADMIN VIEWS & MANUAL ACTIONS

### Admin Billing Pages

| Page | File Path | Functionality |
|------|-----------|----------------|
| **Billing Dashboard** | `/src/features/admin/pages/Billing.tsx` | High-level: total revenue pending, next billing date, # of failures, quick links to detailed pages |
| **Billing Schedules** | `/src/features/admin/pages/BillingSchedules.tsx` | Table of all active billing schedules; filter by date range, status; manually pause/cancel schedule; edit amount |
| **Billing Records** | `/src/features/admin/pages/BillingRecords.tsx` | Table of all billing records (invoices); search by member/enrollment; view details; manual payment entry/refund |
| **Overdue Payments** | (in BillingRecords or Billing) | Filter: status='Failed' + due_date < today; retry/refund actions |

### Manual Admin Actions

**File:** `src/lib/billingService.ts`

```typescript
// Mark payment as paid (admin override)
async markBillingAsPaid(billingId: string, transactionId?: string)

// Apply refund
async refundBilling(billingId: string, reason: string)

// Manually create billing record (for late fees, adjustments)
async createManualBilling(enrollmentId, memberId, productId, amount, description, dueDate)

// Pause billing schedule (temporarily stop recurring)
async pauseSchedule(scheduleId: string)

// Resume paused schedule
async resumeSchedule(scheduleId: string)

// Cancel billing schedule
async cancelSchedule(scheduleId: string, reason: string)
```

---

## 2.4 PAYMENT PROCESSOR INTEGRATION: AUTHORIZE.NET

### Customer Profile Management

**File:** `src/lib/payment/processors/authorizeNet.ts`

**Flow:**

```
1. User submits card/ACH in enrollment form
   ├── Card: first_name, last_name, number, exp, cvv, address, zip
   └── ACH: account_number, routing_number, account_type

2. Client-side: POST /functions/v1/payment
   ├── Method: createTransactionRequest (for one-time charge)
   ├── OR: createCustomerProfileRequest (for recurring)
   └── Never send card directly to Supabase; goes to Authorize.Net via edge function

3. Edge function (server-side, has API keys):
   a. Validate request signature
   b. POST to Authorize.Net API:
      {
        createCustomerProfileRequest: {
          merchantAuthentication: { name, transactionKey },
          profile: {
            merchantCustomerId: member_id,
            email: member_email,
            paymentProfiles: {
              payment: {
                creditCard: { cardNumber, expiration, cardCode }
              }
            }
          }
        }
      }
   
   c. Parse response:
      ├── customerProfileId: unique identifier for member @ Authorize.Net
      ├── customerPaymentProfileId: unique identifier for THIS card @ Authorize.Net
      └── Store both in payment_profiles table (Supabase)

4. For future billing:
   a. Charge uses createTransactionRequest + profile IDs:
      {
        transactionRequest: {
          transactionType: 'authCapturTransaction',
          profile: { customerProfileId, customerPaymentProfileId },
          amount: 150.00,
          ...
        }
      }
   
   b. Authorize.Net returns: transactionId, authCode, resultCode (approved/declined)
   c. Edge function logs to payment_transactions table
   d. Supabase updates billing record: status='Paid' or 'Failed'
```

### Payment Methods Supported

| Method | Type | Fields | Use Case |
|--------|------|--------|----------|
| **Credit Card** | `creditCard` | card number, exp, cvv, name, address | Most common; immediate charge capability |
| **ACH/Bank Account** | `bankAccount` | routing #, account #, account type, name | Alternate payment method; some prefer bank transfers |
| **E-Check** | eCheck variant | Same as ACH | Slower processing (3-5 days), lower fees |

### Error Handling

**File:** `src/lib/paymentErrorHandler.ts`

```typescript
enum PaymentErrorCode {
  INSUFFICIENT_FUNDS = 'E00010', // Declined
  EXPIRED_CARD = 'E00013', // Declined
  LOST_STOLEN_CARD = 'E00014', // Declined
  DUPLICATE_TRANSACTION = 'E00039', // Idempotency error
  GATEWAY_ERROR = 'E00001', // Retry
  INVALID_MERCHANT = 'E00005', // Configuration error
  CARD_NOT_ACCEPTED = 'E00027', // Declined
}

function mapAuthNetErrorToUserMessage(code: string): string {
  // Maps error codes to human-readable messages
  // Example: E00013 → "Your card has expired. Please update your payment method."
}
```

---

## 2.5 BILLING SYNC SYSTEM (PREVENT DISCREPANCIES)

### The Problem

**Old behavior:** Enrollment cost ($150) could differ from billing amount ($120).
- Manual edit of `billing_schedules.amount` without updating `enrollments.monthly_cost`
- Created revenue leaks, customer confusion, compliance issues

### The Solution

**File:** `supabase/migrations/20260217200001_sync_enrollment_billing_amounts.sql`

**Mechanism:**

```sql
CREATE TRIGGER trigger_sync_billing_on_enrollment_update
  AFTER UPDATE OF monthly_cost ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION sync_billing_schedule_on_enrollment_update();

-- Function: auto-updates all active monthly billing schedules when enrollment cost changes
CREATE FUNCTION sync_billing_schedule_on_enrollment_update()
  ├── If NEW.monthly_cost != OLD.monthly_cost
  ├── AND billing_type='monthly'
  ├── AND status='active'
  └── THEN UPDATE billing_schedules SET amount=NEW.monthly_cost
```

**UI Enforcement:**

**File:** `src/components/EnrollmentEditModal.tsx` (in admin pages)
- Monthly billing amount field: **read-only**, displays enrollment monthly_cost
- Annual billing amount: editable (can differ from monthly × 12)
- Visual badge: "AUTO-SYNCED" over monthly amount
- Tooltip: "Monthly billing is automatically kept in sync with enrollment cost."

**Sync Verification:**

**Command:** `npm run check-billing-sync`
- Reports out-of-sync records (if any exist from old data)
- Shows total billing discrepancy

**Command:** `npm run fix-billing-sync`
- Interactive confirmation required
- Updates all out-of-sync records
- Creates audit log entries

---

## 2.6 PRICE CHANGE MANAGEMENT

### Scenario

You increase prices for a product (e.g., MPB Health premiums go from $150 → $175/month for 30-year-olds).

**Process:**

```
1. Admin updates product_pricing_matrices table with new amounts
   ├── Effective date: e.g., 2026-06-01
   └── Status: 'active' (only active matrices used for new enrollments)

2. Admin navigates: /admin/products/{productId}/pricing-matrix
   └── Sees old & new side-by-side

3. Admin clicks: "Schedule Price Change"
   ├── Scheduled Date: 2026-06-01
   ├── Notes: "Annual rate adjustment"
   └── Modal shows: "Will affect 150 active enrollments"

4. System executes (manual or auto on scheduled date):
   ├── Edge function: apply-price-change
   ├── For each active/future_active enrollment with this product:
   │  ├── Get member DOB → calculate age
   │  ├── Find age bracket in NEW pricing matrix
   │  ├── Fetch new price for that bracket + plan type
   │  ├── Update enrollments.monthly_cost = new_price
   │  ├── Trigger fires: sync_billing_schedule_on_enrollment_update()
   │  │  └── Updates all active monthly billing_schedules to new amount
   │  └── Insert row in price_change_audit (immutable record)
   │
   ├── Update price_change_schedules: status='completed', processed_count=150
   └── Return: { success: true, processed: 150, failed: 0, revenue_impact: +$3,750 }

5. Optionally: Send notification emails
   └── Edge function: send-price-change-notification
   ├── For each affected member
   ├── Email template: old_price, new_price, effective_date, contact info
   └── Mark notification_sent=true in price_change_audit
```

### Safety Features

| Feature | Details |
|---------|---------|
| **Dry Run** | Admin can preview affected enrollments before executing |
| **Reversible** | Create new schedule with old prices if needed |
| **Partial Success** | If 5 fail out of 150, 145 succeed; logs errors; can retry |
| **Audit Trail** | Every change in price_change_audit; immutable, tracks who + when |
| **Conditional Execution** | Can schedule for future date; auto-execute at scheduled_date via cron |

---

## 2.7 DUNNING & RETRY LOGIC

### Failed Payment Retry

**Trigger:** Charge declined or error

**Process:**

```
1. Charge fails → create billing_failures record
   ├── retry_count = 0
   ├── next_retry_date = today + 1 day
   └── status = 'pending'

2. Next day (or cron trigger):
   ├── Query: SELECT * FROM billing_failures WHERE status='pending' AND next_retry_date <= today
   ├── For each: attempt charge again
   │  ├── If succeeds: mark billing record 'Paid', delete from billing_failures
   │  └── If fails: increment retry_count, set next_retry_date = today + 1
   └── After 3 retries (max_retries=3):
       ├── Mark billing_failures.status = 'abandoned'
       ├── Send "Payment exhausted retries" email
       └── Flag member for manual review

3. Optional: admin manual retry
   └── Edge function or direct RPC call to re-attempt charge
```

**Dunning Email Sequence** (via edge function `send-mpb-payment-failure-notification`):

- **Attempt 1 fails:** "Your payment failed. We'll retry tomorrow. [Card/Account details]"
- **Attempt 2 fails:** "Retry 2/3. Please update payment method. [Link to payment settings]"
- **Attempt 3 fails:** "Final retry. Contact support: [phone/email]"
- **Abandoned:** "Payment cannot be processed. Contact to update or cancel."

---

## 2.8 GOTCHAS & EDGE CASES

### Billing Schedule Only Changes on Enrollment Actions

**Gotcha:** Editing billing_schedules.amount directly (without editing enrollment) → **will be overwritten by next sync.**

**Correct:** Always edit enrollment.monthly_cost; let trigger update billing schedule.

### Timezone-Related Issues

**Storage:** Dates in `billing_schedules.next_billing_date` are in UTC (DATE type, no timezone)
**Execution:** Billing processor runs at configured UTC time, but "today" can vary by timezone

**Risk:** If member in PT timezone, billing may run on "their tomorrow"

**Mitigation:** Always use DATE type (not TIMESTAMP), compare to CURRENT_DATE (UTC midnight)

### Duplicate Billing After Crash

**Scenario:** Billing processor runs → processes 50 payments → crashes → restarts → re-runs from beginning

**Prevention:** Each charge has idempotency key (UUID); Authorize.Net deduplicates within 24h

**Safety check:** Billing processor queries `billing_transactions` before creating new charge; skips if transaction_id already exists for this idempotency_key

### Payment Profile Expiration

**Edge case:** Payment profile in Authorize.Net expires (card expired, account closed, etc.)

**Detection:** Authorize.Net returns error code 'expired_payment_method' on charge attempt

**Response:** 
1. Log to billing_failures with failure_reason='expired_payment_method'
2. Send member email: "Payment method expired. Update here: [link]"
3. Enrollment remains Active; retry every day for 30 days
4. If not updated, auto-cancel enrollment after 30 days of failed charges

### Refunds (Partial or Full)

**Admin action:** `/admin/billing-records/{billingId}` → "Refund" button

**Flow:**
1. Admin enters refund reason
2. Edge function: POST to Authorize.Net: refundTransaction() with original transaction_id
3. Authorize.Net processes refund (typically 3-5 business days)
4. Update billing record: status='Refunded'
5. Create entry in payment_transactions: transaction_type='refund', status='approved'
6. Send receipt email to member

---

---

# SUBSYSTEM 3: COMMISSIONS SYSTEM

## 3.1 DATABASE SCHEMA (COMMISSION TABLES)

### Core Commission Tables

| Table | Key Columns | Relationships | Purpose |
|-------|----------|---------------|---------|
| **agents** | `id` (int, 6-digit), `first_name`, `last_name`, `email`, `phone`, `status` ('active'\|'inactive'\|'suspended'), `role` ('Agent'\|'Agency'), `parent_agent_id` (int FK), `enrollment_code` (unique), `commission_eligible` (bool) | FK: agents (self-referential for parent) | Agent master record; multi-level hierarchy. `commission_eligible` flag allows selective commission for some agents (e.g., house agents don't earn commission). |
| **agent_levels** | `id` (uuid), `name` ('Advisor'\|'Leader'\|'Director'), `min_members` (int), `max_members` (int, nullable), `created_at` | — | Agent classification by downline size. Determines commission rates. |
| **commission_rates** | `id` (uuid), `agent_level_id` (uuid FK), `product_id` (uuid FK), `plan_type` (text, e.g., "Member + Spouse"), `monthly_amount` (numeric), `created_at`, `updated_at` | FK: agent_levels, products | Monthly commission amount by agent level + plan type. Per-product (supports multi-product commission structures). |
| **commissions** | `id` (uuid), `agent_id` (int FK), `member_id` (text FK), `enrollment_id` (uuid FK), `amount` (numeric), `commission_type` ('signup'\|'monthly'\|'override'), `status` ('pending'\|'paid'\|'cancelled'), `description` (text), `payment_date` (date), `created_at`, `updated_at` | FK: agents, members, enrollments | Individual commission record. One per enrollment per month per commission type. |
| **product_commission_tiers** | `id` (uuid), `product_id` (uuid FK), `tier_level` (int, 1-5), `min_enrollments` (int), `max_enrollments` (int), `commission_percentage` (numeric), `created_at`, `updated_at` | FK: products | Volume-based tier system (optional). Higher tier = higher % commission if enrollment count threshold met. |
| **commission_payouts** | `id` (uuid), `agent_id` (int FK), `payout_date` (date), `period_start` (date), `period_end` (date), `total_amount` (numeric), `status` ('pending'\|'paid'\|'failed'), `payment_method` ('check'\|'ach'\|'wire'), `created_at`, `updated_at` | FK: agents | Aggregated payout record (batches commissions). Agent receives one check/ACH per month. |
| **commission_transactions** | `id` (uuid), `commission_id` (uuid FK), `payout_id` (uuid FK), `transaction_id` (text), `status` ('pending'\|'approved'\|'failed'), `response_message` (text), `created_at` | FK: commissions, commission_payouts | Payment gateway record for each payout (if using ACH/wire). |

### Agent Product Access

| Table | Key Columns | Purpose |
|--------|----------|---------|
| **agent_product_access** | `id` (uuid), `agent_id` (int FK), `product_id` (uuid FK), `created_at` + UNIQUE(agent_id, product_id) | Links agents to products they can sell. On product creation, auto-assigned to all active agents. |

---

## 3.2 COMMISSION CALCULATION LOGIC

### Commission Types & Rates

**File:** `/src/lib/commissionService.ts`

| Commission Type | Timing | Amount | Example |
|-----------------|--------|--------|---------|
| **Signup** | Triggered on enrollment creation (if initial_payment_paid=true) | Fixed: typically $50–100 per enrollment | Member enrolls → Agent earns $50 immediately |
| **Monthly** | Recurring each month enrollment is Active | By agent level + plan type. Advisor: $25 (Member Only), $30 (Member+Spouse), $50 (Family); Leader: +$5; Director: +$10 | Same member, every month active → Agent earns recurring commission |
| **Override** | Parent agent earns difference between own level rate and child level rate | Parent_rate - Agent_rate | Agent (Advisor) earns $25/mo; Parent (Leader) earns $30 - $25 = $5 override/mo |

### Agent Level Determination

**Function:** `getAgentLevel(agent_id: integer) → uuid (agent_level_id)`

**Logic:**

```typescript
function getAgentLevel(agentId: integer) {
  // 1. If agent.role='Agency', return Director level (no member count needed)
  if (agent.role === 'Agency') return directorLevelId;
  
  // 2. If agent.role='Agent', count downline members
  const memberCount = SELECT COUNT(*) FROM members WHERE agent_id = agentId;
  
  // 3. Find level: min_members <= memberCount < max_members
  // Advisor: 1–79 members
  // Leader: 80–249 members
  // Director: 250+ members
  return levels.find(l => l.min_members <= memberCount && (l.max_members == null || memberCount < l.max_members));
}
```

**Dynamic Recalculation:**
- When new member is enrolled by Agent → member count increases
- Agent's level MAY change (e.g., Advisor 80-member → becomes Leader)
- **Next month's commission calculations use new level**
- Retroactive recalculation: Not automatic; only for current/future commissions

---

## 3.3 COMMISSION ACCRUAL FLOW

### New Enrollment: Signup Commission

**Trigger:** `trigger_signup_commission()` (PostgreSQL trigger)

**File:** `supabase/migrations/20250710194526_crimson_leaf.sql`

```sql
CREATE TRIGGER enrollment_signup_commission_trigger
  AFTER INSERT ON enrollments
  FOR EACH ROW
  WHEN (NEW.status IN ('Active', 'Future Active'))
  EXECUTE FUNCTION trigger_signup_commission();

-- Function inserts one row into commissions table:
INSERT INTO commissions (
  agent_id, member_id, enrollment_id, amount=50.00,
  commission_type='signup', status='pending', 
  description='Signup commission for new enrollment'
);
```

**Result:** Commission record created but status='pending' (not yet paid).

### Monthly Commissions: Accrual Process

**File:** `/src/lib/commissionService.ts` → `calculateCommissionsForActiveEnrollments()`

**Execution (manual or cron):**

```typescript
async calculateCommissionsForActiveEnrollments(month?: string) {
  // Fetch all Active + Future Active enrollments
  const enrollments = await supabase
    .from('enrollments')
    .select('id, agent_id, plan_type, monthly_cost, ...')
    .in('status', ['Active', 'Future Active'])
    .eq('initial_payment_paid', true) // Only counted if paid
    .not('agent_id', 'is', null); // Must have enrolling agent

  for (const enrollment of enrollments) {
    if (!enrollment.agent.commission_eligible) continue; // Skip if not eligible
    
    // 1. Get agent level based on current downline count
    const agentLevel = await getAgentLevel(enrollment.agent_id);
    
    // 2. Get commission rate for this level + plan type + product
    const monthlyRate = await getCommissionRate(
      agentLevel, 
      enrollment.plan_type, 
      enrollment.product_id
    );
    
    // 3. Check if commission already exists (was already paid)
    const existing = await getExistingCommissions(enrollment.id, targetMonth);
    if (existing.some(c => c.commission_type === 'monthly')) {
      skip; // Already paid this month
    }
    
    // 4. Create commission record (if not already exists)
    await supabase.from('commissions').insert({
      agent_id: enrollment.agent_id,
      member_id: enrollment.member_id,
      enrollment_id: enrollment.id,
      amount: monthlyRate,
      commission_type: 'monthly',
      status: 'pending',
      description: `Monthly commission for ${enrollment.plan_type}`,
      payment_date: targetDate
    });
  }
}
```

**Result:** One "monthly" commission record per active enrollment per month.

### Override Commissions: Parent Earns Difference

**File:** `supabase/migrations/20250710194526_crimson_leaf.sql` → `calculate_monthly_commission()`

```sql
-- For each enrollment, after creating agent's commission:
SELECT parent_agent_id INTO parent_agent_id FROM agents WHERE id = NEW.agent_id;

IF parent_agent_id IS NOT NULL THEN
  -- Get parent's level
  parent_agent_level_id := get_agent_level(parent_agent_id);
  
  -- Get parent's rate for same plan type
  SELECT monthly_amount INTO parent_rate FROM commission_rates 
  WHERE agent_level_id = parent_agent_level_id AND plan_type = enr.plan_type;
  
  -- Calculate override (difference)
  override_amount := parent_rate - agent_rate;
  
  -- Only create if positive (parent earns more than agent)
  IF override_amount > 0 THEN
    INSERT INTO commissions (
      agent_id=parent_agent_id, member_id, enrollment_id,
      amount=override_amount,
      commission_type='override',
      status='pending'
    );
  END IF;
END IF;
```

**Example:**

```
Enrollment created by Maria (Agent, 100 downline → Leader level)
├── Maria (Leader): commission_rate['Member + Spouse'] = $35/month
├── Commission record: agent_id=Maria, amount=$35, type='monthly'
│
└── Maria's parent: Roberto (Agency → Director level)
    ├── Roberto (Director): commission_rate['Member + Spouse'] = $40/month
    ├── Override = $40 - $35 = $5/month
    └── Commission record: agent_id=Roberto, amount=$5, type='override'

Result: Each month, Maria gets $35 + Roberto gets $5 for this one enrollment
```

---

## 3.4 COMMISSION REPORTING & PAYOUT

### Admin Commission Report

**File:** `/src/features/admin/pages/CommissionReport.tsx`

**Displays:**
- Table: All commissions (signup + monthly + override)
- Filters: by agent, product, date range, status (pending/paid/cancelled)
- Columns: agent name, member name, plan type, commission type, amount, status, payment_date
- Action: Mark as "Paid" (bulk or individual)
- Export: CSV for accounting team

**Queries:**
```sql
SELECT 
  c.*,
  a.first_name || ' ' || a.last_name as agent_name,
  m.first_name || ' ' || m.last_name as member_name,
  e.plan_type,
  p.name as product_name
FROM commissions c
JOIN agents a ON c.agent_id = a.id
JOIN members m ON c.member_id = m.id
JOIN enrollments e ON c.enrollment_id = e.id
JOIN products p ON e.product_id = p.id
WHERE c.status = 'pending' -- or 'paid', 'cancelled'
ORDER BY c.created_at DESC;
```

### Agent Portal: Commissions View

**File:** `/src/features/agent/pages/AgentCommissions.tsx`

**Agent sees:**
- Their own commissions (pending + paid)
- Sub-agent overrides they receive
- Monthly vs. signup breakdown
- Total pending, total paid (YTD)
- Projected payout next month

**Data fetched via RLS policy:**
```sql
SELECT * FROM commissions 
WHERE agent_id = auth.user.agent_id -- Own commissions only
   OR (parent_agent_id = auth.user.agent_id AND commission_type='override') -- Override commissions
ORDER BY payment_date DESC;
```

### Commission Payout

**Process (manual or automated):**

```
1. Admin clicks: "Process Payouts" for month of [2026-05-01 to 2026-05-31]
   
2. System aggregates:
   ├── SELECT SUM(amount) FROM commissions 
   │   WHERE agent_id = X AND status='pending' AND payment_date BETWEEN 2026-05-01 AND 2026-05-31
   └── Creates one commission_payouts row per agent per month
   
3. Example payout:
   {
     agent_id: 100002 (Maria),
     period_start: 2026-05-01,
     period_end: 2026-05-31,
     total_amount: 2500.00,
     status: 'pending',
     payment_method: 'ach' -- Pulled from agent.payment_method or config
   }

4. Edge function: process-commission-payouts
   ├── For each pending payout:
   │  ├── Get agent's ACH details (bank account, routing, name)
   │  ├── Call payment gateway API (Authorize.Net refund or 3rd party ACH)
   │  ├── Wait for approval
   │  └── Update commission_payouts.status = 'paid'
   │
   └── For each commission in payout:
      └── Update status='paid', payment_date=payout_date

5. Send agent email: "Commission payout processed: $2,500.00 ETA 2 business days"
```

---

## 3.5 MULTI-LEVEL COMMISSION HIERARCHY

### Downline & Override Structure

**File:** `/src/features/agent/pages/AgentDownline.tsx` & related

**Visualization:**

```
Roberto Silva (100001) - Agency [Director level]
├── $5 override per Maria's enrollment per month
│
├── Maria Santos (100002) - Agent [Leader level]
│  ├── $35 commission per "Member+Spouse" enrollment per month
│  └── 85 downline members
│     ├── Carlos Lima (100003) - Agent [Advisor level]
│     │  ├── $30 commission per "Member+Spouse" enrollment per month
│     │  └── 12 downline members
│     │
│     └── [Other sub-agents...]
│
└── [Other direct sub-agents of Roberto...]
```

**Commission Flow for Single Enrollment Created by Carlos:**

```
Enrollment: John Doe, "Member+Spouse", Carlos (Advisor, 12-member team)

1. Signup commission:
   - Carlos: $50 (signup)
   
2. Monthly (ongoing):
   - Carlos: $30/mo (Advisor + Member+Spouse plan)
   - Maria (Carlos's parent): $5/mo override ($35 Leader - $30 Advisor)
   - Roberto (Maria's parent): $5/mo override ($40 Director - $35 Leader)

3. If Carlos grows to 80+ members → becomes Leader:
   - Future months: Carlos earns $35/mo (Leader rate) for this enrollment
   - Maria: now $5/mo override ($40 Director - $35 Leader) -- unchanged in this example
```

**Recursive Functions:**
- `get_agent_hierarchy(parent_id)` → all descendants (recursive CTE)
- `get_agent_path(agent_id)` → path to root (for breadcrumb)

---

## 3.6 COMMISSION CANCELLATION & ADJUSTMENTS

### Auto-Cancellation on Enrollment Termination

**Trigger:** When `enrollments.status` changes to 'Inactive' or 'Cancelled'

```sql
CREATE TRIGGER handle_enrollment_cancellation_on_commissions
  AFTER UPDATE ON enrollments
  FOR EACH ROW
  WHEN (NEW.status IN ('Inactive', 'Cancelled') AND OLD.status NOT IN ('Inactive', 'Cancelled'))
  EXECUTE FUNCTION cancel_enrollment_commissions();

-- Function:
UPDATE commissions
SET status = 'cancelled'
WHERE enrollment_id = NEW.id AND status = 'pending';
```

**Result:** All pending (unpaid) commissions for that enrollment are cancelled immediately.

### Admin Adjustment

**Use case:** Agent disputes commission amount (e.g., member complained, partial refund issued)

**Action:**
1. Admin in Commission Report: Click "Adjust" on commission record
2. Modal: Reason dropdown + new amount
3. Creates `commission_adjustment` record (audit trail)
4. Updates original commission: amount=adjusted, notes=reason
5. Sends email to agent explaining adjustment

---

## 3.7 GOTCHAS & NON-OBVIOUS BEHAVIORS

### Commission Eligibility Flag

**Gotcha:** `agents.commission_eligible = false` agents still appear in hierarchy but earn $0.

**Use case:** In-house enrollment specialists who don't earn commission

**Impact:** 
- Enrollments by non-eligible agents → signup/monthly commissions not created
- Override commissions still paid to their parents (if parent is eligible)

### Tier System is Optional

**File:** `product_commission_tiers` table

**Feature:** If configured, agents can earn higher % at higher enrollment volumes (e.g., 100+ enrollments = +10% bonus)

**Status:** Rarely used in current system; schema exists but not actively integrated into commission calculation

### Level Recalculation Timing

**Gotcha:** Agent's level changes dynamically with downline count, but **next month's calculations use new level**.

**Scenario:**
- May 1–31: Agent has 79 members → Advisor level → earns $25/mo per enrollment
- June 1: Agent's 80th member signs up → agent becomes Leader
- June 1–30: New enrollments earn $30/mo (Leader rate)
- But: May 31–June 30: already-existing enrollments from May still earn Advisor rates ($25)
- Only new enrollments in June use Leader rate

**Workaround:** Manually recalculate commissions after level change (admin action)

### Signup Commission Timing

**Gotcha:** Signup commission created only if `initial_payment_paid = true` at enrollment creation time.

**If payment fails initially:**
- Enrollment record created but `initial_payment_paid = false`
- trigger_signup_commission() does NOT fire
- If member pays later (via admin manual action), no commission retroactively created

**Mitigation:** Admin can manually insert commission record after payment succeeds

### Dependent Enrollment Commission

**Gotcha:** Commissions are PER ENROLLMENT, not per member/dependent.

**Scenario:** Member has 2 dependents on one "Member + Family" enrollment → 1 commission
If member later adds a 3rd child → NEW enrollment (plan change) → separate commission for new enrollment only

---

## 3.8 ADMIN PAYOUT MANAGEMENT

### Commission Payment Methods

**Supported:**
- **Check** (ACH check, printed + mailed)
- **ACH/Direct Deposit** (digital, 1–2 business days)
- **Wire Transfer** (fast, international support)

**Configuration per agent:**
- `agents.payment_method` (default from company config)
- Or: `payment_profiles` table (stores ACH account info for agent, similar to member setup)

### Bulk Payout Processing

**File:** `/src/features/admin/pages/Billing.tsx` (or dedicated CommissionPayout page)

```
1. Select month: [May 2026]
2. Click: "Process Commissions Payout"
3. System aggregates & shows preview:
   - Total agents to pay: 52
   - Total payout amount: $125,000
   - Breakdown by payment method: ACH ($100k), Check ($25k)
4. Confirm & submit
5. Edge function executes:
   ├── Batch ACH requests (max 100 per request)
   ├── Generate check print-list for manual processing
   ├── Update all commission records: status='paid'
   └── Send agent notifications
6. Response: "Payout processed. 52 agents, $125,000. Check list for printing."
```

### Payout Report & Reconciliation

**File:** `/src/features/admin/pages/CommissionReport.tsx` (filtered to `status='paid'`)

**Columns:**
- Agent, total commission, payment method, payment date, ACH confirmation/check #
- Filter by payment status: pending, paid, failed
- Export for accounting reconciliation

---

---

# APPENDIX: INTEGRATION POINTS & EXTERNAL SYSTEMS

## Key Integrations

| System | Purpose | Integration Type | Credentials |
|--------|---------|------------------|-------------|
| **Authorize.Net** | Primary payment processor (card/ACH) | REST API | `AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY` |
| **FTNI** | Alternate processor (ACH-focused) | REST API | `FTNI_API_KEY`, `FTNI_MERCHANT_ID` |
| **Resend** | Email delivery (notifications, contracts, receipts) | REST API | `RESEND_API_KEY` |
| **Supabase Storage** | Contract PDF, agreement documents | S3-compatible | Built-in; bucket `contracts`, `legal_documents` |
| **Google reCAPTCHA** | Enrollment form bot protection | JavaScript widget + server validation | `VITE_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` |
| **Vendor SFTP** | Vendor feed exports (cost reconciliation) | SFTP/SSH | `VENDOR_SFTP_HOST`, `VENDOR_SFTP_USER`, `VENDOR_SFTP_PASSWORD` |

## Webhooks & Callbacks

| Webhook | Sender | Handler | Action |
|---------|--------|---------|--------|
| **Payment Result** | Authorize.Net | `supabase/functions/payment-webhook/index.ts` | Update `payment_transactions`, mark `billing.status='Paid'/'Failed'`, send receipt/error email |
| **Subscription Event** | Authorize.Net | Same | Update `payment_subscriptions` (if used), resume/suspend billing |
| **Vendor Integration** | External vendor system | Polling (scheduled job) | Fetch enrollment CSV, reconcile with Supabase, flag mismatches |

---

# FINAL ARCHITECTURE SUMMARY TABLE

| Subsystem | Core Tables | Key Services | Front-End Routes | Edge Functions | Status |
|-----------|------------|--------------|------------------|-----------------|--------|
| **Enrollment** | enrollments, enrollment_dependents, dependents, agreement_signatures, enrollment_logs | unifiedEnrollmentService, enrollmentPaymentService, enrollmentLogger | /enroll/*, /admin/enrollments* | generate-enrollment-contract, notify-new-enrollment, send-agreement-reminder | Full production |
| **Billing** | billing_schedules, billing, billing_failures, payment_profiles, payment_transactions, price_change_schedules, price_change_audit | billingService, paymentService, planChangeService | /admin/billing*, /admin/billing-schedules, /admin/billing-records | billing-processor, payment, payment-webhook, apply-price-change | Full production |
| **Commissions** | commissions, agents, agent_levels, commission_rates, commission_payouts, product_commission_tiers | commissionService | /admin/commission-report, /agent/commissions, /agent/downline | commission-processor (if automated), process-commission-payouts | Full production |

---

**This map is comprehensive and production-tested as of May 2025.** All three subsystems are tightly integrated via Supabase triggers, RLS policies, and edge functions. Cloning should prioritize the database schema migrations and service layer (`src/lib/` files) before UI components.