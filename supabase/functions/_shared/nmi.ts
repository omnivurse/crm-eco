/**
 * Deno NMI v5 client — keep request shapes aligned with packages/lib/src/billing/nmi.ts
 */

export const NMI_OPAQUE_DESCRIPTOR = 'nmi_payment_token';

export type NmiEnvironment = 'sandbox' | 'production';

function nmiApiBase(environment: NmiEnvironment, override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/$/, '');
  return environment === 'production' ? 'https://secure.nmi.com' : 'https://sandbox.nmi.com';
}

function centsToNmiAmount(cents: number): number {
  return Math.round(cents) / 100;
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

function nmiError(json: Record<string, unknown>, fallback: string): string {
  return readString(json.responsetext, json.response_text, json.error, json.message) ?? fallback;
}

export function nmiEnv() {
  const privateApiKey = (Deno.env.get('NMI_PRIVATE_API_KEY') ?? '').trim();
  if (!privateApiKey) {
    throw new Error('NMI_PRIVATE_API_KEY is required for NMI payment profiles');
  }
  const environment: NmiEnvironment =
    Deno.env.get('NMI_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  return {
    privateApiKey,
    environment,
    baseUrl: nmiApiBase(environment, Deno.env.get('NMI_API_BASE') ?? undefined),
  };
}

async function nmiPost(path: string, body: Record<string, unknown>) {
  const { privateApiKey, baseUrl } = nmiEnv();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: privateApiKey,
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

export async function nmiCreateCustomer(input: {
  paymentToken: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  memberId?: string;
}): Promise<{
  success: boolean;
  customerVaultId?: string;
  lastFour?: string;
  brand?: string;
  expiration?: string;
  error?: string;
}> {
  const r = await nmiPost('/api/v5/customers', {
    payment_details: { payment_token: input.paymentToken },
    cit_mit: { stored_credential_indicator: 'stored', initiated_by: 'customer' },
    billing_address: {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      address1: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      country: 'US',
    },
    merchant_defined_field_1: input.memberId,
  });
  if (!nmiSucceeded(r.json, r.httpOk) || !readString(r.json.id)) {
    return { success: false, error: nmiError(r.json, `NMI vault failed (HTTP ${r.status})`) };
  }
  const payment = asRecord(r.json.payment_details ?? r.json);
  const masked = readString(payment.cc_number, payment.last_four);
  const digits = masked?.replace(/\D/g, '') ?? '';
  return {
    success: true,
    customerVaultId: readString(r.json.id),
    lastFour: digits.length >= 4 ? digits.slice(-4) : undefined,
    brand: readString(payment.cc_type, payment.card_type),
    expiration: readString(payment.cc_exp, payment.card_exp),
  };
}

export async function nmiSale(input: {
  customerVaultId: string;
  amountDollars: number;
  description?: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; transactionId?: string; declined?: boolean; error?: string }> {
  const r = await nmiPost('/api/v5/payments/sale', {
    amount: input.amountDollars,
    payment_details: { customer_vault_id: input.customerVaultId },
    cit_mit: { stored_credential_indicator: 'used', initiated_by: 'merchant' },
    description: input.description,
    orderid: input.idempotencyKey?.slice(0, 50),
  });
  const response = readString(r.json.response);
  const transactionId = readString(r.json.id, r.json.transactionid);
  if (response === '2') {
    return { success: false, declined: true, transactionId, error: nmiError(r.json, 'NMI sale declined') };
  }
  if (!nmiSucceeded(r.json, r.httpOk)) {
    return { success: false, transactionId, error: nmiError(r.json, `NMI sale failed (HTTP ${r.status})`) };
  }
  return { success: true, transactionId };
}

export async function nmiRefund(input: {
  transactionId: string;
  amountDollars: number;
}): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const r = await nmiPost(`/api/v5/payments/${encodeURIComponent(input.transactionId)}/refund`, {
    amount: input.amountDollars,
  });
  if (!nmiSucceeded(r.json, r.httpOk)) {
    return { success: false, error: nmiError(r.json, `NMI refund failed (HTTP ${r.status})`) };
  }
  return {
    success: true,
    transactionId: readString(r.json.id, r.json.transactionid) ?? input.transactionId,
  };
}

export function isNmiProcessor(processor: string | null | undefined): boolean {
  return (processor ?? '').toLowerCase() === 'nmi';
}

export function dollarsToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export { centsToNmiAmount };
