import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OutboxRow } from './outbox';
import { submitOutboxRow } from './outbox-process';

vi.mock('server-only', () => ({}));

const ORG = '11111111-1111-1111-1111-111111111111';
const ATTACHMENT_ID = '22222222-2222-4222-8222-222222222222';
const FILE_PATH = `${ORG}/benefits.pdf`;

function buildRow(attachments: OutboxRow['payload']['attachments']): OutboxRow {
  return {
    id: 'outbox-1',
    organization_id: ORG,
    idempotency_key: 'send-1',
    sender_address: 'support@example.com',
    from_name: 'Support',
    reply_to: 'support@example.com',
    to_addresses: ['member@example.com'],
    cc_addresses: [],
    bcc_addresses: [],
    subject: 'Your benefits',
    body_html: '<p>Attached.</p>',
    body_text: 'Attached.',
    conversation_id: null,
    status: 'leased',
    attempt_count: 1,
    provider: null,
    provider_message_id: null,
    last_error: null,
    payload: { attachments },
    linked_contact_id: null,
    linked_lead_id: null,
    linked_deal_id: null,
    updated_at: new Date(0).toISOString(),
  };
}

function buildClient() {
  return {
    from: vi.fn((table: string) => {
      const chain: Record<string, any> = {};
      for (const method of ['select', 'eq']) {
        chain[method] = vi.fn(() => chain);
      }
      chain.maybeSingle = vi.fn(async () => {
        if (table === 'integration_connections') return { data: null, error: null };
        if (table === 'email_attachments') {
          return {
            data: {
              file_path: FILE_PATH,
              file_name: 'benefits.pdf',
              mime_type: 'application/pdf',
              org_id: ORG,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      });
      return chain;
    }),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({
          data: new Blob([new Uint8Array([37, 80, 68, 70])]),
          error: null,
        })),
      })),
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('submitOutboxRow attachment retries', () => {
  it('keeps attachment-free retries unchanged', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'resend-plain' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await submitOutboxRow(buildClient(), buildRow(undefined));

    expect(result).toMatchObject({ success: true, messageId: 'resend-plain' });
    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.attachments).toBeUndefined();
  });

  it('downloads durable references and resends the original attachment', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'resend-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = buildClient();

    const result = await submitOutboxRow(
      client,
      buildRow([
        {
          filename: 'benefits.pdf',
          content_type: 'application/pdf',
          size: 4,
          id: ATTACHMENT_ID,
          file_path: FILE_PATH,
        },
      ]),
    );

    expect(result).toMatchObject({ success: true, messageId: 'resend-1' });
    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));
    expect(body.attachments).toEqual([
      {
        filename: 'benefits.pdf',
        content: 'JVBERg==',
        content_type: 'application/pdf',
      },
    ]);
  });

  it('does not call the provider for legacy display-only attachment metadata', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await submitOutboxRow(
      buildClient(),
      buildRow([
        {
          filename: 'benefits.pdf',
          content_type: 'application/pdf',
          size: 4,
        },
      ]),
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/refusing an incomplete retry/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
