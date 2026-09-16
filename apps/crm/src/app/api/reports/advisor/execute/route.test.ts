import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-000000000001';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { POST } from './route';

function post(body: unknown) {
  return POST(buildRequest('/api/reports/advisor/execute', { method: 'POST', body }));
}

describe('POST /api/reports/advisor/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: ORG_A }));
  });

  it('401 when unauthenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const { client } = buildSupabaseClient();
    mockCreateClient.mockResolvedValue(client);
    const res = await post({ templateKey: 'advisor-enrollments' });
    expect(res.status).toBe(401);
  });

  it('unwraps { rows, total } so the table is not empty', async () => {
    const { client } = buildSupabaseClient(
      {
        crm_report_results_cache: { data: null, error: { code: 'PGRST116' } },
        report_run_history: { data: null, error: null },
      },
      {
        rpcResults: {
          rpc_advisor_enrollment_report: {
            data: {
              rows: [{ advisor_id: 'adv-1', total_enrollments: 12, approved_or_active_count: 10, pending_review_count: 2 }],
              total: 1,
            },
            error: null,
          },
        },
      },
    );
    mockCreateClient.mockResolvedValue(client);

    const res = await post({ templateKey: 'advisor-enrollments', skipCache: true });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.rowCount).toBe(1);
    expect(json.data).toHaveLength(1);
    expect(json.summary.totalEnrollments).toBe(12);
    expect(json.fromCache).toBe(false);
  });

  it('expands pending status alias before calling the RPC', async () => {
    const { client } = buildSupabaseClient(
      {
        crm_report_results_cache: { data: null, error: { code: 'PGRST116' } },
        report_run_history: { data: null, error: null },
      },
      {
        rpcResults: {
          rpc_advisor_enrollment_report: { data: { rows: [], total: 0 }, error: null },
        },
      },
    );
    mockCreateClient.mockResolvedValue(client);

    await post({ templateKey: 'advisor-enrollments', statuses: ['pending'], skipCache: true });
    const [, args] = client.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.p_statuses).toEqual(expect.arrayContaining(['submitted', 'pending_review', 'more_info']));
  });
});
