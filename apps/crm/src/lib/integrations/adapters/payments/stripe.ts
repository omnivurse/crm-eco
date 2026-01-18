/**
 * Stripe Payment Adapter
 * Handles payments, subscriptions, and customers via Stripe API
 */

import Stripe from 'stripe';
import { registerAdapter } from '../registry';
import type {
  PaymentAdapter,
  AdapterConfig,
  ValidationResult,
  TestResult,
  ProviderCapability,
  Customer,
  CreateCustomerParams,
  PaymentIntent,
  CreatePaymentIntentParams,
  Subscription,
  CreateSubscriptionParams,
} from '../base';

export class StripeAdapter implements PaymentAdapter {
  readonly providerId = 'stripe';
  readonly providerName = 'Stripe';
  readonly authType = 'api_key' as const;

  private stripe: Stripe | null = null;
  private apiKey: string | null = null;

  initialize(config: AdapterConfig): void {
    this.apiKey = config.apiKey || null;

    if (this.apiKey) {
      this.stripe = new Stripe(this.apiKey, {
        apiVersion: '2025-12-15.clover',
        typescript: true,
      });
    }
  }

  getCapabilities(): ProviderCapability[] {
    return [
      'create_payment',
      'refund_payment',
      'create_subscription',
      'receive_webhook',
    ];
  }

  validateConfig(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.api_key || typeof config.api_key !== 'string') {
      errors.push('API key is required');
    } else if (!config.api_key.startsWith('sk_')) {
      errors.push('API key should start with sk_ (secret key)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async testConnection(): Promise<TestResult> {
    if (!this.stripe) {
      return {
        success: false,
        message: 'Stripe client not initialized. Check API key.',
      };
    }

    const startTime = Date.now();

    try {
      // Retrieve account info to verify API key works
      const account = await this.stripe.accounts.retrieve();

      return {
        success: true,
        message: 'Connected to Stripe successfully',
        durationMs: Date.now() - startTime,
        accountInfo: {
          id: account.id,
          email: account.email || undefined,
          name: account.business_profile?.name || account.settings?.dashboard?.display_name || undefined,
        },
      };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      return {
        success: false,
        message: stripeError.message || 'Failed to connect to Stripe',
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Customer Management
  // ============================================================================

  async createCustomer(params: CreateCustomerParams): Promise<Customer> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    const customer = await this.stripe.customers.create({
      email: params.email,
      name: params.name,
      phone: params.phone,
      metadata: params.metadata,
    });

    return this.mapStripeCustomer(customer);
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      const customer = await this.stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        return null;
      }

      return this.mapStripeCustomer(customer as Stripe.Customer);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      if (stripeError.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async updateCustomer(customerId: string, updates: Partial<CreateCustomerParams>): Promise<Customer> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    const customer = await this.stripe.customers.update(customerId, {
      email: updates.email,
      name: updates.name,
      phone: updates.phone,
      metadata: updates.metadata,
    });

    return this.mapStripeCustomer(customer);
  }

  private mapStripeCustomer(customer: Stripe.Customer): Customer {
    return {
      id: customer.id,
      email: customer.email || '',
      name: customer.name || undefined,
      phone: customer.phone || undefined,
      metadata: customer.metadata as Record<string, string>,
    };
  }

  // ============================================================================
  // Payment Intents
  // ============================================================================

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      description: params.description,
      metadata: params.metadata,
      payment_method_types: params.paymentMethodTypes || ['card'],
    });

    return this.mapStripePaymentIntent(paymentIntent);
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return this.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      if (stripeError.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<{ success: boolean }> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  private mapStripePaymentIntent(pi: Stripe.PaymentIntent): PaymentIntent {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentIntent['status']> = {
      requires_payment_method: 'requires_payment_method',
      requires_confirmation: 'requires_confirmation',
      requires_action: 'requires_action',
      processing: 'processing',
      succeeded: 'succeeded',
      canceled: 'canceled',
      requires_capture: 'processing',
    };

    return {
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency.toUpperCase(),
      status: statusMap[pi.status] || 'requires_payment_method',
      clientSecret: pi.client_secret || undefined,
      customerId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id,
      metadata: pi.metadata as Record<string, string>,
    };
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      trial_period_days: params.trialDays,
      metadata: params.metadata,
    });

    return this.mapStripeSubscription(subscription);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return this.mapStripeSubscription(subscription);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      if (stripeError.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string, immediately = false): Promise<{ success: boolean }> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      if (immediately) {
        await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  private mapStripeSubscription(sub: Stripe.Subscription): Subscription {
    const statusMap: Record<Stripe.Subscription.Status, Subscription['status']> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      unpaid: 'unpaid',
      trialing: 'trialing',
      incomplete: 'unpaid',
      incomplete_expired: 'canceled',
      paused: 'unpaid',
    };

    // Access subscription dates - API structure may vary by version
    const subAny = sub as unknown as Record<string, unknown>;
    const currentPeriodStart = (subAny.current_period_start as number) || Math.floor(Date.now() / 1000);
    const currentPeriodEnd = (subAny.current_period_end as number) || Math.floor(Date.now() / 1000);

    return {
      id: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: statusMap[sub.status] || 'unpaid',
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: sub.items.data[0]?.price.id || '',
      metadata: sub.metadata as Record<string, string>,
    };
  }

  // ============================================================================
  // Refunds
  // ============================================================================

  async refund(paymentIntentId: string, amount?: number): Promise<{ success: boolean; refundId: string }> {
    if (!this.stripe) {
      throw new Error('Stripe client not initialized');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount, // If undefined, refunds full amount
      });

      return {
        success: true,
        refundId: refund.id,
      };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      throw new Error(stripeError.message || 'Refund failed');
    }
  }

  // ============================================================================
  // Webhook Handling
  // ============================================================================

  /**
   * Verify and parse a Stripe webhook event
   */
  static verifyWebhook(payload: string, signature: string, webhookSecret: string): Stripe.Event {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-12-15.clover',
    });

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

// Register the adapter
registerAdapter('stripe', 'payment', () => new StripeAdapter());

export default StripeAdapter;
