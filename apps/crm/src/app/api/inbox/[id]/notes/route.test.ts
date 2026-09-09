import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest, buildSupabaseClient } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();
const mockGetConversation = vi.fn();
const mockGetMessages = vi.fn();
const mockUpdateConversation = vi.fn();
let supabase: ReturnType<typeof buildSupabaseClient>['client'];

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  createClient: () => supabase,
}));

vi.mock('@/lib/inbox', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
}));

import { POST } from './route';

const CONV = {
  id: '11111111-1111-4111-8111-111111111111',
  org_id: 'org-1',
  subject: 'ACH setup',
  contact_id: 'rec-1',
  contact_email: 'frank@bank.com',
  mailbox_address: 'wendy@payitforwardhealth.com',
};

const MESSAGES = [
  {
    direction: 'inbound',
    from_address: 'frank@bank.com',
    to_address: 'wendy@payitforwardhealth.com',
    sent_at: '2026-09-08T16:00:00.000Z',
  },
];

describe('POST /api/inbox/[id]/notes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_agent' }));
    const built = buildSupabaseClient(
      {
        crm_modules: { data: { id: 'mod-contacts' } },
        crm_records: { data: { id: 'rec-1', org_id: 'org-1', email: 'frank@bank.com' } },
        crm_notes: { data: { id: 'note-2' } },
      },
      { rpcResults: { check_crm_duplicate: { data: [{ id: 'rec-1', title: 'Frank' }] } } },
    );
    supabase = built.client;
    mockGetConversation.mockResolvedValue(CONV);
    mockGetMessages.mockResolvedValue({ messages: MESSAGES, total: 1, hasMore: false });
  });

  it('saves a conversation note on the linked contact', async () => {
    const req = buildRequest('http://localhost/api/inbox/x/notes', {
      method: 'POST',
      body: { body: 'Email: “ACH setup”\nFollow-up Tuesday.' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ note_id: 'note-2', record_id: 'rec-1', linked: false });
  });

  it('rejects an empty note', async () => {
    const req = buildRequest('http://localhost/api/inbox/x/notes', {
      method: 'POST',
      body: { body: '   ' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(400);
  });

  it('rejects a stranger', async () => {
    const req = buildRequest('http://localhost/api/inbox/x/notes', {
      method: 'POST',
      body: { email: 'stranger@elsewhere.com', body: 'Nope\nReal note.' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(400);
  });

  it('forbids crm_viewer', async () => {
    mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: 'crm_viewer' }));
    const req = buildRequest('http://localhost/api/inbox/x/notes', {
      method: 'POST',
      body: { body: 'Hello\nThere.' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(403);
  });
});
