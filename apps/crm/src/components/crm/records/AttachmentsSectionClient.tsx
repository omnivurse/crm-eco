'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AttachmentsPanel } from '@/components/crm/records/AttachmentsPanel';
import type { CrmAttachmentWithAuthor } from '@/lib/crm/types';

const MAX_RECORD_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface AttachmentsSectionClientProps {
  recordId: string;
  attachments: CrmAttachmentWithAuthor[];
  canUpload?: boolean;
  canDelete?: boolean;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error && typeof body.error === 'string') return body.error;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Server-rendered attachments list with client-driven upload/delete/download via API routes */
export function AttachmentsSectionClient({
  recordId,
  attachments,
  canUpload = false,
  canDelete = false,
}: AttachmentsSectionClientProps) {
  const router = useRouter();

  const onUpload = useCallback(
    async (file: File, description?: string) => {
      if (!canUpload) return;
      if (file.size > MAX_RECORD_ATTACHMENT_BYTES) {
        toast.error('File too large', { description: `Maximum size is ${MAX_RECORD_ATTACHMENT_BYTES / (1024 * 1024)} MB` });
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('recordId', recordId);
      if (description?.trim()) {
        formData.append('description', description.trim());
      }

      try {
        const response = await fetch('/api/crm/attachments', { method: 'POST', body: formData });
        if (!response.ok) {
          const message = await parseErrorMessage(response, 'Failed to upload file');
          throw new Error(message);
        }
        toast.success('File uploaded successfully');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload file');
        throw err;
      }
    },
    [canUpload, recordId, router],
  );

  const onDelete = useCallback(
    async (attachmentId: string) => {
      if (!canDelete) return;
      try {
        const response = await fetch(`/api/crm/attachments?id=${encodeURIComponent(attachmentId)}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const message = await parseErrorMessage(response, 'Failed to delete attachment');
          throw new Error(message);
        }
        // The undo toast is shown by AttachmentsPanel after this resolves — no
        // second success toast here (that would compete with the Undo one).
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete attachment');
        throw err;
      }
    },
    [canDelete, router],
  );

  const onDownload = useCallback(async (attachmentId: string): Promise<string> => {
    const response = await fetch(`/api/crm/attachments/${encodeURIComponent(attachmentId)}/signed-url`);
    if (!response.ok) {
      const message = await parseErrorMessage(response, 'Failed to prepare download');
      throw new Error(message);
    }
    const data = (await response.json()) as { signedUrl?: string };
    if (!data.signedUrl) {
      throw new Error('Missing download URL');
    }
    return data.signedUrl;
  }, []);

  return (
    <AttachmentsPanel
      recordId={recordId}
      attachments={attachments}
      onUpload={canUpload ? onUpload : undefined}
      onDelete={canDelete ? onDelete : undefined}
      onDownload={onDownload}
    />
  );
}
