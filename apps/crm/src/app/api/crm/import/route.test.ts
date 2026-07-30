import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildQueryBuilder, buildRequest } from '@/test/helpers';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { POST } from './route';

describe('POST /api/crm/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile());
  });

  it('matches and updates only live CRM records during upsert imports', async () => {
    const moduleLookup = buildQueryBuilder({
      data: { id: 'module-1', key: 'contacts' },
      error: null,
    });
    const importJobCreate = buildQueryBuilder({
      data: { id: 'job-1' },
      error: null,
    });
    const importJobUpdate = buildQueryBuilder({ data: null, error: null });
    const emailLookup = buildQueryBuilder({
      data: [{ id: 'record-1', email: 'member@example.com' }],
      error: null,
    });
    const existingRecordLookup = buildQueryBuilder({
      data: [{ id: 'record-1', data: { first_name: 'Old' }, title: 'Old Name' }],
      error: null,
    });
    const liveRecordUpdate = buildQueryBuilder({
      data: { id: 'record-1' },
      error: null,
    });
    const importRowsInsert = buildQueryBuilder({ data: null, error: null });

    const queues = new Map<string, Array<ReturnType<typeof buildQueryBuilder>>>([
      ['crm_modules', [moduleLookup]],
      ['crm_import_jobs', [importJobCreate, importJobUpdate]],
      ['crm_records', [emailLookup, existingRecordLookup, liveRecordUpdate]],
      ['crm_import_rows', [importRowsInsert]],
    ]);
    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        const builder = queues.get(table)?.shift();
        if (!builder) throw new Error(`Unexpected Supabase query for ${table}`);
        return builder;
      }),
    });

    const response = await POST(
      buildRequest('http://localhost/api/crm/import', {
        method: 'POST',
        body: {
          moduleId: 'module-1',
          organizationId: 'org-1',
          mappings: [
            { sourceColumn: 'Email', targetField: 'email' },
            { sourceColumn: 'First Name', targetField: 'first_name' },
          ],
          data: [{ Email: 'member@example.com', 'First Name': 'Updated' }],
          onDuplicate: 'update',
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: 0,
      updated: 1,
      errors: 0,
    });
    for (const query of [emailLookup, existingRecordLookup, liveRecordUpdate]) {
      expect(query.is).toHaveBeenCalledWith('deleted_at', null);
    }
  });
});
