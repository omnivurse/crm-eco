import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createServiceRoleClient = vi.fn();

vi.mock('@crm-eco/lib/supabase/server', () => ({
  createServiceRoleClient: () => createServiceRoleClient(),
}));

import { revokeUserSessions } from './revoke-sessions';

const USER_ID = '11111111-2222-3333-4444-555555555555';

function clientReturning(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  createServiceRoleClient.mockReturnValue({ rpc });
  return rpc;
}

beforeEach(() => {
  createServiceRoleClient.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('revokeUserSessions', () => {
  it('revokes by auth user id and reports how many sessions ended', async () => {
    const rpc = clientReturning({ data: 3, error: null });

    const result = await revokeUserSessions(USER_ID, 'role_changed');

    expect(rpc).toHaveBeenCalledWith('revoke_user_sessions', { p_user_id: USER_ID });
    expect(result).toEqual({ ok: true, revoked: 3 });
  });

  it('treats zero open sessions as success, not failure', async () => {
    clientReturning({ data: 0, error: null });

    expect(await revokeUserSessions(USER_ID, 'account_deactivated')).toEqual({
      ok: true,
      revoked: 0,
    });
  });

  it('never calls the store without a target, so no query runs unscoped', async () => {
    const rpc = clientReturning({ data: 1, error: null });

    for (const missing of [null, undefined, '']) {
      const result = await revokeUserSessions(missing, 'role_changed');
      expect(result.ok).toBe(false);
      expect(result.revoked).toBe(0);
    }

    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports failure instead of throwing when the function is missing', async () => {
    clientReturning({
      data: null,
      error: { message: 'function public.revoke_user_sessions(uuid) does not exist' },
    });

    const result = await revokeUserSessions(USER_ID, 'role_changed');

    expect(result.ok).toBe(false);
    expect(result.revoked).toBe(0);
    expect(result.error).toContain('does not exist');
  });

  it('reports failure instead of throwing when the service role client is unavailable', async () => {
    createServiceRoleClient.mockImplementation(() => {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    });

    const result = await revokeUserSessions(USER_ID, 'account_deactivated');

    expect(result).toEqual({
      ok: false,
      revoked: 0,
      error: 'Missing SUPABASE_SERVICE_ROLE_KEY',
    });
  });
});
