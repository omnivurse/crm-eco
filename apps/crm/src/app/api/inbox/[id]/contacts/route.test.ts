import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, buildRequest, buildSupabaseClient } from '@/test/helpers';

const mockGetAuthProfile = vi.fn();
const mockGetAuthUser = vi.fn();
const mockGetConversation = vi.fn();
const mockGetMessages = vi.fn();
const mockUpdateConversation = vi.fn();
const mockExecuteCreate = vi.fn();
let supabase: ReturnType<typeof buildSupabaseClient>['client'];

vi.mock('@/lib/supabase-server', () => ({
  getAuthProfile: () => mockGetAuthProfile(),
  getAuthUser: () => mockGetAuthUser(),
  createClient: () => supabase,
}));

vi.mock('@/lib/inbox', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
}));

vi.mock('@/lib/crm/record-create-service', () => ({
  executeCrmRecordCreate: (...args: unknown[]) => mockExecuteCreate(...args),
}));

import { POST } from './route';

const CONV = {
  id: '11111111-1111-4111-8111-111111111111',
  org_id: 'org-1',
  subject: 'ACH setup',
  contact_id: null,
  contact_email: 'frank@bank.com',
  contact_name: 'Frank Burnham',
  mailbox_address: 'wendy@payitforwardhealth.com',
};

const MESSAGES = [
  {
    direction: 'inbound',
    from_address: 'frank@bank.com',
    from_name: 'Frank Burnham',
    to_address: 'wendy@payitforwardhealth.com',
    body_text: 'Hi\n--\nFrank Burnham\nRelationship Manager\nBank of Colorado',
    sent_at: '2026-09-08T16:00:00.000Z',
  },
];

function setupAuth(role = 'crm_agent') {
  mockGetAuthProfile.mockResolvedValue(buildProfile({ crm_role: role }));
  mockGetAuthUser.mockResolvedValue({ user: { id: 'user-1' } });
}

describe('POST /api/inbox/[id]/contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    const built = buildSupabaseClient({
      crm_modules: { data: { id: 'mod-contacts' } },
      crm_notes: { data: { id: 'note-1' } },
    });
    supabase = built.client;
    mockGetConversation.mockResolvedValue(CONV);
    mockGetMessages.mockResolvedValue({ messages: MESSAGES, total: 1, hasMore: false });
    mockUpdateConversation.mockResolvedValue({ ...CONV, contact_id: 'rec-1' });
    mockExecuteCreate.mockResolvedValue({ ok: true, record: { id: 'rec-1', title: 'Frank Burnham' } });
  });

  it('creates a Partner Contact, saves the note, and links an unlinked thread', async () => {
    const req = buildRequest('http://localhost/api/inbox/x/contacts', {
      method: 'POST',
      body: {
        email: 'frank@bank.com',
        first_name: 'Frank',
        last_name: 'Burnham',
        note: 'Email: “ACH setup”\nDiscussed wholesale.',
      },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.record.id).toBe('rec-1');
    expect(json.linked).toBe(true);
    expect(json.extracted.first_name).toBe('Frank');
    expect(mockUpdateConversation).toHaveBeenCalledWith(CONV.id, { contact_id: 'rec-1' });
    const createArg = mockExecuteCreate.mock.calls[0][0];
    expect(createArg.input.data.contact_category).toBe('Partner Contact');
    expect(createArg.input.data.contact_status).toBe('Active');
    expect(createArg.input.data.relationship_type).toBe('Partner');
    expect(createArg.input.data.partner_industry).toBe('Banking / Credit Union');
  });

  it('does not overwrite an existing thread contact', async () => {
    mockGetConversation.mockResolvedValue({ ...CONV, contact_id: 'already' });
    const req = buildRequest('http://localhost/api/inbox/x/contacts', {
      method: 'POST',
      body: { email: 'frank@bank.com', first_name: 'Frank' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).linked).toBe(false);
    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });

  it('rejects a stranger who is not on the thread', async () => {
    const req = buildRequest('http://localhost/api/inbox/x/contacts', {
      method: 'POST',
      body: { email: 'stranger@elsewhere.com', first_name: 'Sam' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(400);
    expect(mockExecuteCreate).not.toHaveBeenCalled();
  });

  it('forbids crm_viewer', async () => {
    setupAuth('crm_viewer');
    const req = buildRequest('http://localhost/api/inbox/x/contacts', {
      method: 'POST',
      body: { email: 'frank@bank.com' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(403);
  });

  it('surfaces a duplicate as 409', async () => {
    mockExecuteCreate.mockResolvedValue({
      ok: false,
      status: 409,
      body: { code: 'DUPLICATE_RECORD', duplicates: [{ id: 'dup-1', title: 'Frank Burnham' }] },
    });
    const req = buildRequest('http://localhost/api/inbox/x/contacts', {
      method: 'POST',
      body: { email: 'frank@bank.com', first_name: 'Frank', last_name: 'Burnham' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: CONV.id }) });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('DUPLICATE_RECORD');
  });
});
