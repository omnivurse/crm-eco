const EMAIL_ATTACHMENT_BUCKET = 'email-attachments';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

export interface ScheduledEmailAttachment {
  file_name?: unknown;
  filename?: unknown;
  mime_type?: unknown;
  content_type?: unknown;
  file_path?: unknown;
  bucket_path?: unknown;
}

export interface ResendAttachment {
  filename: string;
  content: string;
  content_type: string;
}

export interface ScheduledAttachmentStorage {
  download: (
    bucket: string,
    path: string
  ) => Promise<{ data: Blob | null; error: { message?: string } | null }>;
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function bytesToBase64(bytes: Uint8Array): string {
  // Converting a whole 10 MB file with String.fromCharCode(...bytes) exceeds
  // the JavaScript argument limit. Chunking keeps scheduled attachments safe
  // at the same limits as the interactive send path.
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * Resolve durable draft attachment locators into Resend's inline payload.
 *
 * Draft JSON is caller-controlled, while this worker uses the service role.
 * Every path is therefore constrained to the draft's organization before any
 * storage read; a missing or unreadable file fails the send and keeps the
 * draft for retry instead of silently delivering an attachment-less message.
 */
export async function resolveScheduledEmailAttachments(
  rawAttachments: unknown,
  organizationId: string,
  storage: ScheduledAttachmentStorage
): Promise<ResendAttachment[]> {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
    return [];
  }

  const organizationPrefix = `${organizationId}/`;
  const resolved: ResendAttachment[] = [];
  let totalBytes = 0;

  for (const value of rawAttachments) {
    if (!value || typeof value !== 'object') {
      throw new Error('A scheduled attachment is invalid.');
    }

    const attachment = value as ScheduledEmailAttachment;
    const filename = requiredString(
      attachment.file_name ?? attachment.filename,
      'A scheduled attachment has no filename.'
    );
    const path = requiredString(
      attachment.file_path ?? attachment.bucket_path,
      'A scheduled attachment is missing its stored file.'
    );

    if (!path.startsWith(organizationPrefix)) {
      throw new Error('A scheduled attachment does not belong to this organization.');
    }

    const { data, error } = await storage.download(EMAIL_ATTACHMENT_BUCKET, path);
    if (error || !data) {
      throw new Error('A scheduled attachment could not be loaded.');
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw new Error('A scheduled attachment exceeds the 10 MB limit.');
    }

    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error('Scheduled attachments exceed the 40 MB total limit.');
    }

    resolved.push({
      filename,
      content: bytesToBase64(bytes),
      content_type:
        typeof attachment.mime_type === 'string'
          ? attachment.mime_type
          : typeof attachment.content_type === 'string'
            ? attachment.content_type
            : 'application/octet-stream',
    });
  }

  return resolved;
}
