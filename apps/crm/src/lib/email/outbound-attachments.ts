/**
 * Outbound email attachments.
 *
 * The composer can show a file as "attached" while the send path used to
 * drop it: FormData files were skipped, JSON sends omitted the list, and
 * `email_attachments` inserts failed the tenant-key CHECK because only
 * `org_id` was set. Helpers here keep upload, send, and the Resend payload
 * on one contract.
 */

export const EMAIL_ATTACHMENT_BUCKET = 'email-attachments';
export const MAX_OUTBOUND_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_OUTBOUND_TOTAL_BYTES = 40 * 1024 * 1024;

export type ComposerAttachment = {
  id?: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  file_path?: string;
  bucket_path?: string;
  public_url?: string;
  is_uploading?: boolean;
  error?: string;
};

export type OutboundAttachmentRef = {
  id?: string;
  file_name: string;
  mime_type?: string;
  file_path?: string;
  bucket_path?: string;
  file_size?: number;
};

export type InlineOutboundFile = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type ResolvedOutboundAttachment = {
  filename: string;
  content: string;
  contentType: string;
  size: number;
};

export type CommunicationsSendBody = {
  channel: 'email';
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body_html: string;
  body_text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  attachments: OutboundAttachmentRef[];
};

export function emailAttachmentInsertRow(input: {
  organizationId: string;
  fileName: string;
  filePath: string;
  bucketPath: string;
  fileSize: number;
  mimeType: string;
  createdBy: string;
  campaignId?: string | null;
  templateId?: string | null;
}): Record<string, unknown> {
  return {
    org_id: input.organizationId,
    organization_id: input.organizationId,
    campaign_id: input.campaignId || null,
    template_id: input.templateId || null,
    file_name: input.fileName,
    file_path: input.filePath,
    bucket_path: input.bucketPath,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    created_by: input.createdBy,
  };
}

export function applyAttachmentUploadResult<T extends { id: string }>(
  current: T[],
  tempId: string,
  result:
    | { ok: true; attachment: Partial<T> & { id?: string } }
    | { ok: false; error: string },
): T[] {
  return current.map((item) => {
    if (item.id !== tempId) return item;
    if (!result.ok) {
      return { ...item, is_uploading: false, error: result.error };
    }
    return {
      ...item,
      ...result.attachment,
      is_uploading: false,
      error: undefined,
    };
  });
}

export function composerAttachmentsToRefs(
  attachments: ComposerAttachment[],
): OutboundAttachmentRef[] {
  return attachments
    .filter((attachment) => !attachment.is_uploading && !attachment.error)
    .map((attachment) => ({
      id: attachment.id,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type,
      file_path: attachment.file_path,
      bucket_path: attachment.bucket_path,
      file_size: attachment.file_size,
    }))
    .filter((ref) => Boolean(ref.file_path || ref.bucket_path || isPersistedAttachmentId(ref.id)));
}

function isPersistedAttachmentId(id: string | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function composerDataToCommunicationsSendBody(data: {
  to: Array<{ email: string }>;
  cc: Array<{ email: string }>;
  bcc: Array<{ email: string }>;
  subject: string;
  body_html: string;
  body_text?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  attachments: ComposerAttachment[];
}): CommunicationsSendBody {
  return {
    channel: 'email',
    to: data.to.map((recipient) => recipient.email),
    cc: data.cc.map((recipient) => recipient.email),
    bcc: data.bcc.map((recipient) => recipient.email),
    subject: data.subject,
    body_html: data.body_html,
    body_text: data.body_text,
    from_email: data.from_email,
    from_name: data.from_name,
    reply_to: data.reply_to,
    attachments: composerAttachmentsToRefs(data.attachments),
  };
}

export function assertComposerAttachmentsReady(attachments: ComposerAttachment[]): void {
  const visible = attachments.filter((attachment) => !attachment.error);
  if (visible.some((attachment) => attachment.is_uploading)) {
    throw new Error('Wait for attachments to finish uploading.');
  }
  const missingStorage = visible.filter(
    (attachment) => !attachment.file_path && !attachment.bucket_path,
  );
  if (missingStorage.length > 0) {
    throw new Error('Attachments are not ready. Remove them and attach again.');
  }
}

export function splitRecipientField(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const emails = value.map(String).map((email) => email.trim()).filter(Boolean);
    return emails.length > 0 ? emails : undefined;
  }
  if (typeof value === 'string') {
    const emails = value.split(',').map((email) => email.trim()).filter(Boolean);
    return emails.length > 0 ? emails : undefined;
  }
  return undefined;
}

export function collectJsonAttachmentRefs(value: unknown): OutboundAttachmentRef[] {
  if (!Array.isArray(value)) return [];
  const refs: OutboundAttachmentRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const fileName = String(row.file_name || row.filename || '').trim();
    if (!fileName) continue;
    refs.push({
      id: typeof row.id === 'string' ? row.id : undefined,
      file_name: fileName,
      mime_type: typeof row.mime_type === 'string' ? row.mime_type : undefined,
      file_path: typeof row.file_path === 'string' ? row.file_path : undefined,
      bucket_path: typeof row.bucket_path === 'string' ? row.bucket_path : undefined,
      file_size: typeof row.file_size === 'number' ? row.file_size : undefined,
    });
  }
  return refs;
}

export async function fileToInline(file: File): Promise<InlineOutboundFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    bytes,
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function toResendAttachments(
  attachments: ResolvedOutboundAttachment[],
): Array<{ filename: string; content: string; content_type: string }> {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    content_type: attachment.contentType,
  }));
}

export function toSendGridAttachments(
  attachments: ResolvedOutboundAttachment[],
): Array<{ content: string; filename: string; type: string; disposition: 'attachment' }> {
  return attachments.map((attachment) => ({
    content: attachment.content,
    filename: attachment.filename,
    type: attachment.contentType,
    disposition: 'attachment',
  }));
}

export function buildResendSendPayload(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  unsubscribe_url?: string;
  attachments?: ResolvedOutboundAttachment[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: params.from,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: params.reply_to,
  };

  if (params.unsubscribe_url) {
    payload.headers = {
      'List-Unsubscribe': `<${params.unsubscribe_url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  if (params.attachments && params.attachments.length > 0) {
    payload.attachments = toResendAttachments(params.attachments);
  }

  return payload;
}

function assertSizeLimits(files: Array<{ size: number; filename: string }>): void {
  let total = 0;
  for (const file of files) {
    if (file.size > MAX_OUTBOUND_FILE_BYTES) {
      throw new Error(`${file.filename} is too large (max 10MB).`);
    }
    total += file.size;
  }
  if (total > MAX_OUTBOUND_TOTAL_BYTES) {
    throw new Error('Total attachments exceed 40MB.');
  }
}

function assertOrgPath(path: string, organizationId: string): void {
  const prefix = `${organizationId}/`;
  if (!path.startsWith(prefix)) {
    throw new Error('Attachment does not belong to this organization.');
  }
}

export async function resolveOutboundAttachments(opts: {
  refs: OutboundAttachmentRef[];
  inline: InlineOutboundFile[];
  organizationId: string;
  lookup: (id: string) => Promise<{
    file_path: string;
    file_name: string;
    mime_type: string;
    org_id: string;
  } | null>;
  download: (path: string) => Promise<Uint8Array>;
}): Promise<ResolvedOutboundAttachment[]> {
  const resolved: ResolvedOutboundAttachment[] = [];

  for (const file of opts.inline) {
    resolved.push({
      filename: file.filename,
      content: bytesToBase64(file.bytes),
      contentType: file.mimeType || 'application/octet-stream',
      size: file.bytes.byteLength,
    });
  }

  for (const ref of opts.refs) {
    let path = ref.file_path || ref.bucket_path || '';
    let filename = ref.file_name;
    let mimeType = ref.mime_type || 'application/octet-stream';

    if (ref.id) {
      const row = await opts.lookup(ref.id);
      if (!row || row.org_id !== opts.organizationId) {
        throw new Error(`Attachment "${filename}" could not be loaded.`);
      }
      path = row.file_path;
      filename = row.file_name;
      mimeType = row.mime_type || mimeType;
    }

    if (!path) {
      throw new Error(`Attachment "${filename}" is missing its stored file.`);
    }
    assertOrgPath(path, opts.organizationId);

    const bytes = await opts.download(path);
    resolved.push({
      filename,
      content: bytesToBase64(bytes),
      contentType: mimeType,
      size: bytes.byteLength,
    });
  }

  const requested = opts.refs.length + opts.inline.length;
  if (requested > 0 && resolved.length !== requested) {
    throw new Error('One or more attachments could not be attached to the email.');
  }

  assertSizeLimits(resolved.map((attachment) => ({
    size: attachment.size,
    filename: attachment.filename,
  })));

  return resolved;
}
