import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildSupabaseClient } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();
const mockGetAuthUser = vi.fn();
let supabase: ReturnType<typeof buildSupabaseClient>['client'];

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  getAuthUser: () => mockGetAuthUser(),
  createClient: () => supabase,
}));

import { getRecentMessages } from './unified-inbox-service';

describe('getRecentMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile());
    mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' }, error: null });
  });

  it('caps from the newest end and returns messages chronologically', async () => {
    const built = buildSupabaseClient({
      inbox_messages: {
        data: [
          { id: 'newest', sent_at: '2026-09-11T11:00:00.000Z' },
          { id: 'older', sent_at: '2026-09-11T10:00:00.000Z' },
        ],
        error: null,
      },
    });
    supabase = built.client;

    const messages = await getRecentMessages('conversation-1');

    expect(messages.map((message) => message.id)).toEqual(['older', 'newest']);
    expect(built.queryBuilders.inbox_messages.order).toHaveBeenCalledWith('sent_at', {
      ascending: false,
    });
    expect(built.queryBuilders.inbox_messages.limit).toHaveBeenCalledWith(200);
  });
});
