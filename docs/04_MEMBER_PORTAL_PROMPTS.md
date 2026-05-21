# Member Portal Build — Cursor Prompt Series

**Reference project:** `/Users/qloudagent/Desktop/Desktop/APPLICATIONS/MPB_PWA_APP` (React + Vite + Supabase PWA)
**Target project:** `/Users/qloudagent/Documents/GitHub/crm-eco/apps/portal` (Next.js 15 App Router, **in production**)
**Goal:** Bring `apps/portal` to feature parity with the MPB member PWA — billing visibility, plan/memberships, signed contract download, submit-a-need, telehealth, support, advisor contact, dependents management — and make it a true PWA (manifest, service worker, install prompts, offline shell).

> **Status note (read before running):** The MPB reference map underpinning these prompts is exhaustive and confirmed. The **current state of `apps/portal`** could not be inspected directly due to a macOS TCC permission lockdown during planning. The prompts assume many existing routes (`/billing`, `/profile`, `/needs`, `/dependents`, etc.) are stubs or shells. **Every prompt instructs Cursor to read each existing file first, summarize what's there, and INTEGRATE rather than overwrite.** Worst case: a few minutes of wasted planning when Cursor finds a fully-built page — never lost work. If Cursor reports that an existing file is substantial, let it report back to you before forcing the change.

Run prompts 1 → 11 in order. After each: review diff, typecheck, test in browser, commit, then move on.

---

## Critical guardrails — paste at the top of every Cursor session

```
HARD RULES — DO NOT VIOLATE:
1. apps/portal is in PRODUCTION. No data loss. No destructive migrations.
2. INTEGRATE — never overwrite. Before creating any file, check if it already exists.
   - If exists with substantial content: extend it, don't replace.
   - If exists as stub (< 30 lines, mostly imports or placeholder text): replace OK.
   - If unsure: read the file fully first, summarize what's there, then ask me.
3. Migrations: only CREATE TABLE IF NOT EXISTS, ALTER … ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION. Latest migration is 202605200001 — new ones start 202605210001 and increment.
4. RLS on every new table: org-scoped using get_user_organization_id(); member-scoped using auth.uid() where appropriate.
5. Multi-tenancy: per CLAUDE memory, the portal is single-org currently. Honor existing org resolution (likely via profiles.organization_id or memberships.organization_id) — do not introduce organization_members lookups in the portal.
6. Schema reality (verified — use these names):
   - enrollments.base_monthly_cost (NOT monthly_cost)
   - enrollments.end_date (NOT inactive_date)
   - enrollments.status: 'draft'|'in_progress'|'submitted'|'approved'|'rejected'|'cancelled'
   - enrollments.primary_member_id uuid → members.id (uuid)
   - enrollments.advisor_id uuid → advisors.id (uuid)
   - memberships.billing_amount is the canonical recurring cost once a membership is active
   - dependents table exists; per-link status lives on enrollment_dependents (created in earlier upgrade plan)
7. Auth: this app uses Supabase Auth. Server components use the request-scoped cached helpers in apps/portal/src/lib/* (look for existing patterns; do not introduce new auth code paths).
8. Next.js client-component rules: never mount providers in server layouts; use a ClientProviders.tsx boundary. Conditional renders need `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])`.
9. No `next/dynamic` with named exports in server components — causes prod crashes.
10. Tech stack: Next.js 15 App Router, React 19, Tailwind, Supabase. Mobile-first.
```

---

## Architectural decisions baked in

| Decision | Choice | Reason |
|---|---|---|
| Member auth gating | Require a `memberships.status='active'` row matching the logged-in user's profile | True "I am a member" check, not just "I have an account" |
| PWA strategy | `next-pwa` (or `@ducanh2912/next-pwa` for App Router) + custom manifest + workbox runtime caching | Matches MPB's Workbox patterns, native to Next.js |
| Mobile shell | Bottom nav (3-4 items) + sticky header on small screens; sidebar on `md+` | Matches MPB UX |
| Payment portal | Stay with Authorize.Net (already wired in `packages/lib/src/billing`) — embed payment-update flow via a dedicated route that calls existing BillingService | Don't fragment processors |
| Signed contract download | Read from Supabase Storage bucket `contracts/enrollments/{enrollment_id}/...` (created in the enrollment upgrade plan) | Reuses Prompt 4 from `01_UPGRADE_PLAN.md` |
| Submit-a-need | Build natively (do NOT redirect to Zion/Sedera like MPB does) — it's a first-class CRM-Eco feature with its own tables | Differentiator vs MPB |
| Telehealth | Edge function `telehealth-sso` that signs a member context payload and returns a provider URL; provider-agnostic (start with one provider via env-driven config) | Same pattern as MPB's mytelemedicine-sso but generic |
| Notifications | DB-backed table `member_notifications` with realtime subscription | Replaces MPB's mock notifications |
| Concierge / chat | Embed an existing widget (Zoho SalesIQ or Intercom — env-driven) | Match MPB's pattern, no rebuild |

---

# CURSOR PROMPT SERIES

## PROMPT M1 — PWA foundation: manifest, service worker, install prompt, layout shell

```
You are working on /Users/qloudagent/Documents/GitHub/crm-eco/apps/portal. Production app. INTEGRATE — do not overwrite existing files.

Make this app a true PWA matching the MPB pattern.

1. apps/portal/public/manifest.webmanifest — create:
   {
     "name": "Member Portal",
     "short_name": "Members",
     "description": "Your membership, billing, and care — in one place.",
     "start_url": "/?source=pwa",
     "scope": "/",
     "display": "standalone",
     "orientation": "portrait",
     "background_color": "#ffffff",
     "theme_color": "#0f172a",
     "icons": [
       { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
       { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
       { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
     ],
     "shortcuts": [
       { "name": "Submit a Need", "url": "/needs/new" },
       { "name": "Billing", "url": "/billing" },
       { "name": "Telehealth", "url": "/services/telehealth" }
     ],
     "categories": ["health", "medical", "healthcare"]
   }
   Use placeholder PNGs for icons if assets aren't ready — generate solid-color 192/512 PNGs into apps/portal/public/icons/. Note in a comment that the operator should replace with branded icons.

2. apps/portal/next.config.* — add the next-pwa wrapper. Use `@ducanh2912/next-pwa` (App Router compatible).
   - Add to package.json: `"@ducanh2912/next-pwa": "^10.2.x"`.
   - Wrap config:
       import withPWA from '@ducanh2912/next-pwa';
       export default withPWA({
         dest: 'public',
         disable: process.env.NODE_ENV === 'development',
         register: true,
         workboxOptions: {
           runtimeCaching: [
             { urlPattern: /^\/$|^\/billing|^\/enrollments|^\/needs|^\/services|^\/documents/, handler: 'NetworkFirst', options: { cacheName: 'pages', networkTimeoutSeconds: 5 } },
             { urlPattern: /\.(?:js|css|woff2?)$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'static-assets' } },
             { urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/, handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 30*24*60*60 } } }
           ]
         }
       })(existingConfig);

3. apps/portal/src/components/pwa/InstallPrompt.tsx — client component:
   - Listens for `beforeinstallprompt` event, stashes it in state.
   - Renders a non-intrusive bottom-sheet "Install this app" toast on mobile when the event fires.
   - "Dismiss" stores a localStorage flag for 30 days so it doesn't pester users.
   - Triggers `prompt()` on Install click.

4. apps/portal/src/components/pwa/UpdateToast.tsx — client component:
   - Subscribes to next-pwa's `onNeedRefresh` (or polls `navigator.serviceWorker.controller` for updates).
   - Toast "New version available — Refresh" with auto-dismiss after 10s.

5. apps/portal/src/app/layout.tsx — INTEGRATE (read first):
   - Add <link rel="manifest" href="/manifest.webmanifest"> via metadata.manifest.
   - Add meta theme-color, apple-touch-icon, apple-mobile-web-app-capable.
   - Mount <InstallPrompt /> and <UpdateToast /> inside a ClientProviders boundary (do not put these directly in the server layout).

6. apps/portal/src/components/layout/MemberShell.tsx — client component:
   - Top sticky header (mobile + desktop) with logo, page title, notifications bell, account avatar.
   - Bottom nav (mobile only, hidden on md+): Home, Billing, Needs, More.
   - Side rail (desktop only, hidden on mobile <md): Home, Billing, Plan, Documents, Needs, Services, Support.
   - Safe-area handling: `pb-[env(safe-area-inset-bottom)]` on bottom nav; `pt-[env(safe-area-inset-top)]` on header.

7. apps/portal/src/app/(member)/layout.tsx — new route group:
   - Wraps the member shell.
   - In a server component, verify the user has at least one membership where status='active' for the request org. If not, redirect to /access-denied with a helpful message ("You need an active membership to access this portal").
   - Helper: apps/portal/src/lib/auth/require-active-membership.ts (server-only, request-scoped cached).

8. apps/portal/tailwind.config.* — INTEGRATE:
   - Add safe-area utilities if not present.
   - Ensure mobile-first responsive scale.

Read existing apps/portal/src/app/layout.tsx and apps/portal/src/components/ FIRST. Don't overwrite providers, theming, or auth bootstrap that's already there. Print a summary of what you found before changing anything.

Verification:
- npm run dev -w apps/portal → open in Chrome → DevTools → Application → Manifest should show all icons + theme.
- Lighthouse PWA score >= 90.
- "Install" button appears on Chrome address bar.
```

---

## PROMPT M2 — Member data layer + auth gating

```
Build the data-access layer the rest of the portal will use. No UI yet.

1. apps/portal/src/lib/data/member.ts — server-only data accessors, request-scoped cached via React's `cache()`:
   - getCurrentMember(): returns { profile, primary_member_record, organization, advisor } | null
     Resolution order: auth.uid() → profiles row → look up the corresponding `members` row (members.user_id = profile.user_id OR members.email = profile.email — confirm the linking column by reading the migration that created `members`; STOP and tell me if unclear).
     Returns null if no active member is found.
   - listMemberEnrollments(memberId): returns enrollments[] with selected_plan_id joined to plans
   - getActiveMembership(memberId): returns the one currently-active memberships row (status='active') with plan info
   - listDependentsForMember(memberId): returns dependents[] (both active and inactive, with status flag)
   - getMemberAdvisor(memberId): returns advisor row from the member's enrollment.advisor_id

2. apps/portal/src/lib/data/billing.ts — uses BillingService from packages/lib for everything:
   - listPaymentProfiles(memberId): wraps BillingService.getPaymentProfiles
   - getActiveBillingSchedule(memberId): SELECT * FROM billing_schedules WHERE member_id=$1 AND status='active' AND frequency='monthly' ORDER BY next_billing_date LIMIT 1
   - listTransactions(memberId, opts: { limit, offset, statusFilter }): paginated billing_transactions
   - listInvoices(memberId, opts): paginated invoices
   - listOpenFailures(memberId): billing_failures WHERE resolved=false ORDER BY created_at desc

3. apps/portal/src/lib/auth/require-active-membership.ts — server-only:
   - export async function requireActiveMembership(): returns the member context, redirects if missing.
   - Wraps getCurrentMember + active-membership check.

4. apps/portal/src/lib/queries/members.ts — TanStack Query hooks for client components:
   - useMemberProfile(), useActiveBillingSchedule(), usePaymentProfiles(), useTransactions(filters), useInvoices(), useDependents(), useEnrollments()
   - Each calls a corresponding /api/member/* Route Handler that internally uses the server-only data accessors above. Do NOT use the supabase-js client directly in client components; everything goes through the API layer so the auth + active-membership gates are enforced.

5. apps/portal/src/app/api/member/ — Route Handlers (one per resource above):
   - profile/route.ts, billing-schedule/route.ts, payment-profiles/route.ts, transactions/route.ts, invoices/route.ts, dependents/route.ts, enrollments/route.ts
   - Each handler calls requireActiveMembership() first; on failure returns 403 with { error: 'NOT_A_MEMBER' }.
   - All read-only (GET) at this stage.

6. apps/portal/src/lib/types/member.ts — shared TS types: MemberProfile, ActiveMembership, MemberAdvisor, etc. Generated from packages/lib/src/types/database.ts where possible (use `Database['public']['Tables']['memberships']['Row']` patterns, don't redefine).

Before writing:
- Read apps/portal/src/lib/ to see what auth helpers exist (likely supabase-server.ts patterns from the main CRM app — reuse if applicable).
- Read 1-2 migration files to confirm the linking column between `profiles`/`auth.users` and `members`. If unclear, STOP.

Print a summary of existing auth/data patterns before adding new ones.
```

---

## PROMPT M3 — Home dashboard (the landing page after login)

```
Build apps/portal/src/app/(member)/page.tsx — the member home / dashboard.

Layout (mobile-first):
- Top: Welcome card with member first_name, member_id (with copy button), active plan name + tier
- "Quick Actions" grid (2-col on mobile, 4-col on md+):
    * Submit a Need → /needs/new
    * Billing → /billing
    * Telehealth → /services/telehealth
    * My Plan → /plan
- "What's happening" feed:
    * Next billing date + amount (from getActiveBillingSchedule)
    * Unresolved billing failures (red banner if any)
    * Recent need updates (top 3 from member_needs table — Prompt M6)
- "Care services" carousel:
    * Telehealth, Labs & Testing, Discounts, RX, Hospital Debt Relief
    * Cards link to /services/* — built in Prompt M7
- "My advisor" small card at the bottom:
    * Photo (if avatar_url), name, phone, email — from getMemberAdvisor
    * "Message" button → /support?topic=advisor
- "Notifications" bell in the header shows unread count (Prompt M8)

Components:
- apps/portal/src/components/home/WelcomeCard.tsx
- apps/portal/src/components/home/QuickActionGrid.tsx
- apps/portal/src/components/home/NextBillingCard.tsx
- apps/portal/src/components/home/FailureBanner.tsx
- apps/portal/src/components/home/CareServicesCarousel.tsx
- apps/portal/src/components/home/AdvisorCard.tsx

Data: server component fetches everything in parallel using Promise.all on the Prompt M2 accessors. Pass to client cards.

Tone & visual:
- Use the existing project's design tokens (Tailwind). If apps/portal already has a design system or shadcn/ui setup, use those primitives — do not introduce new UI libraries.
- Rounded cards, subtle shadows, friendly emoji-free copy.
- Empty states matter: if no billing schedule yet, show "Once your enrollment is active, billing details will appear here."

Edge cases:
- New member (no active membership) — already redirected by the layout gate. Not reachable here.
- Member with zero enrollments but active membership — show "Enrollment in progress" with a "Contact your advisor" CTA.
- Member on hold (memberships.status='paused') — yellow banner explaining the hold.

Print the file tree of what you'll add before writing.
```

---

## PROMPT M4 — Billing pages

```
Build apps/portal/src/app/(member)/billing/ — replaces existing /billing if it's a stub. INTEGRATE if substantial.

Sub-routes:
- /billing — overview (default)
- /billing/methods — payment methods CRUD
- /billing/methods/new — add a payment method (card or ACH)
- /billing/transactions — paginated history
- /billing/invoices — paginated invoices, downloadable
- /billing/failures — open billing failures + member-side resolution actions

OVERVIEW page sections:
1. Current schedule card: amount, frequency, next_billing_date, payment method last-4
2. "Pay now" button (only if there's an unresolved billing_failure with resolution_type=null) → triggers BillingService.processPayment for that failure's schedule
3. "Update payment method" CTA → /billing/methods
4. Recent transactions (last 5) with link to full list
5. Unresolved failures section (if any)

METHODS page:
- Table/cards of payment_profiles for this member (last_four, card_type/bank, exp_date, is_default badge)
- "Add new" → /billing/methods/new
- Each row: "Set default", "Remove" (soft delete via BillingService.deletePaymentProfile — confirm modal first)
- If member is removing the only method AND has an active schedule: block with "You can't remove your only payment method while billing is active."

ADD METHOD page (the most sensitive):
- Two tabs: Credit Card / Bank Account
- Form fields per MPB pattern: name, number, exp MM/YY, CVV, billing address (full)
- DO NOT POST card data to the Next.js server. Use Authorize.Net Accept.js (client-side tokenization) — the form posts opaque payment tokens, then a server action calls BillingService.createPaymentProfile with the token.
- If Accept.js integration is too much for one prompt: stub the page with a clear TODO and link to /billing/methods/new-classic which posts to a server action that uses BillingService.createPaymentProfile directly (less PCI-friendly but functional). Print which path you took.

TRANSACTIONS page:
- Filters: status (all/success/failed/refunded), date range, transaction type
- Columns: date, amount, type, status badge, description, "Download receipt" (if status=success — link to /api/member/transactions/[id]/receipt for a generated PDF)
- Pagination (server-side, 20 per page)

INVOICES page:
- Same shape as transactions
- "Download PDF" if invoices.pdf_url is set; otherwise show "Generating…" or "Not available"

FAILURES page:
- List billing_failures where resolved=false
- For each: failure_reason, retry_attempt, next_retry_date, amount
- Actions: "Update payment method" (→ /billing/methods/new), "Retry now" (server action that calls BillingService.processPayment), "Contact support" (→ /support?topic=billing-failure)

All sub-pages use the Prompt M2 data layer + Route Handlers.

Read existing apps/portal/src/app/billing/ first. If there's a working payment-method form, REUSE it.

Print a status table before writing: "found existing X / will create Y / will extend Z".
```

---

## PROMPT M5 — Plan & memberships pages

```
Build apps/portal/src/app/(member)/plan/ — the member's plan, dependents, and change requests.

Sub-routes:
- /plan — overview of current plan
- /plan/dependents — add / remove / activate dependents
- /plan/change — request a plan change
- /plan/cancel — request membership cancellation

OVERVIEW page:
- Plan name, tier, product_line, coverage category
- IUA / sharing limit / max annual share if present on plans row
- Effective date, end_date (if any)
- Monthly cost (from memberships.billing_amount, fallback enrollments.base_monthly_cost)
- Plan documents section: render any rows from `legal_documents` matching the plan + organization with status='active' — "Download PDF" buttons
- "Sharing guidelines" link (if a guideline doc exists)

DEPENDENTS page:
- Active dependents (current memberships' enrollment_dependents joined to dependents) — name, DOB, relationship, status
- Inactive / pending dependents (dependents row exists but no active enrollment_dependents link) — show "Activate" button
- "Add dependent" button → modal with form (name, DOB, relationship, SSN-last-4 optional, custom_fields)
    - On submit: POST /api/member/dependents — creates a dependents row + a pending change request (do NOT auto-add to enrollment; route through admin approval via a member_change_requests table — see schema below)
- "Remove dependent" → creates a change request with type='remove_dependent', status='pending_review'

CHANGE page:
- Form: "What would you like to change?" with options:
    * Add a dependent
    * Remove a dependent
    * Upgrade plan tier
    * Downgrade plan tier
    * Change IUA level
    * Change effective date
- Each option opens a focused sub-form
- All submissions create a row in `member_change_requests` (table created in Prompt M9)
- Submit creates a CRM task assigned to the member's advisor (insert into `tasks` if the table exists, or skip silently if not)
- Success message: "Your request was submitted. Your advisor will contact you within 1 business day."

CANCEL page:
- "We're sorry to see you go" copy + a cancellation reason dropdown (from inactive_reasons lookup)
- Effective date selector (defaults to end of current billing period)
- Confirmation modal — 2-step (so accidental clicks don't cancel)
- On confirm: creates a member_change_requests row with type='cancel_membership', payload jsonb { effective_date, reason_code }. Do NOT immediately set memberships.status='cancelled' — this goes through admin approval to prevent member-driven mistakes from killing billing mid-cycle.

Data: extend apps/portal/src/lib/data/member.ts with listDependentsForMember already done in M2; add listPendingChangeRequests(memberId) and submitChangeRequest(input).

API:
- POST /api/member/dependents (add)
- POST /api/member/change-requests (any change type) — body is discriminated-union by type field
- GET /api/member/change-requests — list of pending/recent requests for this member

Print the file tree and a summary of existing /plan or /dependents routes before writing.
```

---

## PROMPT M6 — Submit a Need (health sharing need / claim)

```
Build apps/portal/src/app/(member)/needs/ — the member-driven need submission and tracking flow. This is built natively in crm-eco (unlike MPB which redirects to Zion/Sedera).

Sub-routes:
- /needs — list member's needs with status badges
- /needs/new — multi-step submission wizard
- /needs/[id] — detail view + status timeline + add comment / upload more documents

LIST page:
- Card per need: title (chief complaint), date submitted, amount requested, amount approved, status badge
- Status colors: submitted=gray, under_review=blue, eligible=green, ineligible=red, sharing_scheduled=amber, shared=emerald, closed=slate
- Empty state: "You haven't submitted any needs yet. Got medical bills you'd like shared? Click below."
- "Submit a new need" CTA

NEW page (multi-step wizard):
Step 1 — Need Type
- Radio: medical, dental, vision, prescription, mental_health, urgent_care, hospitalization, surgery, other
- Brief description (textarea, 500 char max)

Step 2 — Provider Info
- Provider name, NPI (optional), address, phone, date of service
- Was this an emergency? (boolean)
- Pre-existing condition disclosure (boolean + textarea if yes)

Step 3 — Financials
- Total billed amount, amount already paid by member, amount remaining
- Insurance / other coverage paid amount (if applicable)
- Auto-calculate "amount requesting for sharing"

Step 4 — Documents
- Upload bills, EOBs, medical records, receipts — drag-drop
- Each upload goes to Supabase Storage bucket 'member-needs' at path needs/{member_id}/{need_draft_id}/{filename}
- Store path + mime + size in need_attachments table (Prompt M9 creates it)
- Limit: 20 files, 25MB each, accept .pdf .jpg .png .heic

Step 5 — Review & Submit
- Show everything entered
- Acknowledge "I attest the information is accurate" checkbox
- On submit: insert into member_needs with status='submitted', insert attachments, fire an admin notification (insert into admin notifications table if it exists), email the advisor

DETAIL page:
- Header: need title, submitted date, current status, amount requested vs amount approved (when assigned)
- Status timeline (vertical): each row = a status_history entry with timestamp + actor name + notes
- Attachments section: list with download links (use createSignedUrl from Supabase Storage)
- Comments thread: member can add comments (status='member_comment'); admin replies show as status='admin_response'
- "Withdraw need" button (only if status IN ('submitted','under_review')) — sets status='withdrawn'

Data layer:
- apps/portal/src/lib/data/needs.ts
- listNeeds(memberId), getNeed(needId, memberId), submitNeed(input), addAttachment(needId, fileMeta), addComment(needId, content), withdrawNeed(needId)
- All check member ownership before mutation.

API:
- /api/member/needs (GET list, POST submit)
- /api/member/needs/[id] (GET detail, PATCH for status changes the member can do — only withdraw)
- /api/member/needs/[id]/attachments (POST upload)
- /api/member/needs/[id]/comments (GET list, POST add)

Tables are created in Prompt M9. For now, the prompt creates the UI assuming those tables exist.

Print the file tree before writing.
```

---

## PROMPT M7 — Services: Telehealth, Care, Discounts, Labs

```
Build apps/portal/src/app/(member)/services/ — links into the partner ecosystem. Generic + provider-agnostic, configurable per-org.

Sub-routes:
- /services — overview card grid
- /services/telehealth — SSO launcher
- /services/care — care provider directory (curated)
- /services/discounts — partner discount list
- /services/labs — lab testing partners
- /services/rx — prescription savings (RX Valet pattern)
- /services/hospital-debt-relief — eligibility check + external link

OVERVIEW page:
- Grid of service category cards with icons (lucide-react)
- Each card links to its sub-route
- Cards are dynamic — hidden if the active plan doesn't include the service (use a `plan_services` JSONB column on plans or a `plan_service_access` table; create if not present in Prompt M9)

TELEHEALTH page:
- Disclaimer card (matches MPB's pattern): coverage limits per visit type
- "Continue to Telehealth" button → POST /api/member/services/telehealth/sso
- Server endpoint:
    1. requireActiveMembership()
    2. Build context payload: { member_id, primary_member_id, first_name, last_name, dob, plan_code }
    3. POST to the provider via a Supabase Edge Function `telehealth-sso` (create in supabase/functions/telehealth-sso/) — same pattern as MPB's mytelemedicine-sso
    4. The edge function:
        - Verifies the JWT
        - Loads member + dependents
        - Computes dependent_number (01-99) for family-plan dependents — same algorithm as MPB
        - Calls the configured provider API using TELEHEALTH_PROVIDER_URL + TELEHEALTH_PROVIDER_KEY env vars
        - Returns { sso_url }
    5. Open the sso_url in a new tab (provider blocks iframe embedding)
- Visit history: optional — phase 2. For now, link out only.

CARE page:
- Curated list of provider partners stored in a new table `service_providers` (Prompt M9): { id, organization_id, category, name, description, logo_url, external_url, is_active, sort_order }
- Filter by category
- Each card opens external URL in new tab (with rel="noopener noreferrer")

DISCOUNTS page:
- Same shape as care
- Categories: pharmacy, vision, dental, wellness, fitness, travel

LABS page:
- Same shape
- Banner reminder about EKRA compliance (per MPB): "Lab tests exceeding your IUA may not be eligible for sharing."

RX page:
- Same shape, with a hero CTA pointing to the configured RX partner (env-driven URL)

HOSPITAL DEBT RELIEF page:
- Eligibility quiz (5-6 yes/no questions)
- If qualifies → "Continue to apply" external link + create a service_intake row (table created in Prompt M9)

API:
- /api/member/services/telehealth/sso (POST)
- /api/member/services/providers (GET — filtered by org + active)

Print the file tree before writing.
```

---

## PROMPT M8 — Contract, Documents, Profile, Support, Notifications

```
Wire up the remaining MPB-equivalent screens.

1. /documents — apps/portal/src/app/(member)/documents/page.tsx
   - List the member's documents from multiple sources:
     * Signed enrollment contracts: SELECT * FROM agreement_signatures WHERE enrollment_id IN (member's enrollments) — each gets a "Download" button calling supabase.storage.from('contracts').createSignedUrl(pdf_storage_path, 3600)
     * Plan documents: legal_documents joined by plan + org
     * Welcome packets, ID cards, certificates — if stored in a `member_documents` table (create in M9 if missing)
   - Group by category in collapsible sections
   - Search bar (client-side filter)

2. /profile — apps/portal/src/app/(member)/profile/page.tsx
   - Sections:
     * Personal info (name, dob, member_id with copy) — read-only with "Request change" CTA opening /plan/change
     * Contact info (email, phone, address) — editable; PATCH /api/member/profile updates the matching members + profiles row (CAREFUL: changing email should re-verify via Supabase Auth — phase 2, for now disable email editing with a tooltip "Contact support to change email")
     * Security (link to /profile/security): change password, change email
     * Sign out button

3. /profile/security — apps/portal/src/app/(member)/profile/security/page.tsx
   - Change password form (server action calls supabase.auth.updateUser)
   - Change email form (calls supabase.auth.updateUser, triggers re-verification email)
   - Show active sessions if Supabase supports it; otherwise skip

4. /support — apps/portal/src/app/(member)/support/page.tsx
   - Contact info card: phone, email, hours (env-driven)
   - "Send a message" form (subject, message, optional topic preselect from ?topic= query param)
   - Submitting creates a row in `support_tickets` (table in M9) + emails the configured support address
   - "My tickets" tab: shows ticket history with status

5. /notifications — apps/portal/src/app/(member)/notifications/page.tsx
   - List from `member_notifications` table (M9)
   - Mark all as read button
   - Bell icon in MemberShell shows unread count via a TanStack Query polling every 60s (or Supabase realtime channel if you want to be fancy — phase 2)

6. /access-denied — INTEGRATE existing route:
   - Add clear messaging for the "no active membership" case
   - "Sign out" + "Contact support" CTAs
   - Link to /support with topic=access

Print which of these routes already exist and what's already there before changing anything.
```

---

## PROMPT M9 — Database additions (additive migration)

```
Create supabase/migrations/202605220001_member_portal_tables.sql. ADDITIVE ONLY. No DROPs, no destructive ALTERs.

Every table: organization_id NOT NULL, RLS enabled, policies using get_user_organization_id() and member-ownership where applicable.

1. member_change_requests
   - id uuid PK
   - organization_id uuid NOT NULL REFERENCES organizations(id)
   - member_id uuid NOT NULL REFERENCES members(id)
   - request_type text NOT NULL CHECK (request_type IN (
       'add_dependent','remove_dependent','upgrade_plan','downgrade_plan',
       'change_iua','change_effective_date','cancel_membership','update_payment_method','other'))
   - status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','withdrawn','completed'))
   - payload jsonb NOT NULL DEFAULT '{}'::jsonb
   - decision_notes text
   - decided_by uuid REFERENCES profiles(id)
   - decided_at timestamptz
   - created_at, updated_at
   - indexes: (organization_id), (member_id), (status), (created_at desc)
   - RLS: members see their own (member_id matches their members.id via auth join); admins see org-wide

2. member_needs
   - id uuid PK
   - organization_id uuid NOT NULL
   - member_id uuid NOT NULL REFERENCES members(id)
   - need_number text UNIQUE (auto-generated NEED-YYYY-XXXXXX via trigger)
   - need_type text NOT NULL CHECK (need_type IN ('medical','dental','vision','prescription','mental_health','urgent_care','hospitalization','surgery','other'))
   - chief_complaint text
   - description text
   - provider_name text, provider_npi text, provider_address text, provider_phone text
   - date_of_service date
   - is_emergency boolean DEFAULT false
   - has_pre_existing_disclosure boolean DEFAULT false
   - pre_existing_details text
   - total_billed numeric(12,2)
   - amount_paid_by_member numeric(12,2) DEFAULT 0
   - other_coverage_paid numeric(12,2) DEFAULT 0
   - amount_requested numeric(12,2) GENERATED ALWAYS AS (total_billed - amount_paid_by_member - other_coverage_paid) STORED
   - amount_approved numeric(12,2)
   - amount_shared numeric(12,2)
   - status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','under_review','additional_info_requested','eligible','ineligible','sharing_scheduled','shared','closed','withdrawn'))
   - submitted_at timestamptz
   - reviewed_by uuid REFERENCES profiles(id)
   - reviewed_at timestamptz
   - metadata jsonb DEFAULT '{}'::jsonb
   - created_at, updated_at
   - indexes: (organization_id), (member_id), (status), (created_at desc), (need_number)

3. need_attachments
   - id uuid PK
   - need_id uuid NOT NULL REFERENCES member_needs(id) ON DELETE CASCADE
   - organization_id uuid NOT NULL
   - storage_path text NOT NULL
   - file_name text NOT NULL
   - mime_type text
   - size_bytes int
   - uploaded_by uuid NOT NULL REFERENCES profiles(id)
   - created_at
   - indexes: (need_id), (organization_id)

4. need_status_history (audit)
   - id uuid PK
   - need_id uuid NOT NULL REFERENCES member_needs(id) ON DELETE CASCADE
   - organization_id uuid NOT NULL
   - from_status text, to_status text NOT NULL
   - actor_profile_id uuid REFERENCES profiles(id)
   - notes text
   - created_at
   - immutable: INSERT-only policy

5. need_comments
   - id uuid PK
   - need_id uuid NOT NULL REFERENCES member_needs(id) ON DELETE CASCADE
   - organization_id uuid NOT NULL
   - author_profile_id uuid NOT NULL REFERENCES profiles(id)
   - author_kind text NOT NULL CHECK (author_kind IN ('member','admin'))
   - content text NOT NULL
   - created_at
   - indexes: (need_id, created_at)

6. member_documents
   - id uuid PK
   - organization_id uuid NOT NULL
   - member_id uuid NOT NULL REFERENCES members(id)
   - document_type text NOT NULL  -- 'id_card','certificate_of_sharing','welcome_packet','other'
   - title text NOT NULL
   - storage_path text NOT NULL
   - mime_type text
   - size_bytes int
   - issued_by uuid REFERENCES profiles(id)
   - issued_at timestamptz DEFAULT now()
   - expires_at timestamptz
   - is_active boolean DEFAULT true
   - created_at, updated_at

7. member_notifications
   - id uuid PK
   - organization_id uuid NOT NULL
   - member_id uuid NOT NULL REFERENCES members(id)
   - title text NOT NULL
   - body text
   - category text CHECK (category IN ('billing','need','plan','system','reminder','message'))
   - priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high'))
   - action_url text  -- internal /needs/{id} etc
   - is_read boolean DEFAULT false
   - read_at timestamptz
   - expires_at timestamptz
   - created_at
   - indexes: (member_id, is_read, created_at desc)

8. support_tickets
   - id uuid PK
   - organization_id uuid NOT NULL
   - member_id uuid NOT NULL REFERENCES members(id)
   - subject text NOT NULL
   - topic text CHECK (topic IN ('billing','billing-failure','plan','need','telehealth','access','advisor','general','other'))
   - status text DEFAULT 'open' CHECK (status IN ('open','pending_member','pending_admin','resolved','closed'))
   - priority text DEFAULT 'normal'
   - assigned_to uuid REFERENCES profiles(id)
   - created_at, updated_at, resolved_at
   - indexes: (organization_id), (member_id), (status)

9. support_ticket_messages
   - id uuid PK
   - ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE
   - organization_id uuid NOT NULL
   - author_profile_id uuid NOT NULL REFERENCES profiles(id)
   - author_kind text CHECK (author_kind IN ('member','admin','system'))
   - content text NOT NULL
   - attachments jsonb DEFAULT '[]'::jsonb
   - created_at
   - indexes: (ticket_id, created_at)

10. service_providers (curated partner directory)
   - id uuid PK
   - organization_id uuid NOT NULL  -- nullable allowed if you want a global catalog; for now org-scoped
   - category text NOT NULL CHECK (category IN ('telehealth','care','discount','labs','rx','hospital_debt_relief','other'))
   - name text NOT NULL
   - description text
   - logo_url text
   - external_url text NOT NULL
   - sso_kind text CHECK (sso_kind IN ('none','mytelemedicine','custom'))
   - sso_config jsonb DEFAULT '{}'::jsonb
   - sort_order int DEFAULT 0
   - is_active boolean DEFAULT true
   - plan_filters jsonb DEFAULT '[]'::jsonb  -- array of plan_codes or product_ids the provider applies to (empty = all)
   - created_at, updated_at

11. Storage buckets (create via supabase storage migration):
   - 'member-needs' — private bucket for need attachments. Storage RLS: SELECT/INSERT requires user has a membership in the org that matches the path's organization_id. Path prefix convention: needs/{member_id}/{need_id}/{filename}
   - 'member-documents' — private bucket for ID cards etc. Same RLS pattern.

12. Triggers:
   - Auto-generate need_number on member_needs INSERT (sequence per org per year)
   - Auto-insert need_status_history row when member_needs.status changes
   - Auto-create a member_notification when member_needs.status changes to certain values ('additional_info_requested','eligible','ineligible','shared')

13. At end: NOTIFY pgrst, 'reload schema';

After:
- Regenerate types: npm run db:types
- Run tsc --noEmit in apps/portal

Print the migration file before applying.
```

---

## PROMPT M10 — Telehealth SSO edge function

```
Build supabase/functions/telehealth-sso/index.ts — provider-agnostic edge function that signs a member-context payload and returns an SSO URL.

Behavior:
- POST endpoint, requires user JWT in Authorization header
- Body: { provider_id?: string } (defaults to env DEFAULT_TELEHEALTH_PROVIDER_ID)
- Steps:
  1. Verify JWT with anon client, get auth_user_id
  2. Service-role client: fetch profiles → organization_id, members row, current memberships row
  3. Verify the member has an active membership for this org; reject 403 if not
  4. Fetch service_providers row for the given provider_id (or default); reject 404 if not found or not active
  5. Build member-context payload: { member_id, primary_member_id, first_name, last_name, dob (MM/DD/YYYY), plan_code, dependent_number }
     - For dependents on family plans, compute dependent_number 01-99 by the same algorithm as MPB's mytelemedicine-sso:
       - Get primary member's all dependents (across both crm_records dependents module and dependents table)
       - Sort: spouses by DOB ascending, children by DOB ascending
       - Index of this member in the sorted list + 1 → zero-padded 2-digit string
  6. Dispatch by sso_kind:
     - 'mytelemedicine': POST to https://apis-x7onwxgyhq-uc.a.run.app/api/sso/lyric-url with { memberID, birthday } (use sso_config for any per-org overrides)
     - 'custom': POST to sso_config.url with the payload signed via HMAC using sso_config.secret_env_var (env var name lookup)
     - 'none': construct external_url with appended query params (memberId, dob)
  7. Return { sso_url, provider_name, expires_at }
- Retry logic: exponential backoff 3 attempts on 5xx from provider
- Errors: 400 (no member found), 401 (no JWT), 403 (no active membership), 404 (provider not found), 502 (provider failed), 504 (provider timeout)

Env vars used:
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
- MYTELEMEDICINE_API_KEY (legacy MPB)
- For 'custom' providers: arbitrary env vars referenced by sso_config.secret_env_var

Deploy: `supabase functions deploy telehealth-sso`

Print the file and a sample service_providers seed row before writing.
```

---

## PROMPT M11 — Smoke test, deploy, and operator runbook

```
Final pass: prove the member portal works end-to-end against a fresh smoke org. DO NOT touch the PIFH production org.

1. scripts/smoke-member-portal.ts (ts-node compatible)
   - Reads env from .env.local
   - Steps:
     a. Create smoke_test org (slug='smoke-portal-YYYYMMDD')
     b. Create a test plan, advisor, and an approved enrollment with initial_payment_paid=true (reuses the createEnrollment flow from the earlier upgrade plan)
     c. Create a Supabase Auth user (test-member-{ts}@example.com), insert profile + members row linked to that user
     d. POST /api/member/profile via fetch with the user's JWT — assert 200 and member_id returned
     e. POST /api/member/billing-schedule — assert next_billing_date present
     f. POST /api/member/needs (submit a fake need with no attachments) — assert need_number returned
     g. GET /api/member/needs — assert the new need appears
     h. POST /api/member/services/telehealth/sso — assert 200 (mock the provider call in test mode via PROVIDER_MOCK=true env)
     i. POST /api/member/support — submit a ticket; assert it lands in support_tickets
   - Each step prints PASS/FAIL
   - Cleanup: print a one-line DELETE for the smoke org

2. apps/portal/vercel.json — INTEGRATE:
   - Ensure crons (if any) and headers configured (CSP allowing manifest, service worker scope, image domains for service_providers.logo_url)

3. Env vars to set in Vercel (Production scope, apps/portal):
   - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (standard)
   - SUPABASE_SERVICE_ROLE_KEY (server-only)
   - INTERNAL_API_TOKEN (shared with /api/contracts/generate from the earlier upgrade plan)
   - SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_HOURS_TEXT
   - DEFAULT_TELEHEALTH_PROVIDER_ID (a service_providers.id, set after seed)
   - MYTELEMEDICINE_API_KEY (if using that provider)

4. docs/MEMBER_PORTAL_RUNBOOK.md — create:
   - Routes overview (all the (member)/* routes and what they do)
   - "How to seed service providers" with example SQL
   - "How to generate icons for the manifest" (use a tool like maskable.app and store under public/icons)
   - "How to disable a misbehaving telehealth provider": UPDATE service_providers SET is_active=false WHERE id=$1
   - "How to investigate a member's billing issue" — common queries
   - Rollback: how to revert if the portal goes wrong (Vercel instant rollback + last-known-good migration tag)

5. End-of-build checklist:
   - npm run typecheck -w apps/portal → 0 errors
   - npm run build -w apps/portal → success
   - Lighthouse PWA score ≥ 90 on /
   - Manual flow: log in as a test member → all 6 main pages load without console errors
   - Test on iOS Safari and Android Chrome (real devices ideally)
   - Test "Install" flow on both platforms

Print the smoke script and runbook before running anything.
```

---

# Operator execution checklist

- [ ] Backup before starting: `supabase db dump --linked --file backups/pre-portal-build-$(date +%F).sql`
- [ ] Run prompts M1 → M11 in order. After each: review diff, typecheck, test in browser, commit.
- [ ] Deploy edge function: `supabase functions deploy telehealth-sso`
- [ ] Seed `service_providers` with at least one telehealth provider before testing M10
- [ ] Generate proper PWA icons (replace the placeholders from M1) — use maskable.app or your design source
- [ ] Set Vercel env vars per M11 list
- [ ] Run `npm run smoke:member-portal` against a fresh smoke org
- [ ] Manually test on a real iOS and Android device
- [ ] Soft-launch: enable for the PIFH org only, monitor for 72 hours before broader rollout

# What I deliberately did NOT do

- Rebuild auth from scratch — the existing portal already has signin/signup/reset-password routes. M1's layout shell sits on top.
- Use the existing `apps/portal/src/app/api` for everything — the new `(member)` route group adds a clean tree separate from the agent/* tree.
- Embed Cognito Forms for payment update like MPB does. We use Authorize.Net Accept.js or the BillingService directly because billing data already lives in CRM-Eco's database.
- Redirect submit-a-need to an external portal. CRM-Eco owns this flow with its own tables and admin workflow.
- Hardcode plan document URLs by product_id like MPB does. We pull from the `legal_documents` table created in the earlier upgrade plan.

# Open questions (answer once before kickoff if you know)

1. **Which existing portal routes are stubs vs. built?** I assumed most are placeholders. If `/billing` or `/profile` already have substantial pages, the M4/M8 prompts say "INTEGRATE" — so they'll merge cleanly.
2. **What's the linking column between auth.users and `members`?** Likely `members.user_id` or `members.email`. M2 has Cursor STOP and ask if it can't find it.
3. **Is `service_providers` data going to be org-scoped or global?** Default in M9 is org-scoped. Switch to global if you want a single curated partner catalog across all tenants.
4. **Which telehealth provider for launch?** MyTelemedicine (matches MPB)? Teladoc? Other? Set DEFAULT_TELEHEALTH_PROVIDER_ID accordingly.
5. **Chat widget: Zoho SalesIQ (like MPB) or Intercom or none for launch?** M8's support page works without a chat widget — the widget is optional.
