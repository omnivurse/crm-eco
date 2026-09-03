import { describe, expect, it } from 'vitest';
import {
  inboxAttachmentsFromRefs,
  persistInputFromOutboxPayload,
} from './persist-inbox-reply';

const ORG = '11111111-1111-1111-1111-111111111111';

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
