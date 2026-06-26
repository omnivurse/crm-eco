import { FileText, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import type { NeedAttachmentView } from '@/lib/data/need-attachments';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NeedAttachmentsCardProps {
  attachments: NeedAttachmentView[];
}

export function NeedAttachmentsCard({ attachments }: NeedAttachmentsCardProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-slate-500" aria-hidden />
          Supporting documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{a.file_name}</p>
                <p className="text-xs text-slate-500">
                  {new Date(a.created_at).toLocaleDateString()}
                  {a.size_bytes != null ? ` · ${formatBytes(a.size_bytes)}` : ''}
                </p>
              </div>
              {a.download_url ? (
                <a
                  href={a.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
