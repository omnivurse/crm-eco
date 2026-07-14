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

import { POST } from './route';

// The route rate-limits per client IP using module-level state that persists
// across tests. Give every request a unique IP so buckets never accumulate.
let ipCounter = 0;
function uniqueIpHeaders(): Record<string, string> {
  ipCounter += 1;
  return { 'x-forwarded-for': `10.1.${Math.floor(ipCounter / 256)}.${ipCounter % 256}` };
}

describe('POST /api/auth/log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAuthEvent.mockResolvedValue({ success: true });
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
