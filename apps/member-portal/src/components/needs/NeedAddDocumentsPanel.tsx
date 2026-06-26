'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import { FileUp } from 'lucide-react';
import { NeedDocumentUpload } from './NeedDocumentUpload';
import type { NeedAttachmentRecord } from '@/lib/needs/attachment-client';

const UPLOAD_ALLOWED_STATUSES = new Set(['open', 'in_review', 'processing']);

interface NeedAddDocumentsPanelProps {
  needId: string;
  status: string;
}

export function NeedAddDocumentsPanel({ needId, status }: NeedAddDocumentsPanelProps) {
  const router = useRouter();
  const canUpload = UPLOAD_ALLOWED_STATUSES.has(status);

  if (!canUpload) {
    return null;
  }

  const handleUploaded = (_attachment: NeedAttachmentRecord) => {
    router.refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4 text-slate-500" aria-hidden />
          Add supporting documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-600">
          Upload additional receipts, bills, or EOBs while your need is being reviewed.
        </p>
        <NeedDocumentUpload
          needId={needId}
          attachments={[]}
          onAttachmentUploaded={handleUploaded}
        />
      </CardContent>
    </Card>
  );
}
