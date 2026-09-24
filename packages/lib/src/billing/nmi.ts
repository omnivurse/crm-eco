/**
 * NMI Gateway v5 client.
 *
 * Hosts: sandbox.nmi.com | secure.nmi.com
 * Auth: private API security key in the Authorization header (server-only).
 * PCI: only payment_token / customer_vault_id — never PAN, CVV, or full ACH.
 */

export const NMI_OPAQUE_DESCRIPTOR = 'nmi_payment_token';

export type NmiEnvironment = 'sandbox' | 'production';

export interface NmiClientConfig {
  privateApiKey: string;
  environment: NmiEnvironment;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

export interface NmiBillingAddress {
  firstName?: string;
  lastName?: string;
  email?: string;
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface NmiCreateCustomerInput {
  paymentToken: string;
  email?: string;
  billingAddress?: NmiBillingAddress;
  merchantCustomerId?: string;
}

export interface NmiCreateCustomerResult {
  success: boolean;
  customerVaultId?: string;
  billingId?: string;
  transactionId?: string;
  lastFour?: string;
  brand?: string;
  expiration?: string;
  paymentType?: 'credit_card' | 'bank_account';
  error?: string;
}

export interface NmiSaleInput {
  customerVaultId: string;
  /** Selects a specific payment method when the customer has multiple billing records. */
  billingId?: string;
  amountCents: number;
  description?: string;
  idempotencyKey?: string;
  initialTransactionId?: string;
}

export interface NmiSaleResult {
  success: boolean;
  transactionId?: string;
  status?: 'approved' | 'declined' | 'error' | 'held';
  error?: string;
}

export interface NmiRefundInput {
  transactionId: string;
  amountCents: number;
}

export interface NmiRefundResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

const SENSITIVE_KEYS = new Set([
  'payment_token',
  'card_number',
  'card_cvv',
  'cvv',
  'account_number',
  'check_account',
  'authorization',
]);

export function nmiApiBase(environment: NmiEnvironment, override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/$/, '');
  return environment === 'production' ? 'https://secure.nmi.com' : 'https://sandbox.nmi.com';
}

export function centsToNmiAmount(cents: number): number {
  if (!Number.isFinite(cents) || cents < 0) {
    throw new Error('amountCents must be a non-negative finite number');
  }
  return Math.round(cents) / 100;
}

export function sanitizeNmiLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeNmiLogValue);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
    } else {
      out[key] = sanitizeNmiLogValue(nested);
    }
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function nmiSucceeded(json: Record<string, unknown>, httpOk: boolean): boolean {
  const response = readString(json.response);
  if (response === '1') return true;
  if (response === '2' || response === '3') return false;
  if (readString(json.id) && httpOk) return true;
  return false;
}

function nmiErrorMessage(json: Record<string, unknown>, fallback: string): string {
  return (
    readString(json.responsetext, json.response_text, json.error, json.message) ?? fallback
  );
}

function lastFourFromMasked(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

function normalizeExpiration(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 4) {
    const mm = digits.slice(0, 2);
    const yy = digits.slice(2, 4);
    return `20${yy}-${mm}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  if (/^\d{4}-\d{2}$/.test(value)) return value;
  return value;
}

export class NmiGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NmiGatewayError';
  }
}

export class NmiClient {
  private readonly privateApiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: NmiClientConfig) {
    const key = config.privateApiKey.trim();
    if (!key) {
      throw new NmiGatewayError('NMI_PRIVATE_API_KEY is required');
    }
    this.privateApiKey = key;
    this.baseUrl = nmiApiBase(config.environment, config.apiBase);
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request(
    method: 'POST',
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ httpOk: boolean; status: number; json: Record<string, unknown> }> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.privateApiKey,
      },
      body: JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try {
      json = asRecord(await res.json());
    } catch {
      /* non-JSON */
    }
    return { httpOk: res.ok, status: res.status, json };
  }

  async createCustomer(input: NmiCreateCustomerInput): Promise<NmiCreateCustomerResult> {
    const token = input.paymentToken.trim();
    if (!token) return { success: false, error: 'NMI payment token is required' };

    const addr = input.billingAddress;
    const payload: Record<string, unknown> = {
      payment_details: { payment_token: token },
      cit_mit: {
        stored_credential_indicator: 'stored',
        initiated_by: 'customer',
      },
      billing_address: {
        first_name: addr?.firstName,
        last_name: addr?.lastName,
        email: input.email ?? addr?.email,
        address1: addr?.line1,
        city: addr?.city,
        state: addr?.state,
        zip: addr?.zip,
        country: addr?.country ?? 'US',
      },
    };
    if (input.merchantCustomerId) {
      payload.merchant_defined_field_1 = input.merchantCustomerId;
    }

    try {
      const r = await this.request('POST', '/api/v5/customers', payload);
      if (!nmiSucceeded(r.json, r.httpOk) || !readString(r.json.id)) {
        return {
          success: false,
          error: nmiErrorMessage(r.json, `NMI vault failed (HTTP ${r.status})`),
        };
      }

      const payment = asRecord(r.json.payment_details ?? r.json.card ?? r.json);
      const check = asRecord(r.json.check);
      const isAch = Boolean(readString(check.account, check.aba, payment.check_account));
      return {
        success: true,
        customerVaultId: readString(r.json.id),
        billingId: readString(r.json.billing_id, payment.billing_id),
        transactionId: readString(r.json.transaction_id, r.json.transactionid),
        lastFour:
          lastFourFromMasked(
            readString(payment.cc_number, payment.card_number, payment.last_four, check.account),
          ) ?? undefined,
        brand: readString(payment.cc_type, payment.card_type, payment.type) ?? (isAch ? 'ACH' : undefined),
        expiration: normalizeExpiration(readString(payment.cc_exp, payment.card_exp, payment.exp)),
        paymentType: isAch ? 'bank_account' : 'credit_card',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'NMI vault request failed',
      };
    }
  }

  async sale(input: NmiSaleInput): Promise<NmiSaleResult> {
    const vaultId = input.customerVaultId.trim();
    if (!vaultId) return { success: false, status: 'error', error: 'NMI customer vault id is required' };

    let amount: number;
    try {
      amount = centsToNmiAmount(input.amountCents);
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Invalid amount',
      };
    }

    const citMit: Record<string, string> = {
      stored_credential_indicator: 'used',
      initiated_by: 'merchant',
    };
    if (input.initialTransactionId) {
      citMit.initial_transaction_id = input.initialTransactionId;
    }

    const billingId = input.billingId?.trim();
    const payload: Record<string, unknown> = {
      amount,
      payment_details: {
        customer_vault_id: vaultId,
        ...(billingId ? { billing_id: billingId } : {}),
      },
      cit_mit: citMit,
    };
    if (input.description) payload.description = input.description;
    if (input.idempotencyKey) {
      payload.orderid = input.idempotencyKey.slice(0, 50);
    }

    try {
      const r = await this.request('POST', '/api/v5/payments/sale', payload);
      const response = readString(r.json.response);
      if (response === '2') {
        return {
          success: false,
          status: 'declined',
          transactionId: readString(r.json.id, r.json.transactionid),
          error: nmiErrorMessage(r.json, 'NMI sale declined'),
        };
      }
      if (!nmiSucceeded(r.json, r.httpOk)) {
        return {
          success: false,
          status: 'error',
          transactionId: readString(r.json.id, r.json.transactionid),
          error: nmiErrorMessage(r.json, `NMI sale failed (HTTP ${r.status})`),
        };
      }
      return {
        success: true,
        status: 'approved',
        transactionId: readString(r.json.id, r.json.transactionid),
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'NMI sale request failed',
      };
    }
  }

  async refund(input: NmiRefundInput): Promise<NmiRefundResult> {
    const transactionId = input.transactionId.trim();
    if (!transactionId) return { success: false, error: 'NMI transaction id is required' };

    let amount: number;
    try {
      amount = centsToNmiAmount(input.amountCents);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Invalid amount' };
    }

    try {
      const r = await this.request('POST', `/api/v5/payments/${encodeURIComponent(transactionId)}/refund`, {
        amount,
      });
      if (!nmiSucceeded(r.json, r.httpOk)) {
        return {
          success: false,
          transactionId: readString(r.json.id, r.json.transactionid),
          error: nmiErrorMessage(r.json, `NMI refund failed (HTTP ${r.status})`),
        };
      }
      return {
        success: true,
        transactionId: readString(r.json.id, r.json.transactionid) ?? transactionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'NMI refund request failed',
      };
    }
  }
}

export function createNmiClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl?: typeof fetch,
): NmiClient {
  const privateApiKey = env.NMI_PRIVATE_API_KEY?.trim();
  if (!privateApiKey) {
    throw new NmiGatewayError(
      'NMI_PRIVATE_API_KEY is required when using the NMI payment provider',
    );
  }
  const environment: NmiEnvironment =
    env.NMI_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  return new NmiClient({
    privateApiKey,
    environment,
    apiBase: env.NMI_API_BASE,
    fetchImpl,
  });
}
