import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest } from '@/test/helpers';

const mockCreateCrmClient = vi.fn();
const mockGetCurrentProfile = vi.fn();

vi.mock('@/lib/crm/queries', () => ({
  createCrmClient: () => mockCreateCrmClient(),
  getCurrentProfile: () => mockGetCurrentProfile(),
}));

import { POST } from './route';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const RECORD_ID = '00000000-0000-0000-0000-000000000002';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function buildMockClient({
  recordResult = { data: { id: RECORD_ID }, error: null },
  noteResult = {
    data: { id: 'note-1', record_id: RECORD_ID, org_id: ORG_ID },
    error: null,
  },
}: {
  recordResult?: QueryResult;
  noteResult?: QueryResult;
} = {}) {
  const recordQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'is']) {
    recordQuery[method] = vi.fn(() => recordQuery);
  }
  recordQuery.maybeSingle = vi.fn(() => Promise.resolve(recordResult));

  const noteQuery: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['insert', 'select']) {
    noteQuery[method] = vi.fn(() => noteQuery);
  }
  noteQuery.single = vi.fn(() => Promise.resolve(noteResult));

  return {
    client: {
      from: vi.fn((table: string) =>
        table === 'crm_records' ? recordQuery : noteQuery,
      ),
    },
    recordQuery,
    noteQuery,
  };
}

describe('POST /api/crm/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentProfile.mockResolvedValue(
      buildProfile({ organization_id: ORG_ID, crm_role: 'crm_agent' }),
    );
  });

  it('rejects a record outside the caller tenant without inserting a note', async () => {
    const { client, recordQuery, noteQuery } = buildMockClient({
      // An explicit tenant filter and RLS both hide a cross-tenant record.
      recordResult: { data: null, error: null },
    });
    mockCreateCrmClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('http://localhost:3000/api/crm/notes', {
        method: 'POST',
        body: { record_id: RECORD_ID, body: 'Injected note' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Record not found',
    });
    expect(recordQuery.eq).toHaveBeenCalledWith('id', RECORD_ID);
    expect(recordQuery.eq).toHaveBeenCalledWith('organization_id', ORG_ID);
    expect(recordQuery.is).toHaveBeenCalledWith('deleted_at', null);
    expect(noteQuery.insert).not.toHaveBeenCalled();
  });

  it('creates a note after verifying the record belongs to the caller tenant', async () => {
    const { client, noteQuery } = buildMockClient();
    mockCreateCrmClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('http://localhost:3000/api/crm/notes', {
        method: 'POST',
        body: { record_id: RECORD_ID, body: 'Valid note' },
      }),
    );

    expect(response.status).toBe(200);
    expect(noteQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        record_id: RECORD_ID,
        body: 'Valid note',
      }),
    );
  });

  it('fails closed when record ownership cannot be verified', async () => {
    const { client, noteQuery } = buildMockClient({
      recordResult: {
        data: null,
        error: { message: 'database unavailable' },
      },
    });
    mockCreateCrmClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('http://localhost:3000/api/crm/notes', {
        method: 'POST',
        body: { record_id: RECORD_ID, body: 'Valid note' },
      }),
    );

    expect(response.status).toBe(500);
    expect(noteQuery.insert).not.toHaveBeenCalled();
  });
});
