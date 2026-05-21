# CRM-Eco Operations Runbook

Last updated: 2026-05-21

This runbook covers deployment, monitoring, and rollback procedures for the
crm-eco production stack — backend automation (billing, commissions, contracts,
price changes) plus the public enrollment wizard.

---

## 1. Architecture Overview

```
[Vercel Cron] ──► [Next.js Route Handler /api/cron/*] ──► [Supabase Edge Function]
                                                          │
                                                          ▼
                                                    [Postgres + RLS]
```

| Component                       | Where                                              | Trigger                       |
|--------------------------------|----------------------------------------------------|-------------------------------|
| Process Billing                 | `apps/admin/src/app/api/cron/process-billing`      | Hourly (`0 * * * *`)          |
| Process Commissions (per-txn)   | `apps/admin/src/app/api/cron/process-commissions`  | Daily 03:30 UTC               |
| Send Scheduled Emails           | `apps/admin/src/app/api/cron/send-scheduled-emails`| Every 5 min                   |
| Billing Retry / Dunning         | `apps/admin/src/app/api/cron/billing-retry`        | Daily 16:00 UTC               |
| Price Change Apply              | `apps/admin/src/app/api/cron/price-change`         | Daily 10:00 UTC               |
| Commission Accrual (monthly)    | `apps/admin/src/app/api/cron/commissions-accrual`  | 1st of month 02:00 UTC        |
| AuthNet Webhook                 | `supabase/functions/authnet-webhook` (public POST) | External (Authorize.Net)      |
| Public Enrollment Wizard        | `apps/portal/src/app/enroll/[slug]/*`              | Public landing pages          |

All cron routes validate `CRON_SECRET` Bearer token. All edge functions use
the `SUPABASE_SERVICE_ROLE_KEY` for elevated writes.

---

## 2. Required Environment Variables

### Vercel — admin app

```
CRON_SECRET                       # Random 256-bit token; matches Vercel cron Bearer
SUPABASE_URL                      # https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY         # Service role JWT
NEXT_PUBLIC_SUPABASE_URL          # Mirror of SUPABASE_URL for client
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Anon JWT
RESEND_API_KEY                    # For dunning + transactional email
RESEND_FROM_EMAIL                 # noreply@yourdomain.com
RESEND_FROM_NAME                  # "Pay It Forward Health"
```

### Vercel — portal app

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ENROLL_DRAFT_SECRET               # 32-byte random; HMAC for public draft cookies
RECAPTCHA_SECRET                  # reCAPTCHA v3 secret (omit in dev to bypass)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY    # reCAPTCHA v3 site key (client-side)
```

### Supabase — Edge Function secrets

```
AUTHNET_API_LOGIN_ID
AUTHNET_TRANSACTION_KEY
AUTHNET_API_ENDPOINT              # https://api.authorize.net/xml/v1/request.api (or apitest)
AUTHNET_SIGNATURE_KEY             # HMAC-SHA512 secret from Authorize.Net portal
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
ALLOWED_ORIGINS                   # Comma-separated list, or "*"
STRIPE_SECRET_KEY                 # Optional — only if using stripe-connect payouts
```

Set Supabase secrets via:

```bash
npx supabase secrets set AUTHNET_API_LOGIN_ID=... AUTHNET_TRANSACTION_KEY=... \
  AUTHNET_SIGNATURE_KEY=... RESEND_API_KEY=...
```

---

## 3. Deploying Database Migrations

```bash
# Always start with a backup
supabase db dump --linked --file backups/pre-deploy-$(date +%F).sql

# Apply pending migrations
npx supabase db push --linked

# Verify with smoke tests
npx tsx scripts/smoke-enrollment-billing-commission.ts
```

Migrations are additive — never DROP a column or table. If a column needs
removal, mark it deprecated in a migration and remove it in a follow-up.

---

## 4. Deploying Edge Functions

```bash
# Deploy a single function
npx supabase functions deploy <name> --use-api

# For public webhooks, disable JWT verification
npx supabase functions deploy authnet-webhook --use-api --no-verify-jwt
```

After deployment, verify the function is reachable:

```bash
curl -X POST https://<ref>.functions.supabase.co/<name> \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"a0000000-0000-0000-0000-000000000001","probe":true}'
```

---

## 5. Verifying Cron Jobs

After Vercel deploy, the active cron schedule appears in:

```
Vercel Dashboard → Project (admin) → Settings → Cron Jobs
```

Each job logs to `billing_job_runs` (for billing/commission jobs) and to
the Vercel function logs. Recent runs are visible in the admin UI under
**Billing → Billing Automation → Recent Job Runs**.

To manually trigger a cron route (e.g. for testing):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://admin.doublehelixhub.com/api/cron/billing-retry
```

---

## 6. Monitoring Failed Payments

Failed billing transactions are tracked in two tables:

- `billing_transactions` — raw transaction record (status='failed')
- `billing_failures` — dunning state (retry_count, resolved, status)

The `billing-retry` cron processes unresolved failures with this dunning
schedule (configurable in `supabase/functions/billing-retry/index.ts`):

| Attempt | Days After Initial Failure | Email Template          |
|---------|---------------------------|-------------------------|
| 1       | 1 day                     | payment_failed_attempt_1|
| 2       | 4 days                    | payment_failed_attempt_2|
| 3       | 7 days                    | payment_failed_attempt_3|
| Abandon | 14 days                   | payment_abandoned       |

A successful retry triggers a `payment_recovered` email.

To monitor: `select * from billing_failures where resolved = false order by retry_count desc`

---

## 7. Price Change Workflow

1. Admin creates a schedule via **Billing → Price Changes → Schedule Price Change**
2. Schedule sits in `pending` until the cron at 10:00 UTC daily picks it up
3. Cron invokes `apply-price-change` edge function
4. Function creates immutable `price_change_audit` rows (one per enrollment)
5. Function updates `enrollments.base_monthly_cost`, which cascades via
   `sync_billing_schedule_on_enrollment_update()` trigger to `billing_schedules.amount`
6. Schedule moves to `completed` (or `failed` if any rows errored)

Manual execution via API: `POST /api/price-changes/<id>/execute`

---

## 8. Authorize.Net Webhook Setup

In the Authorize.Net merchant portal:

1. Account → **Webhooks**
2. Add webhook URL: `https://<ref>.functions.supabase.co/authnet-webhook`
3. Select events:
   - `net.authorize.payment.authcapture.created`
   - `net.authorize.payment.refund.created`
   - `net.authorize.payment.void.created`
   - `net.authorize.customer.subscription.failed`
4. Copy the **Signature Key** and set:
   ```bash
   npx supabase secrets set AUTHNET_SIGNATURE_KEY="..."
   ```
5. Test by sending a $1 charge — verify `payment_webhooks` table receives the
   event with `signature_valid=true`.

---

## 9. Rollback Procedures

### Rolling back a migration

Migrations are additive. To "rollback" a column or table addition:

```sql
-- Create a new migration that DROPs only what you added
-- (not what was there before)
ALTER TABLE my_table DROP COLUMN IF EXISTS new_col;
```

### Rolling back an edge function

```bash
# Deploy the previous version from git
git checkout <prev-sha> -- supabase/functions/<name>
npx supabase functions deploy <name> --use-api
git checkout HEAD -- supabase/functions/<name>
```

### Rolling back a Vercel deploy

In the Vercel dashboard, use **Deployments → previous deployment → Promote to Production**.

---

## 10. Smoke Test

Run the end-to-end smoke test against the dedicated smoke org
(`a0000000-0000-0000-0000-000000000001`):

```bash
npx tsx scripts/smoke-enrollment-billing-commission.ts
```

It validates:

- Schema: `legal_documents`, `inactive_reasons`, `billing_automation_config`, `agreement_signatures`, `payment_webhooks`, `price_change_schedules`
- Triggers: `compute_first_billing_date()`
- RPCs: `create_enrollment_tx()`
- Edge functions deployed: `billing-retry`, `apply-price-change`, `process-billing`, `process-commissions`, `payouts-process`, `authnet-webhook`, `generate-enrollment-contract`

Expected: **15/15 passing** (with `AUTHNET_SIGNATURE_KEY` warning if not configured in env).

---

## 11. Common Issues

### "Function returned a non-2xx status code"

Usually means the function ran but returned an error response. Check:

1. Supabase Functions logs: `npx supabase functions logs <name>`
2. The corresponding `billing_job_runs` row's `error_log` field
3. Authorize.Net credentials configured: `npx supabase secrets list`

### "RLS policy violation"

The cron routes use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. If you
see RLS errors:

1. Verify the route is using `createServiceRoleClient()` not `createServerSupabaseClient()`
2. Check the policy on the affected table — `payment_webhooks` is service-only by design

### Public enrollment wizard "no_active_draft" error

The signed cookie has expired (7-day TTL) or the secret rotated. The
member needs to restart at `/enroll/<slug>/start`.

---

## 12. Contacts

- **Vercel:** team `oi-agent` — https://vercel.com/oi-agent
- **GitHub:** `omnivurse/crm-eco`
- **Supabase project:** `PIF-ECO-V2` (`sffisarikcreyyjzdjvb`, East US Ohio)
- **Production URL:** https://admin.doublehelixhub.com
