import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createClient } from './client';

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PHASE',
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

describe('createClient', () => {
  beforeEach(() => {
    createBrowserClientMock.mockReset();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('does not crash runtime SSR when public Supabase configuration is missing', () => {
    expect(typeof window).toBe('undefined');
    expect(() => createClient()).not.toThrow();
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });

  it('constructs the real browser client when configuration is present', () => {
    const expectedClient = { auth: {} };
    createBrowserClientMock.mockReturnValue(expectedClient);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';

    expect(createClient()).toBe(expectedClient);
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'public-anon-key',
    );
  });
});
