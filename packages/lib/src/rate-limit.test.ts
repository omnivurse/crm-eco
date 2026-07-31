import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getRateLimitHeaders,
  rateLimit,
  rateLimitDurable,
  resetInMemoryRateLimits,
  type RateLimitStore,
} from './rate-limit';

/** A store whose RPC result the test controls. */
function fakeStore(result: {
  data: unknown;
  error: { message: string } | null;
}): { store: RateLimitStore; rpc: ReturnType<typeof vi.fn> } {
  const rpc = vi.fn().mockResolvedValue(result);
  return { store: { rpc }, rpc };
}

beforeEach(() => {
  resetInMemoryRateLimits();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rateLimit (in-memory tier)', () => {
  it('allows up to the limit then denies', () => {
    expect(rateLimit('k', { limit: 2 }).success).toBe(true);
    expect(rateLimit('k', { limit: 2 }).success).toBe(true);
    expect(rateLimit('k', { limit: 2 }).success).toBe(false);
  });

  it('tracks keys independently', () => {
    rateLimit('a', { limit: 1 });
    expect(rateLimit('b', { limit: 1 }).success).toBe(true);
  });

  it('reports remaining budget', () => {
    expect(rateLimit('k', { limit: 3 }).remaining).toBe(2);
    expect(rateLimit('k', { limit: 3 }).remaining).toBe(1);
  });
});

describe('rateLimitDurable', () => {
  it('uses the durable verdict when the store answers', async () => {
    const { store, rpc } = fakeStore({
      data: [{ allowed: false, hits: 11, retry_after_seconds: 42 }],
      error: null,
    });

    const result = await rateLimitDurable('auth-log:ip', {
      limit: 10,
      windowSeconds: 60,
      store,
    });

    expect(result.success).toBe(false);
    expect(result.retryAfterSeconds).toBe(42);
    expect(result.degraded).toBe(false);
    expect(result.remaining).toBe(0);
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_key: 'auth-log:ip',
      p_max: 10,
      p_window_seconds: 60,
    });
  });

  it('reports remaining budget from the durable hit count', async () => {
    const { store } = fakeStore({
      data: [{ allowed: true, hits: 3, retry_after_seconds: 57 }],
      error: null,
    });

    const result = await rateLimitDurable('k', { limit: 10, store });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(7);
  });

  it('accepts a single-object RPC response as well as a row array', async () => {
    const { store } = fakeStore({
      data: { allowed: true, hits: 1, retry_after_seconds: 60 },
      error: null,
    });

    const result = await rateLimitDurable('k', { limit: 10, store });

    expect(result).toMatchObject({ success: true, degraded: false });
  });

  it('falls back to the in-memory tier when the store errors (fail open)', async () => {
    const { store } = fakeStore({ data: null, error: { message: 'connection reset' } });

    const first = await rateLimitDurable('k', { limit: 1, store });
    const second = await rateLimitDurable('k', { limit: 1, store });

    expect(first.success).toBe(true);
    expect(first.degraded).toBe(true);
    // Degrades the limit rather than removing it.
    expect(second.success).toBe(false);
  });

  it('denies when the store is unreachable and failMode is closed', async () => {
    const { store } = fakeStore({ data: null, error: { message: 'connection reset' } });

    const result = await rateLimitDurable('k', {
      limit: 100,
      store,
      failMode: 'closed',
    });

    expect(result.success).toBe(false);
    expect(result.degraded).toBe(true);
  });

  it('degrades when no store is configured at all', async () => {
    const result = await rateLimitDurable('k', { limit: 5, store: null });

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
  });

  it('treats an unexpected RPC shape as a store failure', async () => {
    const { store } = fakeStore({ data: [{ unexpected: true }], error: null });

    const result = await rateLimitDurable('k', { limit: 1, store });

    expect(result.degraded).toBe(true);
  });

  it('never throws when the store rejects', async () => {
    const store: RateLimitStore = {
      rpc: vi.fn().mockRejectedValue(new Error('socket hang up')),
    };

    const result = await rateLimitDurable('k', { limit: 1, store });

    expect(result.degraded).toBe(true);
    expect(result.success).toBe(true);
  });
});

describe('getRateLimitHeaders', () => {
  it('emits the standard X-RateLimit headers', () => {
    const headers = getRateLimitHeaders({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1_700_000_000_000,
    });

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('9');
    expect(headers['X-RateLimit-Reset']).toBe('1700000000000');
    expect(headers).not.toHaveProperty('Retry-After');
  });

  it('adds Retry-After (at least 1s) for a denied durable result', () => {
    const headers = getRateLimitHeaders({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now(),
      retryAfterSeconds: 0,
      degraded: false,
    });

    expect(headers['Retry-After']).toBe('1');
  });

  it('omits Retry-After for an allowed durable result', () => {
    const headers = getRateLimitHeaders({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now(),
      retryAfterSeconds: 60,
      degraded: false,
    });

    expect(headers).not.toHaveProperty('Retry-After');
  });
});
