import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest } from '@/test/helpers';

const RECORD_ID = '11111111-1111-1111-1111-111111111111';
const KEEPER_ID = '22222222-2222-2222-2222-222222222222';
const ORG_ID = '33333333-3333-3333-3333-333333333333';

const mockGetAuthUser = vi.fn();
const mockGetAuthProfile = vi.fn();
const mockGetActiveTenant = vi.fn();
const mockResolve = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthUser: () => mockGetAuthUser(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

vi.mock('@/lib/tenant', () => ({
  getActiveTenant: () => mockGetActiveTenant(),
}));

vi.mock('@/lib/crm/resolve-record', () => ({
  resolveRecordOrMergeDestination: (id: string, organizationId: string) =>
    mockResolve(id, organizationId),
}));

import { GET } from './route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function authorize() {
  mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
  mockGetAuthProfile.mockResolvedValue({
    organization_id: ORG_ID,
    crm_role: 'crm_agent',
  });
  mockGetActiveTenant.mockResolvedValue(null);
}

describe('GET /api/crm/records/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue({ user: null, error: null });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(401);
    expect(mockGetAuthProfile).not.toHaveBeenCalled();
  });

  it('403 when authenticated without CRM access', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue({
      organization_id: ORG_ID,
      crm_role: null,
    });
    mockGetActiveTenant.mockResolvedValue(null);
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(403);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('admits a same-org staff membership without a legacy CRM role', async () => {
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
    mockGetAuthProfile.mockResolvedValue({
      organization_id: ORG_ID,
      crm_role: null,
    });
    mockGetActiveTenant.mockResolvedValue({
      organizationId: ORG_ID,
      role: 'staff',
    });
    mockResolve.mockResolvedValue({ kind: 'found', recordId: RECORD_ID });

    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledWith(RECORD_ID, ORG_ID);
  });

  it('returns { kind: found } when record is visible to caller', async () => {
    authorize();
    mockResolve.mockResolvedValue({ kind: 'found', recordId: RECORD_ID });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('found');
    expect(body.recordId).toBe(RECORD_ID);
    expect(mockResolve).toHaveBeenCalledWith(RECORD_ID, ORG_ID);
  });

  it('returns { kind: merged } with keeperId when stale URL was merged away', async () => {
    authorize();
    mockResolve.mockResolvedValue({
      kind: 'merged',
      keeperId: KEEPER_ID,
      keeperTitle: 'Karen Frame',
      mergedAt: '2026-04-20T00:00:00Z',
    });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('merged');
    expect(body.keeperId).toBe(KEEPER_ID);
    expect(body.keeperTitle).toBe('Karen Frame');
  });

  it('returns { kind: missing } when record is unknown', async () => {
    authorize();
    mockResolve.mockResolvedValue({ kind: 'missing' });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('missing');
  });

  it('fails soft to { kind: missing } on unexpected error', async () => {
    authorize();
    mockResolve.mockRejectedValue(new Error('boom'));
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('missing');
  });
});
