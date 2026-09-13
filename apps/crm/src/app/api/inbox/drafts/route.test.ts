import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest, buildSupabaseClient } from '@/test/helpers';

const ORG_A = '00000000-0000-0000-0000-00000000000a';
const ORG_B = '00000000-0000-0000-0000-00000000000b';
const CONVERSATION_A = '00000000-0000-0000-0000-0000000000ca';

const mockCreateClient = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET, POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthProfile.mockResolvedValue(
    buildProfile({ id: 'profile-1', organization_id: ORG_B }),
  );
});

describe('GET /api/inbox/drafts', () => {
  it('lists only drafts owned in the active organization', async () => {
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_drafts: { data: [], error: null },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('author_id', 'profile-1');
    expect(queryBuilders.inbox_drafts.eq).toHaveBeenCalledWith('org_id', ORG_B);
    expect(queryBuilders.inbox_drafts.eq).not.toHaveBeenCalledWith('org_id', ORG_A);
  });
});

describe('POST /api/inbox/drafts', () => {
  it('rejects a reply draft whose conversation is outside the active organization', async () => {
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_conversations: { data: null, error: null },
      inbox_drafts: { data: null, error: null },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('/api/inbox/drafts', {
        method: 'POST',
        body: { conversation_id: CONVERSATION_A, subject: 'Cross-tenant reply' },
      }),
    );

    expect(response.status).toBe(400);
    expect(queryBuilders.inbox_conversations.eq).toHaveBeenCalledWith('id', CONVERSATION_A);
    expect(queryBuilders.inbox_conversations.eq).toHaveBeenCalledWith('org_id', ORG_B);
    expect(queryBuilders.inbox_drafts.insert).not.toHaveBeenCalled();
  });

  it('creates a draft in the active organization after validating its conversation', async () => {
    const draft = { id: 'draft-1', org_id: ORG_B };
    const { client, queryBuilders } = buildSupabaseClient({
      inbox_conversations: { data: { id: CONVERSATION_A }, error: null },
      inbox_drafts: { data: draft, error: null },
    });
    mockCreateClient.mockResolvedValue(client);

    const response = await POST(
      buildRequest('/api/inbox/drafts', {
        method: 'POST',
        body: { conversation_id: CONVERSATION_A, subject: 'Same-tenant reply' },
      }),
    );

    expect(response.status).toBe(201);
    expect(queryBuilders.inbox_drafts.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_B,
        author_id: 'profile-1',
        conversation_id: CONVERSATION_A,
      }),
    );
  });
});
