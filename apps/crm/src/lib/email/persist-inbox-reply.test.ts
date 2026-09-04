import { describe, expect, it } from 'vitest';
import {
  inboxAttachmentsFromRefs,
  persistInputFromOutboxPayload,
  persistOutboundInboxMessage,
} from './persist-inbox-reply';
import { INBOX_MESSAGE_IDENTITY_CONFLICT_TARGET } from '@/lib/inbox/message-identity';

const ORG = '11111111-1111-1111-1111-111111111111';

type WriteCall = { op: 'insert' | 'upsert'; payload: any; options?: any };

/**
 * Minimal stand-in for the service-role client, recording how the message was
 * written so the test can assert on the write operation itself.
 */
function fakeClient(opts: { conversationFound: boolean }) {
  const calls: WriteCall[] = [];
  const client = {
    from(table: string) {
      if (table === 'inbox_conversations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: opts.conversationFound ? { id: 'conv-1' } : null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'inbox_messages') {
        const result = {
          select: () => ({ single: async () => ({ data: { id: 'msg-1' }, error: null }) }),
        };
        return {
          insert: (payload: any) => {
            calls.push({ op: 'insert', payload });
            return result;
          },
          upsert: (payload: any, options?: any) => {
            calls.push({ op: 'upsert', payload, options });
            return result;
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client, calls };
}

const baseInput = {
  organizationId: ORG,
  conversationId: 'conv-1',
  fromAddress: 'a@x.com',
  fromName: 'Ada',
  toAddress: 'b@x.com',
  subject: 'Hi',
  rfc822MessageId: '<id@x.com>',
  provider: 'resend',
  providerMessageId: 'resend-send-1',
};

describe('inboxAttachmentsFromRefs', () => {
  it('keeps org-prefixed file_path and maps inbox field names', () => {
    expect(
      inboxAttachmentsFromRefs(
        [
          {
            file_name: 'benefits.pdf',
            mime_type: 'application/pdf',
            file_size: 2048,
            file_path: `${ORG}/123_benefits.pdf`,
          },
        ],
        ORG,
      ),
    ).toEqual([
      {
        filename: 'benefits.pdf',
        content_type: 'application/pdf',
        size: 2048,
        file_path: `${ORG}/123_benefits.pdf`,
      },
    ]);
  });

  it('drops metadata-only rows and cross-tenant paths', () => {
    expect(
      inboxAttachmentsFromRefs(
        [
          { filename: 'a.pdf', content_type: 'application/pdf', size: 1 },
          { filename: 'b.pdf', file_path: 'other-org/secret.pdf', size: 2 },
        ],
        ORG,
      ),
    ).toEqual([]);
  });
});

describe('persistInputFromOutboxPayload', () => {
  it('carries file_path attachments onto the persist input', () => {
    const input = persistInputFromOutboxPayload(ORG, {
      conversation_id: 'conv-1',
      sender_address: 'a@x.com',
      from_name: 'Ada',
      to_addresses: ['b@x.com'],
      cc_addresses: [],
      bcc_addresses: [],
      subject: 'Hi',
      body_html: '<p>Hi</p>',
      body_text: 'Hi',
      payload: {
        rfc822_message_id: '<id@x.com>',
        persist_inbox: true,
        attachments: [
          {
            filename: 'benefits.pdf',
            content_type: 'application/pdf',
            size: 10,
            file_path: `${ORG}/1_benefits.pdf`,
          },
        ],
      },
    });
    expect(input?.attachments).toEqual([
      {
        filename: 'benefits.pdf',
        content_type: 'application/pdf',
        size: 10,
        file_path: `${ORG}/1_benefits.pdf`,
      },
    ]);
  });
});

describe('persistOutboundInboxMessage write path', () => {
  it('upserts against the provider identity so one send cannot be filed twice', async () => {
    // Regression: the send service persists a send inline and the outbox worker
    // can persist the same send again when a row is reclaimed as stale. Both
    // carry one provider message id, so a plain insert filed the email twice.
    const { client, calls } = fakeClient({ conversationFound: true });

    const result = await persistOutboundInboxMessage(client, baseInput);

    expect(result).toEqual({ id: 'msg-1' });
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe('upsert');
    expect(calls[0].options).toEqual({
      onConflict: INBOX_MESSAGE_IDENTITY_CONFLICT_TARGET,
    });
  });

  it('targets exactly the columns covered by the unique index', () => {
    // Drifting from the index makes the upsert throw "no unique or exclusion
    // constraint matching the ON CONFLICT specification" at runtime.
    expect(INBOX_MESSAGE_IDENTITY_CONFLICT_TARGET).toBe(
      'org_id,direction,external_provider,external_id',
    );
  });

  it('still refuses to write into a conversation from another org', async () => {
    const { client, calls } = fakeClient({ conversationFound: false });

    const result = await persistOutboundInboxMessage(client, baseInput);

    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
