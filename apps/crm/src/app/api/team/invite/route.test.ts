import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/email/transactional', () => ({
  sendTeamInviteEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: () => 'mock-token-hex-string',
    })),
  },
}));

import { POST } from './route';

function buildMockClient(overrides?: {
  existingProfile?: unknown;
  existingInvite?: unknown;
  insertResult?: { data: unknown; error: unknown };
  orgResult?: { data: unknown; error: unknown };
  inviterResult?: { data: unknown; error: unknown };
}) {
  let fromCallCount = 0;
  const chainable: Record<string, any> = {};
  const methods = ['select', 'eq', 'gt', 'insert', 'order'];
  for (const m of methods) {
    chainable[m] = vi.fn(() => chainable);
  }

  chainable.single = vi.fn(() => {
    fromCallCount++;
    // Call order: 1=existingProfile, 2=existingInvite, 3=insert, 4=org, 5=inviter
    switch (fromCallCount) {
      case 1:
        return Promise.resolve({ data: overrides?.existingProfile ?? null, error: null });
      case 2:
        return Promise.resolve({ data: overrides?.existingInvite ?? null, error: null });
      case 3:
        return Promise.resolve(
          overrides?.insertResult ?? {
            data: { id: 'inv-1', email: 'new@example.com', role: 'advisor', expires_at: '2026-02-17' },
            error: null,
          }
        );
      case 4:
        return Promise.resolve(overrides?.orgResult ?? { data: { name: 'Test Org' }, error: null });
      case 5:
        return Promise.resolve(
          overrides?.inviterResult ?? { data: { full_name: 'Admin', email: 'admin@test.com' }, error: null }
        );
      default:
        return Promise.resolve({ data: null, error: null });
    }
  });

  return { from: vi.fn(() => chainable), chainable };
}

describe('POST /api/team/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'crm_agent' }), role: 'advisor' });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Insufficient permissions');
  });

  it('returns 400 when email is missing', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Email and role are required');
  });

  it('returns 400 when role is missing', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'hacker' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid role');
  });

  it('returns 400 when non-super-admin tries to invite super_admin', async () => {
    // super_admin is not an invitable role, so it is rejected as an invalid role.
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'super_admin' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid role');
  });

  it('returns 403 when a plain admin tries to invite the admin role', async () => {
    // Only owner/super_admin may invite admins.
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'admin' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Cannot invite admin role');
  });

  it('returns 400 when user already exists in org', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    const sb = buildMockClient({ existingProfile: { id: 'existing-1' } });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'existing@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already exists');
  });

  it('returns 400 when pending invitation exists', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    const sb = buildMockClient({ existingInvite: { id: 'inv-existing' } });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'pending@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Pending invitation');
  });

  it('creates invitation successfully', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    const sb = buildMockClient();
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invitation.email).toBe('new@example.com');
  });

  it('returns 500 on DB insert error', async () => {
    mockGetAuthProfile.mockResolvedValue({ ...buildProfile({ crm_role: 'admin' }), role: 'admin' });
    const sb = buildMockClient({
      insertResult: { data: null, error: { message: 'DB error' } },
    });
    mockCreateClient.mockResolvedValue(sb);
    const req = buildRequest('http://localhost:3000/api/team/invite', {
      method: 'POST',
      body: { email: 'new@example.com', role: 'advisor' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
