import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Stand in for the real ECDSA verifier so tests can drive both outcomes without
// carrying a keypair. `mockVerifySignature` is the switch.
const mockVerifySignature = vi.fn(() => true);

vi.mock('@sendgrid/eventwebhook', () => ({
  EventWebhook: class {
    convertPublicKeyToECDSA(key: string) {
      return key;
    }
    verifySignature(...args: unknown[]) {
      return mockVerifySignature(...(args as []));
    }
  },
  EventWebhookHeader: {
    SIGNATURE: () => SIGNATURE_HEADER,
    TIMESTAMP: () => TIMESTAMP_HEADER,
  },
}));

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature';
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp';

import { POST } from './route';

/** A request carrying the signature headers a genuine SendGrid call would have. */
function buildSignedRequest(body: unknown, headers: Record<string, string> = {}) {
  return buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
    method: 'POST',
    body,
    headers: {
      [SIGNATURE_HEADER]: 'signature-placeholder',
      [TIMESTAMP_HEADER]: '1700000000',
      ...headers,
    },
  });
}

function buildChainable(result: { data: unknown; error?: unknown }) {
  const c: Record<string, any> = {};
  ['select', 'eq', 'or', 'update', 'insert'].forEach((m) => {
    c[m] = vi.fn(() => c);
  });
  c.single = vi.fn(() => Promise.resolve(result));
  c.then = (resolve: Function) => resolve(result);
  return c;
}

const ORIGINAL_KEY = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

describe('POST /api/webhooks/sendgrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldUpdateStatus.mockReturnValue(false);
    mockVerifySignature.mockReturnValue(true);
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = 'test-verification-key';
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
    else process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY = ORIGINAL_KEY;
  });

  // ── Signature verification ────────────────────────────────────────────────
  // This route previously only checked that the headers were PRESENT — any
  // non-empty value passed — and skipped the check entirely when the key was
  // unset. Forged delivery/bounce/spam events were written with the service-role
  // client. These four tests are the regression guard.

  it('rejects a request with no signature headers', async () => {
    const req = buildRequest('http://localhost:3000/api/webhooks/sendgrid', {
      method: 'POST',
      body: [{ event: 'delivered', sg_message_id: 'a.b.c' }],
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Missing webhook signature headers');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects a request whose signature does not verify', async () => {
    mockVerifySignature.mockReturnValue(false);

    const res = await POST(buildSignedRequest([{ event: 'delivered', sg_message_id: 'a.b.c' }]));

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid webhook signature');
    // Nothing may reach the database on a forged event.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('fails closed when the verification key is not configured', async () => {
    delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

    const res = await POST(buildSignedRequest([{ event: 'delivered', sg_message_id: 'a.b.c' }]));

    expect(res.status).toBe(500);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('verifies against the RAW request body, not a reserialized copy', async () => {
    // ECDSA signs exact bytes, so reading with request.json() and re-stringifying
    // would break verification against real SendGrid traffic.
    const events = [{ event: 'delivered', sg_message_id: 'a.b.c' }];
    mockFrom.mockImplementation(() => buildChainable({ data: null }));

    await POST(buildSignedRequest(events));

    expect(mockVerifySignature).toHaveBeenCalledWith(
      'test-verification-key',
      JSON.stringify(events),
      'signature-placeholder',
      '1700000000',
    );
  });

  // ── Event processing (all now require a valid signature) ──────────────────

  it('returns 400 for non-array payload', async () => {
    const res = await POST(buildSignedRequest({ event: 'delivered' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid payload');
  });

  it('returns success with 0 processed for events with no sg_message_id', async () => {
    const res = await POST(buildSignedRequest([{ event: 'delivered' }]));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(0);
  });

  it('skips events with no matching message', async () => {
    mockFrom.mockReturnValue(buildChainable({ data: null }));

    const res = await POST(buildSignedRequest([{ event: 'delivered', sg_message_id: 'abc123.xyz.smtp' }]));

    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(0);
  });

  it('processes events and creates event records', async () => {
    const message = { id: 'msg-1', org_id: 'org-1', status: 'sent' };
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      // First from() call = crm_messages lookup, second = crm_message_events insert
      return fromCallCount === 1 ? buildChainable({ data: message }) : buildChainable({ data: null });
    });
    mockShouldUpdateStatus.mockReturnValue(false);

    const res = await POST(buildSignedRequest([{ event: 'processed', sg_message_id: 'abc123.xyz.smtp' }]));

    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(1);
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

    const res = await POST(buildSignedRequest([{ event: 'delivered', sg_message_id: 'abc123.xyz.smtp' }]));

    expect(res.status).toBe(200);
    expect(mockMapSendGridEventToStatus).toHaveBeenCalledWith('delivered');
  });

  it('processes multiple events', async () => {
    const message = { id: 'msg-1', org_id: 'org-1', status: 'queued' };
    mockFrom.mockImplementation(() => buildChainable({ data: message }));
    mockShouldUpdateStatus.mockReturnValue(false);

    const res = await POST(
      buildSignedRequest([
        { event: 'processed', sg_message_id: 'a.b.c' },
        { event: 'delivered', sg_message_id: 'd.e.f' },
      ]),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(2);
  });

  it('returns 500 on unexpected error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Unexpected');
    });

    const res = await POST(buildSignedRequest([{ event: 'delivered', sg_message_id: 'a.b.c' }]));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });
});
