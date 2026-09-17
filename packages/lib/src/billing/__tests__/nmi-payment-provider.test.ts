import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NmiClient,
  NmiGatewayError,
  centsToNmiAmount,
  createNmiClientFromEnv,
  nmiApiBase,
  sanitizeNmiLogValue,
} from '../nmi';
import { NmiPaymentProvider } from '../adapters/nmi-payment-provider';
import {
  PlaceholderPaymentProvider,
  __setPaymentProvider,
  getPaymentProvider,
} from '../payment-provider';
import { normalizeStoredPaymentProcessor } from '../charge-resolver';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('NMI helpers', () => {
  it('maps cents to NMI dollar amounts without float drift', () => {
    expect(centsToNmiAmount(1099)).toBe(10.99);
    expect(centsToNmiAmount(0)).toBe(0);
    expect(() => centsToNmiAmount(-1)).toThrow(/non-negative/);
  });

  it('picks sandbox vs live hosts', () => {
    expect(nmiApiBase('sandbox')).toBe('https://sandbox.nmi.com');
    expect(nmiApiBase('production')).toBe('https://secure.nmi.com');
    expect(nmiApiBase('sandbox', 'https://example.test/')).toBe('https://example.test');
  });

  it('redacts PAN / token fields from logs', () => {
    const sanitized = sanitizeNmiLogValue({
      payment_token: 'tok_live_secret',
      card_number: '4111111111111111',
      responsetext: 'Approved',
    }) as Record<string, unknown>;
    expect(sanitized.payment_token).toBe('[redacted]');
    expect(sanitized.card_number).toBe('[redacted]');
    expect(sanitized.responsetext).toBe('Approved');
  });
});

describe('createNmiClientFromEnv', () => {
  it('fails closed when the private key is missing', () => {
    expect(() => createNmiClientFromEnv({} as NodeJS.ProcessEnv)).toThrow(NmiGatewayError);
    expect(() => createNmiClientFromEnv({ NMI_PRIVATE_API_KEY: '   ' } as NodeJS.ProcessEnv)).toThrow(
      /NMI_PRIVATE_API_KEY/,
    );
  });
});

describe('NmiClient', () => {
  it('vaults an opaque token and never sends raw card fields', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.payment_details.payment_token).toBe('tok_abc');
      expect(body.card_number).toBeUndefined();
      expect(body.cit_mit).toEqual({
        stored_credential_indicator: 'stored',
        initiated_by: 'customer',
      });
      return jsonResponse({
        id: 'vault_1',
        response: '1',
        payment_details: { cc_number: 'XXXX1111', cc_type: 'visa', cc_exp: '1029' },
      });
    });

    const client = new NmiClient({
      privateApiKey: 'priv_test',
      environment: 'sandbox',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.createCustomer({
      paymentToken: 'tok_abc',
      email: 'member@example.com',
      billingAddress: { firstName: 'Ada', lastName: 'Lovelace' },
    });

    expect(result.success).toBe(true);
    expect(result.customerVaultId).toBe('vault_1');
    expect(result.lastFour).toBe('1111');
    expect(result.brand).toBe('visa');
    expect(result.expiration).toBe('2029-10');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://sandbox.nmi.com/api/v5/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'priv_test' }),
      }),
    );
  });

  it('returns a vault decline message without leaking the token', async () => {
    const client = new NmiClient({
      privateApiKey: 'priv_test',
      environment: 'sandbox',
      fetchImpl: (async () =>
        jsonResponse({ response: '2', responsetext: 'Invalid token' }, 400)) as unknown as typeof fetch,
    });
    const result = await client.createCustomer({ paymentToken: 'tok_bad' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('runs a MIT vault sale with the idempotency key as orderid', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.amount).toBe(80);
      expect(body.payment_details.customer_vault_id).toBe('vault_1');
      expect(body.cit_mit.initiated_by).toBe('merchant');
      expect(body.cit_mit.stored_credential_indicator).toBe('used');
      expect(body.orderid).toBe('enroll-123');
      return jsonResponse({ response: '1', id: 'txn_99' });
    });

    const client = new NmiClient({
      privateApiKey: 'priv_test',
      environment: 'sandbox',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.sale({
      customerVaultId: 'vault_1',
      amountCents: 8000,
      idempotencyKey: 'enroll-123',
    });
    expect(result).toEqual({ success: true, status: 'approved', transactionId: 'txn_99' });
  });

  it('maps NMI response 2 to declined', async () => {
    const client = new NmiClient({
      privateApiKey: 'priv_test',
      environment: 'sandbox',
      fetchImpl: (async () =>
        jsonResponse({ response: '2', responsetext: 'DECLINE', id: 'txn_d' })) as unknown as typeof fetch,
    });
    const result = await client.sale({ customerVaultId: 'vault_1', amountCents: 50 });
    expect(result.success).toBe(false);
    expect(result.status).toBe('declined');
    expect(result.error).toBe('DECLINE');
  });

  it('refunds by transaction id', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain('/api/v5/payments/txn_99/refund');
      return jsonResponse({ response: '1', id: 'ref_1' });
    });
    const client = new NmiClient({
      privateApiKey: 'priv_test',
      environment: 'sandbox',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.refund({ transactionId: 'txn_99', amountCents: 8000 });
    expect(result).toEqual({ success: true, transactionId: 'ref_1' });
  });
});

describe('NmiPaymentProvider', () => {
  it('rejects raw card input', async () => {
    const provider = new NmiPaymentProvider(
      new NmiClient({
        privateApiKey: 'priv_test',
        environment: 'sandbox',
        fetchImpl: (async () => jsonResponse({})) as unknown as typeof fetch,
      }),
    );
    const result = await provider.vaultPaymentMethod({
      organizationId: 'org',
      memberId: 'mem',
      email: 'a@b.com',
      method: { type: 'card', cardNumber: '4111111111111111', expiration: '1029' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/browser-tokenized/);
  });

  it('vaults an NMI opaque token and charges the vault id', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).includes('/customers')) {
        return jsonResponse({ id: 'vault_9', response: '1' });
      }
      return jsonResponse({ response: '1', id: 'txn_1' });
    });
    const provider = new NmiPaymentProvider(
      new NmiClient({
        privateApiKey: 'priv_test',
        environment: 'sandbox',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );

    const vault = await provider.vaultPaymentMethod({
      organizationId: 'org',
      memberId: 'mem',
      email: 'a@b.com',
      method: { type: 'opaque', descriptor: 'nmi_payment_token', value: 'tok_ok' },
    });
    expect(vault.success).toBe(true);
    expect(vault.gatewayCustomerId).toBe('vault_9');
    expect(vault.gatewayPaymentProfileId).toBe('vault_9');

    const charge = await provider.chargeOnce({
      organizationId: 'org',
      memberId: 'mem',
      gatewayCustomerId: 'vault_9',
      gatewayPaymentProfileId: 'vault_9',
      amountCents: 2500,
      idempotencyKey: 'retry-1',
    });
    expect(charge.success).toBe(true);
    expect(charge.transactionId).toBe('txn_1');
  });
});

describe('getPaymentProvider fail-closed', () => {
  afterEach(() => {
    __setPaymentProvider(null);
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.NMI_PRIVATE_API_KEY;
  });

  it('throws for an unknown provider instead of using the placeholder', () => {
    process.env.PAYMENT_PROVIDER = 'not-a-real-rail';
    expect(() => getPaymentProvider()).toThrow(/Unknown PAYMENT_PROVIDER/);
  });

  it('throws when nmi is selected without keys', () => {
    process.env.PAYMENT_PROVIDER = 'nmi';
    expect(() => getPaymentProvider()).toThrow(/NMI_PRIVATE_API_KEY/);
  });

  it('still uses the placeholder when unset', () => {
    const provider = getPaymentProvider();
    expect(provider).toBeInstanceOf(PlaceholderPaymentProvider);
  });
});

describe('charge resolver', () => {
  it('treats missing processor as Authorize.Net', () => {
    expect(normalizeStoredPaymentProcessor(null)).toBe('authorizenet');
    expect(normalizeStoredPaymentProcessor('NMI')).toBe('nmi');
  });

  it('does not treat placeholder or http stored values as NMI', () => {
    expect(normalizeStoredPaymentProcessor('placeholder')).toBe('authorizenet');
    expect(normalizeStoredPaymentProcessor('http')).toBe('authorizenet');
  });
});
