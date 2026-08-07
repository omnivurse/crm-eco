/**
 * Payouts Process Edge Function
 *
 * Picks up an approved commission_payout and dispatches it to the
 * configured provider (stripe-connect | ach | manual). Uses an
 * advisory lock to ensure idempotent processing per payout id.
 *
 * Triggered manually from the admin UI; can also be wired to a cron.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { unauthorizedResponse } from '../_shared/cron-auth.ts';
import { callerMayAccessOrg, FINANCIAL_ROLES } from '../_shared/org-auth.ts';

// No '*' default: this endpoint moves money, so an unconfigured ALLOWED_ORIGINS
// must not make it callable cross-origin from any page on the internet.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
  };
  if (ALLOWED_ORIGINS.includes('*')) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  // Otherwise emit no ACAO header at all — the browser blocks the response.
  return headers;
}

interface DispatchResult {
  success: boolean;
  reference?: string;
  message?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { payout_id } = await req.json();
    if (!payout_id) {
      return jsonResponse(corsHeaders, 400, { error: 'payout_id required' });
    }

    // Read the payout FIRST so authorization can be anchored to the row's own
    // organization_id. Deriving the org from the request body instead would make
    // the check circular and therefore worthless.
    const { data: payout, error } = await supabase
      .from('commission_payouts')
      .select(
        'id, organization_id, status, advisor_id, net_payout, payment_method, ' +
          'advisor:advisors(id, first_name, last_name, email, custom_fields)',
      )
      .eq('id', payout_id)
      .single();

    if (error || !payout) {
      return jsonResponse(corsHeaders, 404, { error: 'payout_not_found' });
    }

    // AUTHORIZATION. This function holds the service-role key, so RLS is not a
    // backstop — this check is the only thing standing between a request and a
    // real Stripe/ACH transfer. Note the platform `verify_jwt` gate accepts the
    // public anon key, so it authenticates nothing.
    const authorized = await callerMayAccessOrg(supabase, req, payout.organization_id as string, {
      requiredRoles: [...FINANCIAL_ROLES],
    });
    if (!authorized) {
      console.warn('[PAYOUTS-PROCESS] Unauthorized attempt on payout', payout_id);
      return unauthorizedResponse(corsHeaders);
    }

    const orgId = payout.organization_id as string;

    // Atomically claim the payout. The previous `pg_try_advisory_lock` RPC could
    // never work — that function is not in the `public` schema and is not exposed
    // by PostgREST, and the `.catch(() => ({ data: null }))` swallowed the
    // failure, so `lock === false` never fired and double-dispatch was NOT
    // prevented. A conditional UPDATE is atomic in Postgres and also subsumes the
    // old `status !== 'approved'` pre-check.
    const { data: claimed, error: claimError } = await supabase
      .from('commission_payouts')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', payout_id)
      .eq('organization_id', orgId)
      .eq('status', 'approved')
      .select('id');

    if (claimError) {
      return jsonResponse(corsHeaders, 500, { error: 'claim_failed', message: claimError.message });
    }
    if (!claimed || claimed.length === 0) {
      return jsonResponse(corsHeaders, 409, {
        error: 'not_claimable',
        message: `Payout must be 'approved' and unclaimed; it is '${payout.status}'.`,
      });
    }

    const provider = (payout.payment_method ?? 'manual') as 'stripe-connect' | 'ach' | 'manual';
    const result = await dispatchPayment(provider, payout);

    if (result.success) {
      await supabase
        .from('commission_payouts')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: result.reference ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payout_id)
        .eq('organization_id', orgId);

      await supabase
        .from('commission_transactions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payout_id,
        })
        .eq('organization_id', orgId)
        .eq('advisor_id', payout.advisor_id)
        .eq('status', 'approved')
        .is('payout_id', null);

      return jsonResponse(corsHeaders, 200, {
        payout_id,
        status: 'paid',
        reference: result.reference,
      });
    }

    await supabase
      .from('commission_payouts')
      .update({
        status: 'failed',
        notes: result.message ?? 'Payment dispatch failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payout_id)
      .eq('organization_id', orgId);

    return jsonResponse(corsHeaders, 500, {
      payout_id,
      status: 'failed',
      message: result.message,
    });
  } catch (err) {
    console.error('[PAYOUTS-PROCESS] Fatal:', err);
    return jsonResponse(corsHeaders, 500, {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

function jsonResponse(headers: Record<string, string>, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function dispatchPayment(
  provider: 'stripe-connect' | 'ach' | 'manual',
  payout: any,
): Promise<DispatchResult> {
  const amountCents = Math.round((payout.net_payout ?? 0) * 100);

  switch (provider) {
    case 'stripe-connect': {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const accountId = payout.advisor?.custom_fields?.stripe_account_id;
      if (!stripeKey || !accountId) {
        return { success: false, message: 'Stripe not configured for this advisor' };
      }
      const response = await fetch('https://api.stripe.com/v1/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          // The database claim prevents concurrent workers, but it cannot make
          // the external transfer + local status update atomic. Reusing the
          // payout id lets Stripe return the original transfer when a worker
          // succeeds remotely and then crashes before persisting `paid`.
          'Idempotency-Key': `commission-payout:${payout.id}`,
        },
        body: new URLSearchParams({
          amount: String(amountCents),
          currency: 'usd',
          destination: accountId,
          // Stripe form-encoded map parameters use bracket notation.
          'metadata[payout_id]': payout.id,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, reference: data.id };
      }
      return { success: false, message: data?.error?.message ?? 'Stripe transfer failed' };
    }

    case 'ach': {
      // ACH dispatch goes through the existing payouts/providers infrastructure;
      // for now we record a generated reference and let the manual workflow finalize.
      const reference = `ACH-${payout.id.slice(0, 8)}-${Date.now()}`;
      return { success: true, reference, message: 'ACH dispatch queued' };
    }

    case 'manual':
    default:
      return { success: true, reference: `MANUAL-${payout.id.slice(0, 8)}` };
  }
}
