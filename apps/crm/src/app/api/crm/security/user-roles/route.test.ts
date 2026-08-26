import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRequest } from '@/test/helpers';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_PROFILE_ID = '33333333-3333-4333-8333-333333333333';
const TARGET_USER_ID = '44444444-4444-4444-8444-444444444444';
const ROLE_ID = '55555555-5555-4555-8555-555555555555';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();
const mockCreateRoleSyncClient = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateRoleSyncClient(...args),
}));

vi.mock('@/lib/security/revoke-sessions', () => ({
  revokeUserSessions: vi.fn(() => Promise.resolve()),
}));

vi.mock('@crm-eco/lib/audit', () => ({
  AuditActions: { ROLE_CHANGED: 'role_changed' },
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

import { POST } from './route';

type QueryResult = { data: unknown; error: unknown };

function terminalQuery(result: QueryResult) {
  const query: Record<string, any> = {};
  for (const method of ['select', 'eq', 'or']) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.single = vi.fn(() => Promise.resolve(result));
  return query;
}

describe('POST /api/crm/security/user-roles tenant scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    mockGetAuthProfile.mockResolvedValue({
      id: ACTOR_PROFILE_ID,
      organization_id: ORG_ID,
      crm_role: 'crm_admin',
    });
  });

  it('persists the active organization when assigning a global role template', async () => {
    let insertedAssignment: Record<string, unknown> | null = null;
    let userRoleReads = 0;

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return terminalQuery({
            data: {
              id: TARGET_PROFILE_ID,
              user_id: TARGET_USER_ID,
              organization_id: ORG_ID,
              crm_role: null,
              full_name: 'Target User',
            },
            error: null,
          });
        }

        if (table === 'crm_roles') {
          return terminalQuery({
            data: {
              id: ROLE_ID,
              key: 'admin',
              name: 'Administrator',
              is_system: true,
              organization_id: null,
            },
            error: null,
          });
        }

        if (table === 'crm_user_roles') {
          userRoleReads += 1;
          if (userRoleReads === 1) {
            return terminalQuery({ data: null, error: null });
          }

          const inserted = terminalQuery({
            data: {
              id: '66666666-6666-4666-8666-666666666666',
              organization_id: ORG_ID,
              user_id: TARGET_USER_ID,
              role_id: ROLE_ID,
              granted_by: ACTOR_PROFILE_ID,
              created_at: '2026-08-26T00:00:00.000Z',
            },
            error: null,
          });
          inserted.insert = vi.fn((value: Record<string, unknown>) => {
            insertedAssignment = value;
            return inserted;
          });
          return inserted;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };
    mockCreateClient.mockResolvedValue(client);

    const roleSyncQuery = terminalQuery({
      data: { id: TARGET_PROFILE_ID },
      error: null,
    });
    roleSyncQuery.update = vi.fn(() => roleSyncQuery);
    mockCreateRoleSyncClient.mockReturnValue({
      from: vi.fn(() => roleSyncQuery),
    });

    const request = buildRequest(
      'http://localhost:3000/api/crm/security/user-roles',
      {
        method: 'POST',
        body: {
          profile_id: TARGET_PROFILE_ID,
          role_id: ROLE_ID,
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      synced_crm_role: 'crm_admin',
    });
    expect(insertedAssignment).toEqual({
      organization_id: ORG_ID,
      user_id: TARGET_USER_ID,
      role_id: ROLE_ID,
      granted_by: ACTOR_PROFILE_ID,
    });
  });
});
