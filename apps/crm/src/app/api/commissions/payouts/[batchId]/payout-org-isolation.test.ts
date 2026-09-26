import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

/**
 * Cross-tenant isolation for the payout batch endpoints.
 *
 * These routes call SECURITY DEFINER RPCs that take only `p_batch_id`. The
 * functions do not scope themselves to an organization, and because they are
 * definer-rights, RLS does not apply inside them either. The routes also hold a
 * service-role client, so nothing below the route enforces tenancy: the
 * `assertCommissionBatchOrgAccess` call in each handler is the only thing
 * standing between an admin of one tenant and another tenant's payout batch.
 *
 * Each test therefore asserts the negative: when the batch belongs to a
 * different organization, the RPC must never be invoked.
 */

const mockGetAuthProfile = vi.fn();
const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  createClient: () => Promise.resolve(buildServiceClient()),
}));

vi.mock('@crm-eco/lib/supabase/server', () => ({
  createServiceRoleClient: () => buildServiceClient(),
}));

function buildServiceClient() {
  const chain: Record<string, any> = {};
  for (const m of ['select', 'eq', 'order']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(() => mockMaybeSingle());
  return {
    from: vi.fn(() => chain),
    rpc: mockRpc,
  };
}

/** The batch row `assertCommissionBatchOrgAccess` reads. */
function batchInOrg(organization_id: string) {
  return { data: { id: 'batch-1', organization_id }, error: null };
}

import { POST as payFailPost } from './route';
import { POST as approvePost } from './approve/route';
import { POST as reconcilePost } from './reconcile/route';
import { POST as anomaliesPost } from './anomalies/route';

const CALLER_ORG = 'org-1';
const OTHER_ORG = 'org-2';

const routes: {
  name: string;
  handler: (req: any, ctx: any) => Promise<Response>;
  body?: unknown;
}[] = [
  { name: 'pay/fail', handler: payFailPost as any, body: { action: 'pay' } },
  { name: 'approve', handler: approvePost as any, body: {} },
  { name: 'reconcile', handler: reconcilePost as any, body: {} },
  { name: 'anomalies', handler: anomaliesPost as any, body: {} },
];

describe('payout batch organization isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: {}, error: null });
  });

  for (const route of routes) {
    describe(route.name, () => {
      it('refuses a batch owned by another organization and never calls the RPC', async () => {
        mockGetAuthProfile.mockResolvedValue({
          ...buildProfile({ organization_id: CALLER_ORG }),
          role: 'admin',
        });
        mockMaybeSingle.mockResolvedValue(batchInOrg(OTHER_ORG));

        const res = await route.handler(
          buildRequest('http://localhost/api/commissions/payouts/batch-1', {
            method: 'POST',
            body: route.body,
          }),
          { params: Promise.resolve({ batchId: 'batch-1' }) }
        );

        expect(res.status).toBe(403);
        expect(mockRpc).not.toHaveBeenCalled();
      });

      it('proceeds when the batch belongs to the caller organization', async () => {
        mockGetAuthProfile.mockResolvedValue({
          ...buildProfile({ organization_id: CALLER_ORG }),
          role: 'admin',
        });
        mockMaybeSingle.mockResolvedValue(batchInOrg(CALLER_ORG));

        const res = await route.handler(
          buildRequest('http://localhost/api/commissions/payouts/batch-1', {
            method: 'POST',
            body: route.body,
          }),
          { params: Promise.resolve({ batchId: 'batch-1' }) }
        );

        expect(res.status).toBe(200);
        expect(mockRpc).toHaveBeenCalled();
      });

      it('rejects a non-admin before touching the batch or the RPC', async () => {
        mockGetAuthProfile.mockResolvedValue({
          ...buildProfile({ organization_id: CALLER_ORG }),
          role: 'advisor',
        });
        mockMaybeSingle.mockResolvedValue(batchInOrg(CALLER_ORG));

        const res = await route.handler(
          buildRequest('http://localhost/api/commissions/payouts/batch-1', {
            method: 'POST',
            body: route.body,
          }),
          { params: Promise.resolve({ batchId: 'batch-1' }) }
        );

        expect(res.status).toBe(403);
        expect(mockRpc).not.toHaveBeenCalled();
      });
    });
  }
});
