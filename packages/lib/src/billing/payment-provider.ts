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

/* ============================================================
   Universal config-driven adapter — connect any REST gateway later
   ============================================================ */

function dotGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    obj,
  );
}

/**
 * Where to read each value out of the gateway's JSON responses (dot-paths).
 * Defaults assume a canonical shape; override per-processor via env or config.
 */
export interface HttpResponseMap {
  ok?: string;
  error?: string;
  customerId?: string;
  paymentProfileId?: string;
  paymentType?: string;
  lastFour?: string;
  brand?: string;
  expiration?: string;
  transactionId?: string;
  status?: string;
}

export interface HttpProviderConfig {
  name?: string;
  /** POST endpoint that tokenizes/vaults a payment method. */
  vaultUrl: string;
  /** POST endpoint that charges a vaulted profile. */
  chargeUrl: string;
  authScheme?: 'bearer' | 'basic' | 'header' | 'none';
  /** bearer token / basic password / raw header value */
  apiKey?: string;
  /** basic-auth username */
  username?: string;
  /** header name for the 'header' scheme (default Authorization) */
  authHeaderName?: string;
  /** extra static headers */
  headers?: Record<string, string>;
  resp?: HttpResponseMap;
}

/**
 * Generic REST/JSON payment adapter. Posts a canonical request to the
 * configured vault/charge endpoints and reads the result via dot-path mapping —
 * enough to wire most processors by CONFIG alone. For a gateway whose request
 * shape differs, register a bespoke provider (registerPaymentProvider) that
 * constructs this with custom mapping, or implement PaymentProvider directly.
 */
export class GenericHttpPaymentProvider implements PaymentProvider {
  readonly name: string;
  constructor(private cfg: HttpProviderConfig) {
    this.name = cfg.name ?? 'http';
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json', ...(this.cfg.headers ?? {}) };
    const scheme = this.cfg.authScheme ?? 'bearer';
    if (scheme === 'bearer' && this.cfg.apiKey) {
      h.authorization = `Bearer ${this.cfg.apiKey}`;
    } else if (scheme === 'basic' && this.cfg.username) {
      const creds = `${this.cfg.username}:${this.cfg.apiKey ?? ''}`;
      const b64 = typeof btoa === 'function' ? btoa(creds) : Buffer.from(creds).toString('base64');
      h.authorization = `Basic ${b64}`;
    } else if (scheme === 'header' && this.cfg.apiKey) {
      h[(this.cfg.authHeaderName ?? 'authorization').toLowerCase()] = this.cfg.apiKey;
    }
    return h;
  }

  private async post(
    url: string,
    body: unknown,
  ): Promise<{ httpOk: boolean; json: Record<string, unknown>; status: number }> {
    const res = await fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    let json: Record<string, unknown> = {};
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      /* non-JSON response */
    }
    return { httpOk: res.ok, json, status: res.status };
  }

  async vaultPaymentMethod(input: VaultPaymentInput): Promise<VaultPaymentResult> {
    if (!this.cfg.vaultUrl) return { success: false, error: 'payment vault endpoint not configured' };
    let r: { httpOk: boolean; json: Record<string, unknown>; status: number };
    try {
      r = await this.post(this.cfg.vaultUrl, input);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'vault request failed' };
    }
    const m = this.cfg.resp ?? {};
    const ok = m.ok ? Boolean(dotGet(r.json, m.ok)) : r.httpOk;
    if (!ok) {
      return { success: false, error: String(dotGet(r.json, m.error ?? 'error') ?? `vault failed (HTTP ${r.status})`) };
    }
    const customerId = dotGet(r.json, m.customerId ?? 'customerId');
    const profileId = dotGet(r.json, m.paymentProfileId ?? 'paymentProfileId');
    if (!customerId || !profileId) {
      return { success: false, error: 'vault response missing customer/payment profile id' };
    }
    const paymentType =
      (dotGet(r.json, m.paymentType ?? 'paymentType') as 'credit_card' | 'bank_account' | undefined) ??
      (input.method.type === 'ach' ? 'bank_account' : 'credit_card');
    return {
      success: true,
      gatewayCustomerId: String(customerId),
      gatewayPaymentProfileId: String(profileId),
      paymentType,
      lastFour: dotGet(r.json, m.lastFour ?? 'lastFour') as string | undefined,
      brand: dotGet(r.json, m.brand ?? 'brand') as string | undefined,
      expiration: dotGet(r.json, m.expiration ?? 'expiration') as string | undefined,
    };
  }

  async chargeOnce(input: ChargeInput): Promise<ChargeResult> {
    if (!this.cfg.chargeUrl) return { success: false, status: 'error', error: 'payment charge endpoint not configured' };
    let r: { httpOk: boolean; json: Record<string, unknown>; status: number };
    try {
      r = await this.post(this.cfg.chargeUrl, input);
    } catch (e) {
      return { success: false, status: 'error', error: e instanceof Error ? e.message : 'charge request failed' };
    }
    const m = this.cfg.resp ?? {};
    const ok = m.ok ? Boolean(dotGet(r.json, m.ok)) : r.httpOk;
    if (!ok) {
      return {
        success: false,
        status: 'declined',
        error: String(dotGet(r.json, m.error ?? 'error') ?? `charge failed (HTTP ${r.status})`),
      };
    }
    return {
      success: true,
      transactionId: String(dotGet(r.json, m.transactionId ?? 'transactionId') ?? ''),
      status: (dotGet(r.json, m.status ?? 'status') as ChargeResult['status']) ?? 'approved',
    };
  }
}

function httpConfigFromEnv(): HttpProviderConfig {
  return {
    name: process.env.PAYMENT_PROVIDER || 'http',
    vaultUrl: process.env.PAYMENT_HTTP_VAULT_URL || '',
    chargeUrl: process.env.PAYMENT_HTTP_CHARGE_URL || '',
    authScheme: (process.env.PAYMENT_HTTP_AUTH_SCHEME as HttpProviderConfig['authScheme']) || 'bearer',
    apiKey: process.env.PAYMENT_HTTP_API_KEY,
    username: process.env.PAYMENT_HTTP_USERNAME,
    authHeaderName: process.env.PAYMENT_HTTP_AUTH_HEADER,
    resp: {
      ok: process.env.PAYMENT_HTTP_RESP_OK,
      error: process.env.PAYMENT_HTTP_RESP_ERROR,
      customerId: process.env.PAYMENT_HTTP_RESP_CUSTOMER_ID,
      paymentProfileId: process.env.PAYMENT_HTTP_RESP_PROFILE_ID,
      paymentType: process.env.PAYMENT_HTTP_RESP_PAYMENT_TYPE,
      lastFour: process.env.PAYMENT_HTTP_RESP_LAST_FOUR,
      brand: process.env.PAYMENT_HTTP_RESP_BRAND,
      expiration: process.env.PAYMENT_HTTP_RESP_EXPIRATION,
      transactionId: process.env.PAYMENT_HTTP_RESP_TXN_ID,
      status: process.env.PAYMENT_HTTP_RESP_STATUS,
    },
  };
}

/* ------------------------------- Registry -------------------------------- */

type PaymentProviderFactory = () => PaymentProvider;

const REGISTRY = new Map<string, PaymentProviderFactory>([
  ['placeholder', () => new PlaceholderPaymentProvider()],
  ['http', () => new GenericHttpPaymentProvider(httpConfigFromEnv())],
]);

/**
 * Register a bespoke processor adapter under a name, then select it with
 * PAYMENT_PROVIDER=<name>. Lets a new bank be added without editing core.
 */
export function registerPaymentProvider(name: string, factory: PaymentProviderFactory): void {
  REGISTRY.set(name.toLowerCase(), factory);
}

let cached: PaymentProvider | null = null;

/**
 * Resolve the active payment provider from env (PAYMENT_PROVIDER). Defaults to
 * the placeholder. The flow code calls this and never branches on the processor.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = (process.env.PAYMENT_PROVIDER || 'placeholder').toLowerCase();
  const factory = REGISTRY.get(name) ?? REGISTRY.get('placeholder')!;
  cached = factory();
  return cached;
}

/** Test seam: override the active provider (e.g. in unit tests). */
export function __setPaymentProvider(provider: PaymentProvider | null): void {
  cached = provider;
}
