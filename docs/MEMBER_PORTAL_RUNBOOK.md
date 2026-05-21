# Member Portal Runbook

Operations guide for `apps/portal` — the Double Helix Hub member-facing PWA.

## 1. Routes overview

### Public / authentication
- `/login`, `/signup`, `/reset-password`, `/update-password`
- `/access-denied?reason={no_member|no_membership}` — gate failure landing
- `/enroll/[slug]/{start,agreement,done}` — public enrollment wizard (Track A P11)

### Member-gated (require `requireActiveMembership()`)
- `/` — Dashboard (welcome, billing, advisor, needs, tickets, failure banner)
- `/billing` — overview (existing rich page) + sub-routes:
  - `/billing/failures` — open billing failures + resolution actions
  - `/billing/methods/new` — add payment method (Authorize.Net Accept.js placeholder)
- `/plan` — plan overview, change requests, plan documents, signed agreements
  - `/plan/change` — submit a `member_change_request`
  - `/plan/cancel` — submit a `cancel_membership` request (2-step confirm)
- `/dependents` — manage dependents (existing)
- `/needs` — list member's needs; `/needs/new` — submit-a-need wizard
- `/services` — provider search (existing) + sub-routes:
  - `/services/telehealth` — SSO launcher (uses `service_providers.sso_kind`)
  - `/services/care`, `/services/discounts`, `/services/labs`, `/services/rx`
  - `/services/hospital-debt-relief` — eligibility + partners
- `/documents` — agreement signatures + plan docs + member docs (existing)
- `/profile` — read-only personal info + editable contact (existing)
  - `/profile/security` — change password, change email
- `/support` — tickets (existing)
- `/notifications` — DB-backed `member_notifications` with mark-as-read
- `/coverage`, `/pricing`, `/settings`, `/agent/*` (existing)

### API route handlers (`/api/member/*`)
- `GET  /api/member/profile` — current member context
- `GET  /api/member/billing-schedule` — active billing schedule
- `GET  /api/member/payment-profiles` — saved payment methods
- `GET  /api/member/transactions?limit&offset&status`
- `GET  /api/member/invoices?limit&offset&status`
- `GET/POST /api/member/dependents` — list / create change request
- `GET  /api/member/enrollments`
- `GET/PATCH /api/member/notifications` — list / mark read
- `GET/POST /api/member/change-requests`
- `GET/POST /api/member/needs` — list / submit
- `GET/POST /api/member/needs/[id]/attachments`
- `GET/POST /api/member/needs/[id]/comments`
- `POST /api/member/services/[id]/sso` — invokes `telehealth-sso` edge function

## 2. Database additions (Track B M9)

Migration: `202605220001_member_portal_tables.sql`

| Table                     | Purpose                                                    |
|---------------------------|------------------------------------------------------------|
| `member_change_requests`  | Member-initiated plan changes / cancellations              |
| `need_attachments`        | Files attached to existing `needs` rows                    |
| `member_documents`        | ID cards, certificates of sharing, welcome packets         |
| `member_notifications`    | In-portal inbox; auto-created on `needs.status` change     |
| `service_providers`       | Curated partner directory (telehealth, RX, labs, etc.)     |

Migration: `202605220002_member_portal_storage.sql`
- Buckets: `member-needs` (private), `member-documents` (private)
- RLS: members can read only paths under their own `member_id`

Existing tables we INTEGRATE (do not duplicate):
- `needs` — covers the `member_needs` use case
- `need_events` — covers status history + comments
- `tickets`, `ticket_comments` — cover support tickets

## 3. Required environment variables

### Vercel (`apps/portal` Production scope)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Support contact info (rendered in /support)
SUPPORT_EMAIL=support@doublehelixhub.com
SUPPORT_PHONE=
SUPPORT_HOURS_TEXT=

# Default telehealth provider for /services/telehealth one-click launch
DEFAULT_TELEHEALTH_PROVIDER_ID=<service_providers.id>
```

### Supabase secrets (set with `supabase secrets set`)
```
MYTELEMEDICINE_API_KEY=          # only if using sso_kind='mytelemedicine'
DEFAULT_TELEHEALTH_PROVIDER_ID=  # mirrors Vercel — the edge function reads this
```

## 4. Deploying the telehealth edge function

```bash
npx supabase functions deploy telehealth-sso --use-api
```

To set required secrets:
```bash
npx supabase secrets set MYTELEMEDICINE_API_KEY=...
```

## 5. Seeding service providers

Example: a MyTelemedicine telehealth provider for the PIFH org.

```sql
INSERT INTO service_providers (
  organization_id, category, name, description,
  external_url, sso_kind, sso_config, sort_order
) VALUES (
  '<pifh_org_id>',
  'telehealth',
  'MyTelemedicine',
  '24/7 virtual urgent care for you and your dependents.',
  'https://mytelemedicine.com',
  'mytelemedicine',
  '{"endpoint":"https://apis-x7onwxgyhq-uc.a.run.app/api/sso/lyric-url"}'::jsonb,
  10
);
```

For a "no SSO, just a link" partner:
```sql
INSERT INTO service_providers (
  organization_id, category, name, external_url, sso_kind, sort_order
) VALUES (
  '<org_id>', 'rx', 'RX Valet', 'https://rxvalet.com', 'none', 20
);
```

## 6. Disable a misbehaving provider
```sql
UPDATE service_providers SET is_active=false WHERE id=$1;
```

## 7. Investigate a member's billing issue

```sql
-- Schedule + last failure
SELECT bs.*, bf.failure_reason, bf.next_retry_date
FROM billing_schedules bs
LEFT JOIN billing_failures bf ON bf.billing_schedule_id = bs.id AND bf.resolved=false
WHERE bs.member_id = $1
ORDER BY bs.created_at DESC;

-- Last 10 transactions
SELECT * FROM billing_transactions
WHERE member_id = $1
ORDER BY created_at DESC LIMIT 10;
```

## 8. Smoke test

```bash
npx tsx scripts/smoke-member-portal.ts
```

Checks: 5 new tables + 6 existing tables, RLS access, service-role inserts,
edge function deployment, storage buckets.

## 9. Rollback

- Vercel: instant rollback via dashboard → Deployments → previous deployment → "Promote to Production".
- Schema: migrations are additive; revert by `DROP TABLE IF EXISTS …` if absolutely necessary,
  but prefer disabling features via `service_providers.is_active=false` or feature flags.

## 10. End-of-build checklist

- [ ] `npx tsc --noEmit -p apps/portal/tsconfig.json` → 0 errors
- [ ] `npx tsx scripts/smoke-member-portal.ts` → all pass
- [ ] Lighthouse PWA score ≥ 90 on `/`
- [ ] Manual flow: log in as test member → all 6 main pages load without console errors
- [ ] Test on iOS Safari and Android Chrome
- [ ] Confirm `manifest.json` shortcuts appear from the install prompt
