import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest } from '@/test/helpers';

const RECORD_ID = '11111111-1111-1111-1111-111111111111';
const KEEPER_ID = '22222222-2222-2222-2222-222222222222';

const mockGetAuthUser = vi.fn();
const mockResolve = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  getAuthUser: () => mockGetAuthUser(),
}));

vi.mock('@/lib/crm/resolve-record', () => ({
  resolveRecordOrMergeDestination: (id: string) => mockResolve(id),
}));

import { GET } from './route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/crm/records/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when unauthenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(401);
  });

  it('returns { kind: found } when record is visible to caller', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' });
    mockResolve.mockResolvedValue({ kind: 'found', recordId: RECORD_ID });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('found');
    expect(body.recordId).toBe(RECORD_ID);
  });

  it('returns { kind: merged } with keeperId when stale URL was merged away', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' });
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
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' });
    mockResolve.mockResolvedValue({ kind: 'missing' });
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('missing');
  });

  it('fails soft to { kind: missing } on unexpected error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'user-1' });
    mockResolve.mockRejectedValue(new Error('boom'));
    const req = buildRequest(`http://localhost/api/crm/records/${RECORD_ID}/resolve`);
    const res = await GET(req, makeParams(RECORD_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe('missing');
  });
});
