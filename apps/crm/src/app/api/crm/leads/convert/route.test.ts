import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProfile,
  buildQueryBuilder,
  buildRequest,
  buildSupabaseClient,
} from '@/test/helpers';

const RECORD_ID = '11111111-1111-1111-1111-111111111111';
const MEMBER_ID = '22222222-2222-2222-2222-222222222222';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();
const mockEnsureCrmMemberRecordFromLead = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/crm/lead-conversion-sync', () => ({
  ensureCrmMemberRecordFromLead: (...args: unknown[]) =>
    mockEnsureCrmMemberRecordFromLead(...args),
}));

vi.mock('@/lib/crm/lead-conversion-admin-client', () => ({
  tryCreateLeadConversionAdminClient: () => null,
}));

import { POST } from './route';

describe('POST /api/crm/leads/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockEnsureCrmMemberRecordFromLead.mockResolvedValue({ ok: true });
  });

  it('does not invoke the conversion RPC when the record is outside the active org', async () => {
    const targetBuilder = buildQueryBuilder({ data: null, error: null });
    const rpc = vi.fn();
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => targetBuilder),
      rpc,
    });

    const response = await POST(
      buildRequest('http://localhost/api/crm/leads/convert', {
        method: 'POST',
        body: { recordId: RECORD_ID },
      }),
    );

    expect(response.status).toBe(404);
    expect(targetBuilder.eq).toHaveBeenCalledWith('id', RECORD_ID);
    expect(targetBuilder.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 500 instead of converting when tenant validation fails', async () => {
    const targetBuilder = buildQueryBuilder({
      data: null,
      error: { message: 'lookup failed' },
    });
    const rpc = vi.fn();
    mockCreateClient.mockResolvedValue({
      from: vi.fn(() => targetBuilder),
      rpc,
    });

    const response = await POST(
      buildRequest('http://localhost/api/crm/leads/convert', {
        method: 'POST',
        body: { recordId: RECORD_ID },
      }),
    );

    expect(response.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('converts a record found in the active org', async () => {
    const { client } = buildSupabaseClient(
      { crm_records: { data: { id: RECORD_ID }, error: null } },
      {
        rpcResults: {
          convert_lead_to_member: {
            data: { success: true, member_id: MEMBER_ID },
            error: null,
          },
        },
      },
    );
    mockCreateClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('http://localhost/api/crm/leads/convert', {
        method: 'POST',
        body: { recordId: RECORD_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('convert_lead_to_member', {
      p_lead_record_id: RECORD_ID,
      p_user_id: 'profile-1',
    });
    expect(mockEnsureCrmMemberRecordFromLead).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        orgId: 'org-1',
        leadRecordId: RECORD_ID,
        enrollmentMemberId: MEMBER_ID,
      }),
    );
  });
});
