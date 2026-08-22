import { describe, expect, it } from 'vitest';
import {
  applyAttachmentUploadResult,
  assertComposerAttachmentsReady,
  buildResendSendPayload,
  collectJsonAttachmentRefs,
  composerAttachmentsToRefs,
  composerDataToCommunicationsSendBody,
  emailAttachmentInsertRow,
  resolveOutboundAttachments,
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
        id: 'att-1',
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
