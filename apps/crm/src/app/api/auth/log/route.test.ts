import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthUser = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthUser: () => mockGetAuthUser(),
}));

const mockLogAuthEvent = vi.fn();

vi.mock('@crm-eco/lib/audit', () => ({
  logAuthEvent: (...args: unknown[]) => mockLogAuthEvent(...args),
}));

const mockRateLimitDurable = vi.fn();

vi.mock('@crm-eco/lib/rate-limit', () => ({
  rateLimitDurable: (...args: unknown[]) => mockRateLimitDurable(...args),
  getRateLimitHeaders: (result: { success: boolean; retryAfterSeconds?: number }) =>
    result.success
      ? {}
      : { 'Retry-After': String(Math.max(1, result.retryAfterSeconds ?? 1)) },
}));

const mockRecordDeviceSighting = vi.fn();

vi.mock('@/lib/security/device', () => ({
  recordDeviceSighting: (...args: unknown[]) => mockRecordDeviceSighting(...args),
}));

import { POST } from './route';

// Rate limiting is stubbed per-test, but distinct IPs keep the assertions on
// the limiter arguments unambiguous.
let ipCounter = 0;
function uniqueIpHeaders(): Record<string, string> {
  ipCounter += 1;
  return { 'x-forwarded-for': `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}` };
}

describe('POST /api/auth/log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuthEvent.mockResolvedValue({ success: true });
    mockRateLimitDurable.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60_000,
      retryAfterSeconds: 60,
      degraded: false,
    });
    mockRecordDeviceSighting.mockResolvedValue({
      deviceHash: 'a'.repeat(64),
      isNewDevice: false,
      trusted: false,
      revoked: false,
      degraded: false,
    });
  });

  it('returns 400 for invalid action', async () => {
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'hack_attempt', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid action');
  });

  it('returns 400 when email is missing', async () => {
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Email required');
  });

  it('returns 401 for login_success when user is not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue({ user: null, error: null });
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for login_success when email does not match', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'u-1', email: 'other@example.com' }, error: null });
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Email mismatch');
  });

  it('logs login_success for authenticated user', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'u-1', email: 'test@example.com' }, error: null });
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'crm',
      'login_success',
      'test@example.com',
      expect.objectContaining({ source: 'crm_login_page' })
    );
  });

  it('logs login_failed without auth check', async () => {
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_failed', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'crm',
      'login_failed',
      'test@example.com',
      expect.objectContaining({ source: 'crm_login_page' })
    );
    // getAuthUser should NOT have been called for login_failed
    expect(mockGetAuthUser).not.toHaveBeenCalled();
  });

  it('logs logout for the authenticated user', async () => {
    // logout is not an unauthenticated action, so it requires a matching user.
    mockGetAuthUser.mockResolvedValue({ user: { id: 'u-1', email: 'test@example.com' }, error: null });
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'logout', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockGetAuthUser).toHaveBeenCalled();
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'crm',
      'logout',
      'test@example.com',
      expect.objectContaining({ source: 'crm_login_page' })
    );
  });

  it('still succeeds when logAuthEvent fails', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'u-1', email: 'test@example.com' }, error: null });
    mockLogAuthEvent.mockResolvedValue({ success: false, error: 'logging failed' });
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'logout', email: 'test@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 429 with Retry-After when the limiter denies the request', async () => {
    mockRateLimitDurable.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 37_000,
      retryAfterSeconds: 37,
      degraded: false,
    });

    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_failed', email: 'test@example.com' },
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('37');
    // Nothing is logged for a throttled request.
    expect(mockLogAuthEvent).not.toHaveBeenCalled();
  });

  it('rate-limits invalid actions instead of short-circuiting to 400 uncounted', async () => {
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'hack_attempt', email: 'test@example.com' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    // Counted first, and against the stricter unauthenticated ceiling.
    expect(mockRateLimitDurable).toHaveBeenCalledWith(
      expect.stringContaining('auth-log-unauth:'),
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('returns 400 for a malformed JSON body', async () => {
    const req = new Request('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...uniqueIpHeaders() },
      body: 'not-json',
    }) as unknown as Parameters<typeof POST>[0];

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('records a device sighting on login_success and reports a new device', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'u-1', email: 'test@example.com' },
      error: null,
    });
    mockRecordDeviceSighting.mockResolvedValue({
      deviceHash: 'b'.repeat(64),
      isNewDevice: true,
      trusted: false,
      revoked: false,
      degraded: false,
    });

    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success', email: 'test@example.com' },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockRecordDeviceSighting).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1' }),
    );
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'crm',
      'login_success',
      'test@example.com',
      expect.objectContaining({ new_device: true }),
    );
  });

  it('omits the new_device verdict when recognition is degraded', async () => {
    mockGetAuthUser.mockResolvedValue({
      user: { id: 'u-1', email: 'test@example.com' },
      error: null,
    });
    mockRecordDeviceSighting.mockResolvedValue({
      deviceHash: null,
      isNewDevice: false,
      trusted: false,
      revoked: false,
      degraded: true,
    });

    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_success', email: 'test@example.com' },
    });
    await POST(req);

    const metadata = mockLogAuthEvent.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(metadata).not.toHaveProperty('new_device');
  });

  it('does not attempt device recognition for unauthenticated actions', async () => {
    const req = buildRequest('http://localhost:3000/api/auth/log', {
      method: 'POST',
      headers: uniqueIpHeaders(),
      body: { action: 'login_failed', email: 'test@example.com' },
    });
    await POST(req);

    expect(mockRecordDeviceSighting).not.toHaveBeenCalled();
  });

  it('accepts all valid actions', async () => {
    const validActions = ['login_success', 'login_failed', 'logout', 'password_reset', 'mfa_enabled', 'mfa_disabled'];
    for (const action of validActions) {
      vi.clearAllMocks();
      mockLogAuthEvent.mockResolvedValue({ success: true });
      // Authenticated actions (everything except login_failed/password_reset)
      // require a matching user; harmless for the unauthenticated actions.
      mockGetAuthUser.mockResolvedValue({ user: { id: 'u-1', email: 'test@example.com' }, error: null });
      const req = buildRequest('http://localhost:3000/api/auth/log', {
        method: 'POST',
        headers: uniqueIpHeaders(),
        body: { action, email: 'test@example.com' },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});
