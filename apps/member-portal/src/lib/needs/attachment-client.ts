/** Client-side helpers for need document uploads (mirrors API route limits). */

export const NEED_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export const NEED_ATTACHMENT_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

export interface NeedAttachmentRecord {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at?: string;
  download_url?: string | null;
}

export function validateNeedAttachmentFile(file: File): string | null {
  if (file.size > NEED_ATTACHMENT_MAX_BYTES) {
    return `"${file.name}" is too large (max 25 MB).`;
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return `"${file.name}" is not a supported type. Use PDF, JPEG, or PNG.`;
  }
  return null;
}

export async function uploadNeedAttachment(
  needId: string,
  file: File,
): Promise<{ attachment: NeedAttachmentRecord }> {
  const validationError = validateNeedAttachmentFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/member/needs/${needId}/attachments`, {
    method: 'POST',
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as {
    attachment?: NeedAttachmentRecord;
    error?: string;
  };

  if (!res.ok) {
    const code = body.error ?? 'upload_failed';
    const messages: Record<string, string> = {
      missing_file: 'No file was selected.',
      file_too_large: 'File exceeds the 25 MB limit.',
      unsupported_mime: 'File type not supported. Use PDF, JPEG, or PNG.',
      not_found: 'Need not found.',
    };
    throw new Error(messages[code] ?? 'Upload failed. Please try again.');
  }

  if (!body.attachment) {
    throw new Error('Upload failed. Please try again.');
  }

  return { attachment: body.attachment };
}

/** Soft-delete (remove) an uploaded document. Reversible via {@link restoreNeedAttachment}. */
export async function removeNeedAttachment(needId: string, attachmentId: string): Promise<void> {
  const res = await fetch(
    `/api/member/needs/${needId}/attachments?attachment_id=${encodeURIComponent(attachmentId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    throw new Error('Could not remove the document. Please try again.');
  }
}

/** Restore a removed document (the Undo action). */
export async function restoreNeedAttachment(needId: string, attachmentId: string): Promise<void> {
  const res = await fetch(
    `/api/member/needs/${needId}/attachments?attachment_id=${encodeURIComponent(attachmentId)}`,
    { method: 'PATCH' },
  );
  if (!res.ok) {
    throw new Error('Could not restore the document.');
  }
}
