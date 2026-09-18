import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __setPaymentProvider,
  getPaymentProvider,
  PlaceholderPaymentProvider,
} from '../payment-provider';

describe('getPaymentProvider', () => {
  afterEach(() => {
    __setPaymentProvider(null);
    delete process.env.PAYMENT_PROVIDER;
    vi.unstubAllEnvs();
  });

  it('fails closed when the configured payment rail is unknown', () => {
    process.env.PAYMENT_PROVIDER = 'nmi';
    expect(() => getPaymentProvider()).toThrow(/Unknown PAYMENT_PROVIDER "nmi"/);
  });

  it('refuses an implicit placeholder payment rail in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getPaymentProvider()).toThrow(/PAYMENT_PROVIDER is required in production/);

    process.env.PAYMENT_PROVIDER = 'placeholder';
    expect(() => getPaymentProvider()).toThrow(/PAYMENT_PROVIDER is required in production/);
  });

  it('uses the no-op provider only when placeholder is explicitly selected or unset', () => {
    expect(getPaymentProvider()).toBeInstanceOf(PlaceholderPaymentProvider);

    __setPaymentProvider(null);
    process.env.PAYMENT_PROVIDER = 'placeholder';
    expect(getPaymentProvider()).toBeInstanceOf(PlaceholderPaymentProvider);
  });
});
