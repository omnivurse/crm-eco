import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSupabaseClient } from '@/test/helpers';
import { hasCrmApiScope } from './public-api-scopes';

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock('@crm-eco/lib/supabase/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

import {
  getPublicApiClientIp,
  isPublicApiIpAllowed,
  isPublicApiKeyExpired,
  requireCrmApiKey,
} from './public-api-auth';

describe('hasCrmApiScope', () => {
  it('allows existing CRM read keys to call membership reads', () => {
    expect(hasCrmApiScope(['crm.read'], 'read')).toBe(true);
    expect(hasCrmApiScope(['crm.read'], 'write')).toBe(false);
  });

  it('allows crm.write and crm.admin to write', () => {
    expect(hasCrmApiScope(['crm.write'], 'write')).toBe(true);
    expect(hasCrmApiScope(['crm.admin'], 'write')).toBe(true);
  });
});

describe('public API key restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats invalid and elapsed expiration timestamps as expired', () => {
    expect(isPublicApiKeyExpired('not-a-date')).toBe(true);
    expect(isPublicApiKeyExpired('2026-09-18T10:59:59.000Z', Date.parse('2026-09-18T11:00:00.000Z'))).toBe(
      true,
    );
    expect(isPublicApiKeyExpired('2026-09-18T11:00:01.000Z', Date.parse('2026-09-18T11:00:00.000Z'))).toBe(
      false,
    );
  });

  it('fails closed when a configured IP allowlist cannot be matched', () => {
    expect(isPublicApiIpAllowed([], null)).toBe(true);
    expect(isPublicApiIpAllowed(['203.0.113.8'], null)).toBe(false);
    expect(isPublicApiIpAllowed(['203.0.113.8'], '203.0.113.9')).toBe(false);
    expect(isPublicApiIpAllowed(['203.0.113.8'], '::ffff:203.0.113.8')).toBe(true);
  });

  it('prefers Vercel client IP metadata over a forwarded header', () => {
    const request = new Request('https://crm.example.test/api/public/v1/members', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.8',
        'x-forwarded-for': '198.51.100.9',
      },
    });
    expect(getPublicApiClientIp(request)).toBe('203.0.113.8');
  });

  it('rejects an expired active key before recording usage', async () => {
    const built = buildSupabaseClient({
      crm_api_keys: {
        data: {
          id: 'key-1',
          organization_id: 'org-1',
          scopes: ['crm.read'],
          status: 'active',
          environment: 'production',
          usage_count: 4,
          expires_at: '2020-01-01T00:00:00.000Z',
          allowed_ips: [],
        },
      },
    });
    mocks.createServiceRoleClient.mockReturnValue(built.client);

    const result = await requireCrmApiKey(
      new Request('https://crm.example.test/api/public/v1/members', {
        headers: { authorization: 'Bearer dhh_k_expired' },
      }),
    );

    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error.status).toBe(401);
    expect(built.queryBuilders.crm_api_keys.update).not.toHaveBeenCalled();
  });

  it('enforces the configured source IP before recording usage', async () => {
    const built = buildSupabaseClient({
      crm_api_keys: {
        data: {
          id: 'key-1',
          organization_id: 'org-1',
          scopes: ['crm.read'],
          status: 'active',
          environment: 'production',
          usage_count: 4,
          expires_at: null,
          allowed_ips: ['203.0.113.8'],
        },
      },
    });
    mocks.createServiceRoleClient.mockReturnValue(built.client);

    const result = await requireCrmApiKey(
      new Request('https://crm.example.test/api/public/v1/members', {
        headers: {
          authorization: 'Bearer dhh_k_wrong_ip',
          'x-forwarded-for': '203.0.113.9',
        },
      }),
    );

    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error.status).toBe(403);
    expect(built.queryBuilders.crm_api_keys.update).not.toHaveBeenCalled();
  });
});
