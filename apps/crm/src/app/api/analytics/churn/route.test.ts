import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest, buildSupabaseClient } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET } from './route';

describe('GET /api/analytics/churn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when the session is gone — the tab must not pretend this is a data error', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    mockCreateClient.mockResolvedValue({});

    const res = await GET(buildRequest('http://localhost/api/analytics/churn'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('unwraps live { advisors } / { months } RPC envelopes into arrays', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: 'org-1' }));
    const { client } = buildSupabaseClient(
      {
        lifecycle_org_stats: {
          data: {
            churn_rate_12m: 4.2,
            enrolled_this_month: 3,
            cancelled_this_month: 1,
            top_cancel_reason: 'cost',
          },
        },
        member_lifecycle_events: {
          data: [
            { event_type: 'enrolled', event_date: '2026-08-01', reason: null },
            { event_type: 'cancelled', event_date: '2026-08-15', reason: 'cost' },
          ],
        },
        member_history_summary: { data: [] },
        members: { data: [], count: 10 },
      },
      {
        rpcResults: {
          rpc_lowest_churn_advisors_widget: {
            data: {
              advisors: [{ advisor_id: 'adv-1', name: 'Ada', churn_rate: 0, total_members: 8, active_members: 8 }],
            },
          },
          rpc_advisor_retention_widget: {
            data: { months: [{ month: '2026-08', retention_rate: 90, active_count: 9, total_count: 10 }] },
          },
        },
      },
    );
    mockCreateClient.mockResolvedValue(client);

    const res = await GET(buildRequest('http://localhost/api/analytics/churn'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bestRetentionAdvisors)).toBe(true);
    expect(body.bestRetentionAdvisors[0].name).toBe('Ada');
    expect(Array.isArray(body.retentionTrend)).toBe(true);
    expect(body.retentionTrend[0].month).toBe('2026-08');
    expect(body.summary.totalMembers).toBe(10);
    expect(body.cancellationReasons).toEqual([{ reason: 'cost', count: 1 }]);
  });
});
