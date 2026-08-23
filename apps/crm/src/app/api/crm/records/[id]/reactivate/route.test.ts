import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest } from '@/test/helpers';

const VALID_ORG_ID = '00000000-0000-0000-0000-000000000001';
const mockProfile = buildProfile({ organization_id: VALID_ORG_ID });
const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/security', () => ({
  logPHIAccess: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/crm/person-lifecycle-ledger', () => ({
  appendLifecycleTransition: vi.fn(() => Promise.resolve({ written: true })),
}));

import { POST } from './route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/crm/records/[id]/reactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(mockProfile);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthProfile.mockResolvedValue(null);
    const res = await POST(buildRequest('http://localhost/api/crm/records/x/reactivate'), makeParams('x'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for viewers', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ organization_id: VALID_ORG_ID, crm_role: 'crm_viewer' }));
    const res = await POST(buildRequest('http://localhost/api/crm/records/x/reactivate'), makeParams('x'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when the record is missing in this org', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({ maybeSingle })),
            })),
          })),
        })),
      })),
    });
    const res = await POST(
      buildRequest('http://localhost/api/crm/records/missing/reactivate', { method: 'POST' }),
      makeParams('11111111-1111-4111-8111-111111111111'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when a working Contact is not on the History door', async () => {
    const recordMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'rec-1',
        org_id: VALID_ORG_ID,
        organization_id: VALID_ORG_ID,
        module_id: 'mod-contacts',
        status: 'Cancelled',
        system: {},
        data: {},
        deleted_at: null,
        cancellation_date: '2024-01-01',
        current_year_start_date: null,
        original_start_date: null,
        module: { key: 'contacts' },
      },
      error: null,
    });
    const contactsMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'mod-contacts' }, error: null });
    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'crm_records') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({ maybeSingle: recordMaybeSingle })),
                })),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({ maybeSingle: contactsMaybeSingle })),
              })),
            })),
          })),
        };
      }),
    });
    const res = await POST(
      buildRequest('http://localhost/api/crm/records/rec-1/reactivate', { method: 'POST' }),
      makeParams('rec-1'),
    );
    expect(res.status).toBe(409);
  });
});
