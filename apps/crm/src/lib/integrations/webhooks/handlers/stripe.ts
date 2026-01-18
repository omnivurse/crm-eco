/**
 * Stripe Webhook Handler
 * Processes Stripe webhook events
 */

import Stripe from 'stripe';
import { registerWebhookHandler } from '../router';
import type { WebhookHandler, WebhookResult, WebhookContext } from '../types';

class StripeWebhookHandler implements WebhookHandler {
  readonly providerId = 'stripe';

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
    signature: string | null,
    headers: Record<string, string>
  ): Promise<boolean> {
    if (!signature) {
      return false;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET not configured');
      return false;
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch (error) {
      console.error('Stripe signature verification failed:', error);
      return false;
    }
  }

  parseEvent(
    payload: string,
    headers: Record<string, string>
  ): { eventType: string; data: unknown } {
    const signature = headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    return {
      eventType: event.type,
      data: event,
    };
  }

  async processEvent(
    eventType: string,
    data: unknown,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const event = data as Stripe.Event;

    switch (eventType) {
      case 'payment_intent.succeeded':
        return this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, context);

      case 'payment_intent.payment_failed':
        return this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, context);

      case 'customer.subscription.created':
        return this.handleSubscriptionCreated(event.data.object as Stripe.Subscription, context);

      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription, context);

      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription, context);

      case 'invoice.payment_succeeded':
        return this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, context);

      case 'invoice.payment_failed':
        return this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, context);

      default:
        return {
          success: true,
          eventType,
          message: `Event type ${eventType} acknowledged but not processed`,
        };
    }
  }

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { enrollment_id, member_id, org_id } = paymentIntent.metadata;

    // Update enrollment if linked
    if (enrollment_id && context.supabase) {
      await context.supabase
        .from('enrollments')
        .update({
          payment_status: 'paid',
          stripe_payment_id: paymentIntent.id,
          payment_amount: paymentIntent.amount / 100,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment_id);
    }

    return {
      success: true,
      eventType: 'payment_intent.succeeded',
      entityType: enrollment_id ? 'enrollment' : 'payment',
      entityId: enrollment_id || paymentIntent.id,
      data: {
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        customerId: paymentIntent.customer,
        memberId: member_id,
      },
    };
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { enrollment_id } = paymentIntent.metadata;

    if (enrollment_id && context.supabase) {
      await context.supabase
        .from('enrollments')
        .update({
          payment_status: 'failed',
          last_payment_error: paymentIntent.last_payment_error?.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollment_id);
    }

    return {
      success: true,
      eventType: 'payment_intent.payment_failed',
      entityType: 'enrollment',
      entityId: enrollment_id || paymentIntent.id,
      data: {
        error: paymentIntent.last_payment_error?.message,
      },
    };
  }

  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { member_id, plan_id } = subscription.metadata;
    // Access subscription dates - API structure may vary by version
    const subAny = subscription as unknown as Record<string, unknown>;
    const currentPeriodEnd = (subAny.current_period_end as number) || Math.floor(Date.now() / 1000);

    return {
      success: true,
      eventType: 'customer.subscription.created',
      entityType: 'subscription',
      entityId: subscription.id,
      data: {
        status: subscription.status,
        customerId: subscription.customer,
        memberId: member_id,
        planId: plan_id,
        currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
      },
    };
  }

  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { member_id } = subscription.metadata;
    // Access subscription dates - API structure may vary by version
    const subAny = subscription as unknown as Record<string, unknown>;
    const currentPeriodEnd = (subAny.current_period_end as number) || Math.floor(Date.now() / 1000);

    // Update member subscription status if linked
    if (member_id && context.supabase) {
      await context.supabase
        .from('members')
        .update({
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', member_id);
    }

    return {
      success: true,
      eventType: 'customer.subscription.updated',
      entityType: 'subscription',
      entityId: subscription.id,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    };
  }

  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { member_id } = subscription.metadata;

    if (member_id && context.supabase) {
      await context.supabase
        .from('members')
        .update({
          subscription_status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', member_id);
    }

    return {
      success: true,
      eventType: 'customer.subscription.deleted',
      entityType: 'subscription',
      entityId: subscription.id,
    };
  }

  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
    context: WebhookContext
  ): Promise<WebhookResult> {
    return {
      success: true,
      eventType: 'invoice.payment_succeeded',
      entityType: 'invoice',
      entityId: invoice.id || 'unknown',
      data: {
        amount: invoice.amount_paid,
        customerId: invoice.customer,
      },
    };
  }

  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    context: WebhookContext
  ): Promise<WebhookResult> {
    const { member_id } = invoice.metadata || {};

    // Could trigger a notification to the member about failed payment
    return {
      success: true,
      eventType: 'invoice.payment_failed',
      entityType: 'invoice',
      entityId: invoice.id || 'unknown',
      data: {
        amount: invoice.amount_due,
        customerId: invoice.customer,
        memberId: member_id,
        attemptCount: invoice.attempt_count,
      },
    };
  }
}

// Register the handler
registerWebhookHandler(new StripeWebhookHandler());

export default StripeWebhookHandler;
