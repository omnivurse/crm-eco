/**
 * Provider-agnostic payment seam.
 *
 * PIFH is moving OFF Authorize.Net to a new bank/processor (TBD). The enrollment
 * and billing flows must talk to THIS interface — never a concrete gateway — so
 * the processor can be swapped by adding an adapter + setting PAYMENT_PROVIDER,
 * with nothing else in the flow changing.
 *
 * Operations are intentionally gateway-only (vault + charge). Persisting to
 * `payment_profiles` / `billing_transactions` is the orchestration layer's job,
 * so adapters stay thin and testable.
 *
 * Adapters to implement later:
 *  - 'authorizenet' → wrap the existing AuthorizeNetService (authorize-net.ts)
 *  - '<new-bank>'   → the chosen processor
 * Until one is wired, the default `placeholder` provider returns deterministic
 * synthetic results and NEVER moves real money (loud-warns so it can't masquerade
 * as live in production).
 */

export type PaymentMethodInput =
  | {
      type: 'card';
      cardNumber: string;
      /** MMYY or YYYY-MM, adapter normalizes */
      expiration: string;
      cardCode?: string;
      nameOnCard?: string;
    }
  | {
      type: 'ach';
      accountType: 'checking' | 'savings' | 'businessChecking';
      routingNumber: string;
      accountNumber: string;
      nameOnAccount: string;
    }
  | {
      /** Tokenized client-side (Accept.js-style) — preferred for PCI scope */
      type: 'opaque';
      descriptor: string;
      value: string;
    };

export interface PaymentBillingAddress {
  firstName?: string;
  lastName?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface VaultPaymentInput {
  organizationId: string;
  memberId: string;
  email: string;
  method: PaymentMethodInput;
  billingAddress?: PaymentBillingAddress;
  /** Reuse an existing gateway customer profile if the member already has one */
  existingGatewayCustomerId?: string | null;
}

export interface VaultPaymentResult {
  success: boolean;
  /** Gateway customer profile id (e.g. Authorize.Net CIM customerProfileId) */
  gatewayCustomerId?: string;
  /** Gateway payment profile / token id */
  gatewayPaymentProfileId?: string;
  /** 'credit_card' | 'bank_account' — matches payment_profiles.payment_type */
  paymentType?: 'credit_card' | 'bank_account';
  lastFour?: string;
  /** Card brand (Visa…) or bank name */
  brand?: string;
  /** MM/YY for cards */
  expiration?: string;
  error?: string;
  /** True when produced by the placeholder provider (never a real vault) */
  placeholder?: boolean;
}

export interface ChargeInput {
  organizationId: string;
  memberId: string;
  gatewayCustomerId: string;
  gatewayPaymentProfileId: string;
  /** Integer cents — avoid float drift on money */
  amountCents: number;
  description?: string;
  /** Dedupe key so a retried completion never double-charges */
  idempotencyKey?: string;
}

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  status?: 'approved' | 'declined' | 'error' | 'held';
  error?: string;
  placeholder?: boolean;
}

export interface PaymentProvider {
  /** Stable identifier, e.g. 'placeholder' | 'authorizenet' | 'newbank' */
  readonly name: string;
  /** Tokenize + store the payment method at the gateway (no DB writes here) */
  vaultPaymentMethod(input: VaultPaymentInput): Promise<VaultPaymentResult>;
  /** One-time charge against a vaulted profile (e.g. the first month) */
  chargeOnce(input: ChargeInput): Promise<ChargeResult>;
}

/**
 * Deterministic, side-effect-free stand-in until the real bank adapter lands.
 * Returns success with clearly-synthetic ids and warns loudly. It must NEVER be
 * the active provider in production once real billing goes live.
 */
export class PlaceholderPaymentProvider implements PaymentProvider {
  readonly name = 'placeholder';

  private warn(op: string) {
     
    console.warn(
      `[payment] PlaceholderPaymentProvider.${op} — NO real money moved. ` +
        'Set PAYMENT_PROVIDER + add the real bank adapter before going live.',
    );
  }

  async vaultPaymentMethod(input: VaultPaymentInput): Promise<VaultPaymentResult> {
    this.warn('vaultPaymentMethod');
    const paymentType = input.method.type === 'ach' ? 'bank_account' : 'credit_card';
    const seed = `${input.memberId}`.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'member';
    return {
      success: true,
      placeholder: true,
      gatewayCustomerId: `PLACEHOLDER-CUST-${seed}`,
      gatewayPaymentProfileId: `PLACEHOLDER-PROF-${seed}`,
      paymentType,
      lastFour: '0000',
      brand: paymentType === 'bank_account' ? 'Placeholder Bank' : 'Placeholder',
      expiration: paymentType === 'credit_card' ? '01/30' : undefined,
    };
  }

  async chargeOnce(input: ChargeInput): Promise<ChargeResult> {
    this.warn('chargeOnce');
    return {
      success: true,
      placeholder: true,
      status: 'approved',
      transactionId: `PLACEHOLDER-TXN-${input.idempotencyKey ?? input.memberId}`,
    };
  }
}

let cached: PaymentProvider | null = null;

/**
 * Resolve the active payment provider from env (PAYMENT_PROVIDER). Defaults to
 * the placeholder. Real adapters are registered here as they're built — kept in
 * one place so the flow code calls `getPaymentProvider()` and never branches on
 * the processor.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = (process.env.PAYMENT_PROVIDER || 'placeholder').toLowerCase();
  switch (name) {
    // case 'authorizenet': cached = new AuthorizeNetProvider(); break;
    // case 'newbank':      cached = new NewBankProvider(); break;
    case 'placeholder':
    default:
      cached = new PlaceholderPaymentProvider();
      break;
  }
  return cached;
}

/** Test seam: override the active provider (e.g. in unit tests). */
export function __setPaymentProvider(provider: PaymentProvider | null): void {
  cached = provider;
}
