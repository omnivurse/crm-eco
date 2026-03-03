/**
 * Stripe Payout Webhook Handler
 *
 * Processes Stripe Connect transfer events for payout reconciliation.
 * Extends the existing webhook infrastructure.
 *
 * Events handled:
 *   - transfer.created    → mark submitted
 *   - transfer.paid       → mark succeeded
 *   - transfer.failed     → mark failed
 *   - transfer.reversed   → mark reversed
 */

import Stripe from 'stripe';
import { registerWebhookHandler } from '../router';
import type { WebhookHandler, WebhookResult, WebhookContext } from '../types';

class StripePayoutWebhookHandler implements WebhookHandler {
  readonly providerId = 'stripe_payouts';

  private _stripe: Stripe | null = null;

  private get stripe(): Stripe {
    if (!this._stripe) {
      const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_placeholder';
      this._stripe = new Stripe(apiKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
    return this._stripe;
  }

  async verifySignature(
    payload: string,
    signature: string | null
  ): Promise<boolean> {
    if (!signature) return false;

    const webhookSecret = process.env.STRIPE_PAYOUT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('STRIPE_PAYOUT_WEBHOOK_SECRET not configured');
      return false;
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      console.error('Stripe payout signature verification failed:', error);
      return false;
    }
  }

  parseEvent(
    payload: string,
    headers: Record<string, string>
  ): { eventType: string; data: unknown } {
    const signature = headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_PAYOUT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET!;

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return { eventType: event.type, data: event };
  }

  async processEvent(
    eventType: string,
    data: unknown,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const event = data as Stripe.Event;

    // Only handle transfer events
    if (!eventType.startsWith('transfer.')) {
      return {
        success: true,
        eventType,
        message: `Event ${eventType} acknowledged but not a transfer event`,
      };
    }

    const transfer = event.data.object as Stripe.Transfer;
    const providerTransactionId = transfer.id;

    if (!context.supabase) {
      return {
        success: false,
        eventType,
        error: 'No Supabase client in context',
      };
    }

    // Find the matching provider transaction
    const { data: txn, error: findError } = await context.supabase
      .from('payout_provider_transactions')
      .select('id, payout_item_id, batch_id, status')
      .eq('provider_transaction_id', providerTransactionId)
      .maybeSingle();

    if (findError) {
      return {
        success: false,
        eventType,
        error: `DB error finding transaction: ${findError.message}`,
      };
    }

    if (!txn) {
      // Not our transaction — acknowledge but don't process
      return {
        success: true,
        eventType,
        message: `Transfer ${providerTransactionId} not found in payout_provider_transactions — may be unrelated`,
      };
    }

    // Map Stripe event to our status
    let newStatus: string;
    let failureReason: string | undefined;
    switch (eventType) {
      case 'transfer.created':
        newStatus = 'submitted';
        break;
      case 'transfer.paid':
        newStatus = 'succeeded';
        break;
      case 'transfer.failed':
        newStatus = 'failed';
        failureReason = 'Transfer failed (Stripe webhook)';
        break;
      case 'transfer.reversed':
        newStatus = 'reversed';
        failureReason = 'Transfer reversed (Stripe webhook)';
        break;
      default:
        return {
          success: true,
          eventType,
          message: `Unhandled transfer event: ${eventType}`,
        };
    }

    // Idempotency: don't downgrade terminal states
    if (txn.status === 'succeeded' && newStatus === 'submitted') {
      return {
        success: true,
        eventType,
        message: 'Transaction already succeeded — ignoring submitted event',
      };
    }

    // Update via RPC for proper cascading
    const { data: result, error: updateError } = await context.supabase.rpc(
      'record_provider_result',
      {
        p_txn_id: txn.id,
        p_status: newStatus,
        p_provider_txn_id: providerTransactionId,
        p_raw_response: {
          event_id: event.id,
          event_type: eventType,
          transfer_amount: transfer.amount,
          transfer_currency: transfer.currency,
        },
        p_failure_reason: failureReason || null,
        p_failure_code: null,
      }
    );

    if (updateError) {
      return {
        success: false,
        eventType,
        error: `Failed to record result: ${updateError.message}`,
      };
    }

    // Log to payout_batch_logs
    await context.supabase.from('payout_batch_logs').insert({
      organization_id: context.orgId,
      batch_id: txn.batch_id,
      action: newStatus === 'succeeded' ? 'paid' : newStatus === 'failed' ? 'failed' : 'processing',
      actor_type: 'system',
      prev_status: txn.status,
      new_status: newStatus,
      details: {
        source: 'stripe_webhook',
        event_id: event.id,
        event_type: eventType,
        provider_transaction_id: providerTransactionId,
        payout_item_id: txn.payout_item_id,
      },
    });

    return {
      success: true,
      eventType,
      entityType: 'payout_provider_transaction',
      entityId: txn.id,
      data: {
        status: newStatus,
        providerTransactionId,
        batchId: txn.batch_id,
      },
    };
  }
}

// Register the handler
registerWebhookHandler(new StripePayoutWebhookHandler());

export default StripePayoutWebhookHandler;
