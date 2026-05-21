/**
 * Authorize.Net Webhook Handler
 *
 * Receives webhook notifications from Authorize.Net (settlement events,
 * customer profile changes, etc.), validates the HMAC SHA-512 signature,
 * dedupes by `payment_webhooks.event_id`, and dispatches downstream
 * processing for known event types.
 *
 * Public endpoint — no JWT verification — but every request must carry
 * the `X-ANET-Signature` header containing the HMAC of the raw payload.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

interface AnetWebhookPayload {
  notificationId?: string;
  eventType?: string;
  eventDate?: string;
  webhookId?: string;
  payload?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anet-signature',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const signatureKey = Deno.env.get('AUTHNET_SIGNATURE_KEY');
  if (!signatureKey) {
    console.error('[AUTHNET-WEBHOOK] AUTHNET_SIGNATURE_KEY not configured');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const headerSignature = req.headers.get('x-anet-signature') || '';

  const computed = createHmac('sha512', signatureKey).update(rawBody).digest('hex');
  const provided = headerSignature.replace(/^sha512=/, '').toLowerCase();
  const signatureValid = computed.toLowerCase() === provided;

  let payload: AnetWebhookPayload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { eventType: 'invalid_json' };
  }

  const eventId = payload.notificationId
    ?? payload.webhookId
    ?? `${payload.eventType ?? 'unknown'}_${Date.now()}`;
  const eventType = payload.eventType ?? 'unknown';

  const { error: insertErr } = await supabase
    .from('payment_webhooks')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload,
      signature_valid: signatureValid,
      processed: false,
    });

  if (insertErr) {
    if (insertErr.code === '23505') {
      console.log(`[AUTHNET-WEBHOOK] Duplicate event_id ${eventId} — already processed`);
      return new Response(JSON.stringify({ status: 'duplicate' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[AUTHNET-WEBHOOK] Insert error:', insertErr);
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!signatureValid) {
    console.warn(`[AUTHNET-WEBHOOK] Invalid signature for event ${eventId}`);
    await supabase
      .from('payment_webhooks')
      .update({
        processing_error: 'invalid_hmac_signature',
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('event_id', eventId);
    return new Response(JSON.stringify({ error: 'invalid_signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let processingError: string | null = null;
  try {
    await dispatchEvent(supabase, eventType, payload);
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[AUTHNET-WEBHOOK] Dispatch error for ${eventType}:`, processingError);
  }

  await supabase
    .from('payment_webhooks')
    .update({
      processed: !processingError,
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq('event_id', eventId);

  return new Response(JSON.stringify({ status: processingError ? 'error' : 'ok', event_id: eventId }), {
    status: processingError ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * Dispatch a verified event to its handler. Unknown events are logged
 * but not treated as errors so future event types don't break the webhook.
 */
async function dispatchEvent(supabase: any, eventType: string, payload: AnetWebhookPayload) {
  const data = payload.payload ?? {};

  switch (eventType) {
    case 'net.authorize.payment.authcapture.created':
    case 'net.authorize.payment.capture.created':
      await markTransactionSettled(supabase, data);
      break;

    case 'net.authorize.payment.refund.created':
    case 'net.authorize.payment.void.created':
      await markTransactionRefundedOrVoided(supabase, eventType, data);
      break;

    case 'net.authorize.customer.subscription.failed':
    case 'net.authorize.payment.fraud.declined':
      await flagFailedTransaction(supabase, data);
      break;

    default:
      console.log(`[AUTHNET-WEBHOOK] No handler for event ${eventType} — recorded only`);
  }
}

async function markTransactionSettled(supabase: any, data: Record<string, unknown>) {
  const transId = (data.id || data.transId) as string | undefined;
  if (!transId) return;
  await supabase
    .from('billing_transactions')
    .update({
      status: 'success',
      authorize_transaction_id: transId,
      processed_at: new Date().toISOString(),
    })
    .eq('authorize_transaction_id', transId)
    .neq('status', 'success');
}

async function markTransactionRefundedOrVoided(supabase: any, eventType: string, data: Record<string, unknown>) {
  const transId = (data.id || data.transId) as string | undefined;
  if (!transId) return;
  const newStatus = eventType.includes('refund') ? 'refunded' : 'voided';
  await supabase
    .from('billing_transactions')
    .update({ status: newStatus, processed_at: new Date().toISOString() })
    .eq('authorize_transaction_id', transId);
}

async function flagFailedTransaction(supabase: any, data: Record<string, unknown>) {
  const transId = (data.id || data.transId) as string | undefined;
  if (!transId) return;
  await supabase
    .from('billing_transactions')
    .update({ status: 'failed', error_message: 'flagged_by_webhook', processed_at: new Date().toISOString() })
    .eq('authorize_transaction_id', transId);
}
