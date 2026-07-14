import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest, buildProfile } from '@/test/helpers';

const mockGetConversations = vi.fn();
const mockCreateConversation = vi.fn();
const mockGetInboxStats = vi.fn();
const mockGetUnifiedMessages = vi.fn();
const mockGetAuthProfile = vi.fn();

vi.mock('@/lib/inbox', () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  getInboxStats: (...args: unknown[]) => mockGetInboxStats(...args),
  getUnifiedMessages: (...args: unknown[]) => mockGetUnifiedMessages(...args),
}));

// The route now verifies authentication via getAuthProfile. Mock the module
// so the real supabase-server (which imports 'server-only') is not loaded and
// each test starts authenticated by default.
vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
}));

import { GET, POST } from './route';

describe('GET /api/inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile());
  });

  it('returns stats when stats=true', async () => {
    const stats = { total: 10, unread: 3 };
    mockGetInboxStats.mockResolvedValue(stats);
    const req = buildRequest('http://localhost:3000/api/inbox?stats=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(stats);
    expect(mockGetInboxStats).toHaveBeenCalled();
  });

  it('returns unified messages when unified=true', async () => {
    const result = { messages: [{ id: 'm-1' }], total: 1 };
    mockGetUnifiedMessages.mockResolvedValue(result);
    const req = buildRequest('http://localhost:3000/api/inbox?unified=true&page=2&limit=10');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetUnifiedMessages).toHaveBeenCalledWith(2, 10);
  });

  it('returns conversations with default pagination', async () => {
    const result = { conversations: [{ id: 'c-1' }], total: 1, hasMore: false };
    mockGetConversations.mockResolvedValue(result);
    const req = buildRequest('http://localhost:3000/api/inbox');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversations).toEqual([{ id: 'c-1' }]);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(25);
  });

  it('parses filter params correctly', async () => {
    mockGetConversations.mockResolvedValue({ conversations: [], total: 0, hasMore: false });
    const req = buildRequest(
      'http://localhost:3000/api/inbox?channel=email&status=open&priority=high&assigned_to=user-1&unread_only=true&tags=vip,urgent&search=hello'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetConversations).toHaveBeenCalledWith(
      {
        channel: 'email',
        status: 'open',
        priority: 'high',
        assigned_to: 'user-1',
        unread_only: true,
        tags: ['vip', 'urgent'],
        search: 'hello',
      },
      1,
      25
    );
  });

  it('caps limit at 100', async () => {
    mockGetConversations.mockResolvedValue({ conversations: [], total: 0, hasMore: false });
    const req = buildRequest('http://localhost:3000/api/inbox?limit=500');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it('includes stats when include_stats=true', async () => {
    const result = { conversations: [], total: 0, hasMore: false };
    const stats = { total: 5, unread: 2 };
    mockGetConversations.mockResolvedValue(result);
    mockGetInboxStats.mockResolvedValue(stats);
    const req = buildRequest('http://localhost:3000/api/inbox?include_stats=true');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toEqual(stats);
  });

  it('returns 500 on error', async () => {
    mockGetConversations.mockRejectedValue(new Error('DB error'));
    const req = buildRequest('http://localhost:3000/api/inbox');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch inbox');
  });
});

describe('POST /api/inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile());
  });

  it('returns 400 when missing required fields', async () => {
    const req = buildRequest('http://localhost:3000/api/inbox', {
      method: 'POST',
      body: { channel: 'email' }, // missing thread_id
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing required fields');
  });

  it('returns 400 when channel is missing', async () => {
    const req = buildRequest('http://localhost:3000/api/inbox', {
      method: 'POST',
      body: { thread_id: 'thread-1' }, // missing channel
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates conversation successfully', async () => {
    const conversation = { id: 'conv-1', channel: 'email', thread_id: 'thread-1' };
    mockCreateConversation.mockResolvedValue(conversation);
    const req = buildRequest('http://localhost:3000/api/inbox', {
      method: 'POST',
      body: {
        channel: 'email',
        thread_id: 'thread-1',
        subject: 'Test',
        contact_email: 'user@example.com',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('conv-1');
  });

  it('returns 500 on error', async () => {
    mockCreateConversation.mockRejectedValue(new Error('DB error'));
    const req = buildRequest('http://localhost:3000/api/inbox', {
      method: 'POST',
      body: { channel: 'email', thread_id: 'thread-1' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create conversation');
  });
});
