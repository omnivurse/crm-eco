import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRequest } from '@/test/helpers';

// Mock @supabase/supabase-js (used directly in this route, not via supabase-server)
const mockFrom = vi.fn();
const mockSupabaseClient = { from: mockFrom };

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

const mockMapSendGridEventToStatus = vi.fn();
const mockShouldUpdateStatus = vi.fn();

vi.mock('@/lib/comms/providers/sendgrid', () => ({
  mapSendGridEventToStatus: (...args: unknown[]) => mockMapSendGridEventToStatus(...args),
  shouldUpdateStatus: (...args: unknown[]) => mockShouldUpdateStatus(...args),
}));

import { POST } from './route';

function buildChainable(result: { data: unknown; error?: unknown }) {
  const c: Record<string, any> = {};
  ['select', 'eq', 'or', 'update', 'insert'].forEach(m => {
    c[m] = vi.fn(() => c);
  });
  c.single = vi.fn(() => Promise.resolve(result));
  c.then = (resolve: Function) => resolve(result);
  return c;
}

describe('POST /api/webhooks/sendgrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldUpdateStatus.mockReturnValue(false);
  });

  it('returns 400 for non-array payload', async () => {
    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: { event: 'delivered' }, // not an array
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid payload');
  });

  it('returns success with 0 processed for events with no sg_message_id', async () => {
    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'delivered' }], // no sg_message_id
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
  });

  it('skips events with no matching message', async () => {
    const messageChain = buildChainable({ data: null });
    mockFrom.mockReturnValue(messageChain);

    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'delivered', sg_message_id: 'abc123.xyz.smtp' }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });

  it('processes events and creates event records', async () => {
    const message = { id: 'msg-1', org_id: 'org-1', status: 'sent' };
    // First from() call = crm_messages lookup, second = crm_message_events insert
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return buildChainable({ data: message });
      }
      // Event insert
      return buildChainable({ data: null });
    });
    mockShouldUpdateStatus.mockReturnValue(false);

    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'processed', sg_message_id: 'abc123.xyz.smtp' }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(1);
  });

  it('updates message status when shouldUpdateStatus returns true', async () => {
    const message = { id: 'msg-1', org_id: 'org-1', status: 'sent' };
    const updateChain = buildChainable({ data: null });
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return buildChainable({ data: message });
      if (fromCallCount === 2) return buildChainable({ data: null }); // event insert
      return updateChain; // message update
    });
    mockShouldUpdateStatus.mockReturnValue(true);
    mockMapSendGridEventToStatus.mockReturnValue('delivered');

    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'delivered', sg_message_id: 'abc123.xyz.smtp' }],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockMapSendGridEventToStatus).toHaveBeenCalledWith('delivered');
  });

  it('processes multiple events', async () => {
    const message = { id: 'msg-1', org_id: 'org-1', status: 'queued' };
    mockFrom.mockImplementation(() => buildChainable({ data: message }));
    mockShouldUpdateStatus.mockReturnValue(false);

    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [
        { event: 'processed', sg_message_id: 'a.b.c' },
        { event: 'delivered', sg_message_id: 'd.e.f' },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(2);
  });

  it('returns 500 on unexpected error', async () => {
    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: 'not-json',
    });
    // body parsing will fail for invalid JSON — but we sent a string
    // The route parses request.json() which will fail
    // Actually buildRequest JSON.stringifies the body, so "not-json" becomes `"not-json"` which is valid JSON (a string)
    // Let's make the from() throw instead
    mockFrom.mockImplementation(() => { throw new Error('Unexpected'); });
    const req2 = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'delivered', sg_message_id: 'a.b.c' }],
    });
    const res = await POST(req2);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
