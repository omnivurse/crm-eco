/**
 * Stripe Connect Payment Provider
 *
 * Sends payouts via Stripe Connect transfers.
 * Requires advisor to have a connected Stripe account.
 */

import Stripe from 'stripe';
import type { PaymentProvider, PayoutRequest, PayoutResult } from './types';

export class StripeConnectProvider implements PaymentProvider {
  readonly providerType = 'stripe_connect' as const;

  private _stripe: Stripe | null = null;

  private get stripe(): Stripe {
    if (!this._stripe) {
      const apiKey = process.env.STRIPE_SECRET_KEY;
      if (!apiKey) throw new Error('STRIPE_SECRET_KEY not configured');
      this._stripe = new Stripe(apiKey, {
        apiVersion: '2025-12-15.clover',
      });
    }
    return this._stripe;
  }

  async sendPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      // Amount in cents for Stripe
      const amountCents = Math.round(request.amount * 100);

      const transfer = await this.stripe.transfers.create(
        {
          amount: amountCents,
          currency: request.currency,
          // The connected account is resolved from advisor metadata.
          // In production, look up advisor's stripe_account_id from advisors table.
          destination: request.metadata?.stripe_account_id || '',
          metadata: {
            payout_item_id: request.payoutItemId,
            advisor_id: request.advisorId,
            txn_id: request.txnId,
          },
        },
        {
          idempotencyKey: request.idempotencyKey,
        }
      );

      return {
        providerTransactionId: transfer.id,
        status: 'submitted', // Stripe transfers are async
        rawResponse: {
          id: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          destination: transfer.destination,
          created: transfer.created,
        },
      };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      return {
        providerTransactionId: null,
        status: 'failed',
        rawResponse: {
          type: stripeError.type,
          code: stripeError.code,
          message: stripeError.message,
        },
        failureReason: stripeError.message,
        failureCode: stripeError.code,
      };
    }
  }

  async checkStatus(providerTransactionId: string): Promise<{
    status: 'pending' | 'submitted' | 'succeeded' | 'failed' | 'reversed';
    rawResponse: Record<string, unknown>;
  }> {
    try {
      const transfer = await this.stripe.transfers.retrieve(providerTransactionId);

      // Stripe transfers don't have a direct "status" — they succeed on creation.
      // Reversals are separate objects.
      const reversals = transfer.reversals;
      const isReversed = reversals && reversals.data && reversals.data.length > 0;

      return {
        status: isReversed ? 'reversed' : 'succeeded',
        rawResponse: {
          id: transfer.id,
          amount: transfer.amount,
          reversed: isReversed,
        },
      };
    } catch (error) {
      return {
        status: 'failed',
        rawResponse: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
