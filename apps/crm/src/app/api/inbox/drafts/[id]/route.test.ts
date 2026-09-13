import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const DRAFT_ID = '00000000-0000-0000-0000-0000000000d1';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { DELETE, GET, PUT } from './route';

const params = { params: Promise.resolve({ id: DRAFT_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthProfile.mockResolvedValue(
    buildProfile({ id: 'profile-1', organization_id: ORG_B }),
  );
});

describe('/api/inbox/drafts/[id] tenant scope', () => {
  it.each([
    ['GET', () => GET(buildRequest(`/api/inbox/drafts/${DRAFT_ID}`), params)],
    [
      'PUT',
      () =>
        PUT(
          buildRequest(`/api/inbox/drafts/${DRAFT_ID}`, {
            method: 'PUT',
            body: { subject: 'Updated' },
          }),
          params,
        ),
    ],
    [
      'DELETE',
      () =>
        DELETE(
          buildRequest(`/api/inbox/drafts/${DRAFT_ID}`, { method: 'DELETE' }),
          params,
        ),
    ],
  ])('%s pins the draft to the active organization', async (_method, invoke) => {
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_drafts: { data: { id: DRAFT_ID, org_id: ORG_B }, error: null },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('id', DRAFT_ID);
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('author_id', 'profile-1');
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('org_id', ORG_B);
    expect(queryBuilders.inbox_drafts.eq).not.toHaveBeenCalledWith('org_id', ORG_A);
    if (_method === 'DELETE') {
      expect(queryBuilders.inbox_drafts.is).toHaveBeenCalledWith('scheduled_at', null);
    }
  });

  it('does not report success when delete matches no active-organization draft', async () => {
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_drafts: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await DELETE(
      buildRequest(`/api/inbox/drafts/${DRAFT_ID}`, { method: 'DELETE' }),
      params,
    );

    expect(response.status).toBe(404);
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('org_id', ORG_B);
  });

  it('refuses to claim that a queued scheduled message was cancelled', async () => {
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_drafts: {
        data: { id: DRAFT_ID, org_id: ORG_B, scheduled_at: '2026-09-13T12:00:00Z' },
        error: null,
      },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await DELETE(
      buildRequest(`/api/inbox/drafts/${DRAFT_ID}`, { method: 'DELETE' }),
      params,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/cannot be deleted/i);
    expect(queryBuilders.inbox_drafts.delete).not.toHaveBeenCalled();
  });
});
