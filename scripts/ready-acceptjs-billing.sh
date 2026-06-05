#!/usr/bin/env bash
# Deploy process-payment edge function + print Accept.js key checklist.
# Usage:
#   ./scripts/ready-acceptjs-billing.sh              # staging (linked project)
#   ./scripts/ready-acceptjs-billing.sh production   # prod ref below
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGING_REF="cammurefjywnzxnmuyfv"
PROD_REF="sffisarikcreyyjzdjvb"
TARGET="${1:-staging}"

if [[ "$TARGET" == "production" ]]; then
  REF="$PROD_REF"
else
  REF="$STAGING_REF"
fi

echo "==> Deploying process-payment to Supabase project $REF ..."
supabase functions deploy process-payment --project-ref "$REF"

cat <<EOF

==> Deploy complete. Drop-in checklist when Authorize.Net keys arrive:

Supabase secrets (Dashboard → Project Settings → Edge Functions → Secrets, or CLI):
  supabase secrets set --project-ref $REF \\
    AUTHORIZE_NET_API_LOGIN_ID=your-api-login-id \\
    AUTHORIZE_NET_TRANSACTION_KEY=your-transaction-key \\
    AUTHORIZE_NET_ENVIRONMENT=sandbox

  (Aliases also work: AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY)

Vercel → crm-eco-portal → Environment Variables (Production + Preview):
  NEXT_PUBLIC_AUTHORIZE_NET_API_LOGIN_ID=your-api-login-id
  NEXT_PUBLIC_AUTHORIZE_NET_CLIENT_KEY=your-public-client-key
  NEXT_PUBLIC_AUTHORIZE_NET_ENVIRONMENT=sandbox

After setting Vercel vars, redeploy portal (or push to main).
Member flow: /billing/methods/new

Verify (no real card charge in sandbox):
  1. Log into member portal
  2. Billing → Add payment method
  3. Use Authorize.Net sandbox test card 4111111111111111

EOF
