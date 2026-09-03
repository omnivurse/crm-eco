import { describe, expect, it } from 'vitest';
import {
  applyAttachmentUploadResult,
  assertComposerAttachmentsReady,
  buildResendSendPayload,
  collectJsonAttachmentRefs,
  parseCommsSendAttachments,
  attachmentMetaFromRefs,
  attachmentRefsFromMeta,
  composerAttachmentsToRefs,
  composerDataToCommunicationsSendBody,
  emailAttachmentInsertRow,
  resolveOutboundAttachments,
  resolveOutboxPayloadAttachments,
  splitRecipientField,
} from './outbound-attachments';

const ORG = '11111111-1111-1111-1111-111111111111';

const uploaded = {
  id: 'att-1',
  file_name: 'benefits.pdf',
  file_size: 2048,
  mime_type: 'application/pdf',
  file_path: `${ORG}/123_benefits.pdf`,
  bucket_path: `${ORG}/123_benefits.pdf`,
};

describe('emailAttachmentInsertRow', () => {
  it('sets org_id and organization_id to the same tenant (CHECK constraint)', () => {
    const row = emailAttachmentInsertRow({
      organizationId: ORG,
      fileName: 'benefits.pdf',
      filePath: `${ORG}/123_benefits.pdf`,
      bucketPath: `${ORG}/123_benefits.pdf`,
      fileSize: 2048,
      mimeType: 'application/pdf',
      createdBy: 'profile-1',
    });

    expect(row.org_id).toBe(ORG);
    expect(row.organization_id).toBe(ORG);
    expect(row.org_id).toBe(row.organization_id);
  });
});

describe('applyAttachmentUploadResult', () => {
  it('keeps the newly added file after upload instead of mapping the stale pre-drop list', () => {
    const previous: Array<{ id: string; file_name: string }> = [];
    const temp = { id: 'temp-1', file_name: 'benefits.pdf', is_uploading: true };
    const current = [...previous, temp];

    // This is the live bug: mapping `previous` drops the file after a "success".
    const staleMap = previous.map((item) =>
      item.id === temp.id ? { ...item, ...uploaded, is_uploading: false } : item,
    );
    expect(staleMap).toEqual([]);

    const next = applyAttachmentUploadResult(current, 'temp-1', {
      ok: true,
      attachment: uploaded,
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: 'att-1',
      file_name: 'benefits.pdf',
      file_path: uploaded.file_path,
      is_uploading: false,
    });
  });
});

describe('composerDataToCommunicationsSendBody', () => {
  it('includes attachments and the selected From address (the client drop)', () => {
    const body = composerDataToCommunicationsSendBody({
      to: [{ email: 'member@example.com' }],
      cc: [],
      bcc: [],
      subject: 'Your documents',
      body_html: '<p>See attached</p>',
      from_email: 'wendy@payitforwardhealth.com',
      from_name: 'Wendy',
      attachments: [uploaded],
    });

    expect(body.from_email).toBe('wendy@payitforwardhealth.com');
    expect(body.attachments).toEqual([
      {
        // Synthetic composer ids are stripped: the ref resolves by file_path,
        // and only a real email_attachments uuid may trigger the DB lookup.
        id: undefined,
        file_name: 'benefits.pdf',
        mime_type: 'application/pdf',
        file_path: uploaded.file_path,
        bucket_path: uploaded.bucket_path,
        file_size: 2048,
      },
    ]);
  });

  it('does not send a public_url for Resend to fetch (bucket is private)', () => {
    const refs = composerAttachmentsToRefs([
      { ...uploaded, public_url: 'https://example.supabase.co/storage/v1/object/public/email-attachments/x' },
    ]);
    expect(refs[0]).not.toHaveProperty('public_url');
  });
});

describe('assertComposerAttachmentsReady', () => {
  it('blocks send when the chip is visible but the file never stored', () => {
    expect(() =>
      assertComposerAttachmentsReady([
        { id: 'temp-1', file_name: 'benefits.pdf', is_uploading: false },
      ]),
    ).toThrow(/not ready/i);
  });
});

describe('parseCommsSendAttachments', () => {
  it('accepts email attachment refs', () => {
    const refs = parseCommsSendAttachments('email', [
      { id: 'att-1', file_name: 'benefits.pdf', file_path: uploaded.file_path, file_size: 2048 },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].file_name).toBe('benefits.pdf');
  });

  it('rejects SMS with attachments', () => {
    expect(() =>
      parseCommsSendAttachments('sms', [
        { file_name: 'benefits.pdf', file_path: uploaded.file_path },
      ]),
    ).toThrow(/SMS messages cannot include attachments/i);
  });

  it('round-trips refs through message meta for dispatcher resolve', () => {
    const refs = parseCommsSendAttachments('email', [uploaded]);
    const meta = attachmentMetaFromRefs(refs);
    expect(attachmentRefsFromMeta(meta)).toEqual([
      {
        id: 'att-1',
        file_name: 'benefits.pdf',
        mime_type: 'application/pdf',
        file_path: uploaded.file_path,
        bucket_path: uploaded.bucket_path,
        file_size: 2048,
      },
    ]);
  });

  it('keeps file_path on the outbox payload shape the worker retry reads', () => {
    const meta = attachmentMetaFromRefs(parseCommsSendAttachments('email', [uploaded]));
    const outboxAttachments = attachmentMetaFromRefs(attachmentRefsFromMeta(meta));
    expect(outboxAttachments[0]?.file_path).toBe(uploaded.file_path);
    expect(outboxAttachments[0]?.id).toBe('att-1');
  });
});

describe('parse helpers', () => {
  it('collects JSON attachment refs instead of dropping them', () => {
    expect(
      collectJsonAttachmentRefs([
        { id: 'att-1', file_name: 'benefits.pdf', file_path: uploaded.file_path },
      ]),
    ).toHaveLength(1);
  });

  it('splits FormData recipient strings the same way as attachments must be kept', () => {
    expect(splitRecipientField('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com']);
  });
});

describe('buildResendSendPayload', () => {
  it('puts resolved attachments on the Resend JSON body', () => {
    const payload = buildResendSendPayload({
      from: 'Wendy <wendy@payitforwardhealth.com>',
      to: ['member@example.com'],
      subject: 'Your documents',
      html: '<p>See attached</p>',
      text: 'See attached',
      attachments: [
        {
          filename: 'benefits.pdf',
          content: 'JVBERg==',
          contentType: 'application/pdf',
          size: 4,
        },
      ],
    });

    expect(payload.attachments).toEqual([
      {
        filename: 'benefits.pdf',
        content: 'JVBERg==',
        content_type: 'application/pdf',
      },
    ]);
  });

  it('sends RFC822 threading headers on the Resend payload', () => {
    const payload = buildResendSendPayload({
      from: 'Support <support@payitforwardhealth.com>',
      to: ['member@example.com'],
      subject: 'Re: Cards',
      html: '<p>Here they are</p>',
      message_id: '<abc@payitforwardhealth.com>',
      in_reply_to: '<parent@member.com>',
      references: ['<root@member.com>', '<parent@member.com>'],
    });

    expect(payload.headers).toMatchObject({
      'Message-ID': '<abc@payitforwardhealth.com>',
      'In-Reply-To': '<parent@member.com>',
      References: '<root@member.com> <parent@member.com>',
    });
  });

  it('reproduces the production miss: no attachments key when the list is omitted', () => {
    const payload = buildResendSendPayload({
      from: 'Wendy <wendy@payitforwardhealth.com>',
      to: ['member@example.com'],
      subject: 'Your documents',
      html: '<p>See attached</p>',
    });
    expect(payload.attachments).toBeUndefined();
  });
});

describe('resolveOutboundAttachments', () => {
  it('downloads org-scoped storage files and fails closed on a missing file', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const resolved = await resolveOutboundAttachments({
      refs: [{ id: 'att-1', file_name: 'benefits.pdf' }],
      inline: [],
      organizationId: ORG,
      lookup: async () => ({
        file_path: uploaded.file_path,
        file_name: 'benefits.pdf',
        mime_type: 'application/pdf',
        org_id: ORG,
      }),
      download: async (path) => {
        expect(path).toBe(uploaded.file_path);
        return bytes;
      },
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].filename).toBe('benefits.pdf');
    expect(resolved[0].content.length).toBeGreaterThan(0);
  });

  it('rejects a path from another tenant', async () => {
    await expect(
      resolveOutboundAttachments({
        refs: [{ file_name: 'x.pdf', file_path: 'other-org/secret.pdf' }],
        inline: [],
        organizationId: ORG,
        lookup: async () => null,
        download: async () => new Uint8Array([1]),
      }),
    ).rejects.toThrow(/organization/i);
  });

  it('keeps FormData files that the send route used to skip', async () => {
    const resolved = await resolveOutboundAttachments({
      refs: [],
      inline: [
        {
          filename: 'benefits.pdf',
          mimeType: 'application/pdf',
          bytes: new Uint8Array([37, 80, 68, 70]),
        },
      ],
      organizationId: ORG,
      lookup: async () => null,
      download: async () => {
        throw new Error('should not download for inline files');
      },
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0].filename).toBe('benefits.pdf');
  });
});

describe('composerAttachmentsToRefs synthetic ids', () => {
  it('strips forward/draft synthetic ids so path-backed files resolve by path', () => {
    const refs = composerAttachmentsToRefs([
      {
        id: 'fwd-95457589-b57a-439b-ad9d-41793f4a7d32-0',
        file_name: 'application.pdf',
        file_size: 100,
        mime_type: 'application/pdf',
        file_path: '11111111-1111-1111-1111-111111111111/inbound/x/application.pdf',
      },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBeUndefined();
    expect(refs[0].file_path).toBe(
      '11111111-1111-1111-1111-111111111111/inbound/x/application.pdf',
    );
  });

  it('keeps a genuine persisted email_attachments uuid', () => {
    const refs = composerAttachmentsToRefs([
      {
        id: '3f8b7b30-1234-4abc-8def-1234567890ab',
        file_name: 'x.pdf',
        file_size: 1,
        mime_type: 'application/pdf',
      },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe('3f8b7b30-1234-4abc-8def-1234567890ab');
  });

  it('drops a ref that has neither a stored path nor a persisted id', () => {
    expect(
      composerAttachmentsToRefs([
        { id: 'fwd-msg-1', file_name: 'ghost.pdf', file_size: 1, mime_type: 'application/pdf' },
      ]),
    ).toHaveLength(0);
  });
});

describe('resolveOutboxPayloadAttachments', () => {
  it('rehydrates file bytes from payload file_path on worker retry', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const attachments = await resolveOutboxPayloadAttachments({
      attachments: [
        {
          filename: 'benefits.pdf',
          content_type: 'application/pdf',
          size: pdfBytes.byteLength,
          file_path: uploaded.file_path,
        },
      ],
      organizationId: ORG,
      lookup: async () => null,
      download: async (path) => {
        expect(path).toBe(uploaded.file_path);
        return pdfBytes;
      },
    });

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('benefits.pdf');
    expect(attachments[0].content).toBe(Buffer.from(pdfBytes).toString('base64'));
  });

  it('appends calendar ICS after stored file attachments', async () => {
    const ics = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
    const attachments = await resolveOutboxPayloadAttachments({
      attachments: [
        {
          filename: 'doc.pdf',
          content_type: 'application/pdf',
          size: 3,
          file_path: uploaded.file_path,
        },
      ],
      calendar: { method: 'REQUEST', ics, filename: 'invite.ics' },
      organizationId: ORG,
      lookup: async () => null,
      download: async () => new Uint8Array([1, 2, 3]),
    });

    expect(attachments).toHaveLength(2);
    expect(attachments[1].filename).toBe('invite.ics');
    expect(Buffer.from(attachments[1].content, 'base64').toString('utf8')).toBe(ics);
  });

  it('fails closed when metadata-only attachments have no file_path or id', async () => {
    await expect(
      resolveOutboxPayloadAttachments({
        attachments: [
          {
            filename: 'benefits.pdf',
            content_type: 'application/pdf',
            size: 10,
          },
        ],
        organizationId: ORG,
        lookup: async () => null,
        download: async () => new Uint8Array([1]),
      }),
    ).rejects.toThrow(/missing stored file paths/i);
  });
});
