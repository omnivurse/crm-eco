'use client';

import { useRef, useState } from 'react';
import { UploadSimple, CircleNotch, Paperclip, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@crm-eco/ui';
import {
  NEED_ATTACHMENT_ACCEPT,
  NEED_ATTACHMENT_MAX_BYTES,
  uploadNeedAttachment,
  type NeedAttachmentRecord,
} from '@/lib/needs/attachment-client';

interface PendingUpload {
  key: string;
  file: File;
  status: 'uploading' | 'error';
  error?: string;
}

/**
 * Document categories. The chosen label is prepended to the stored file name
 * (e.g. "Itemized bill — receipt.pdf") so the type is captured without a schema
 * change. 'other' uploads keep their original name.
 */
const DOCUMENT_TYPES = [
  { value: 'itemized_bill', label: 'Itemized bill' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'lab_result', label: 'Lab result' },
  { value: 'medical_records', label: 'Medical records' },
  { value: 'other', label: 'General / other' },
] as const;

/** Prefix a file's name with its document-type label (no-op for 'other'). */
function withDocumentType(file: File, typeValue: string): File {
  const label = DOCUMENT_TYPES.find((t) => t.value === typeValue)?.label;
  if (!label || typeValue === 'other') return file;
  // Avoid double-prefixing if the user re-selects the same file.
  if (file.name.startsWith(`${label} — `)) return file;
  return new File([file], `${label} — ${file.name}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

interface NeedDocumentUploadProps {
  needId: string | null;
  attachments: NeedAttachmentRecord[];
  /** Called after each file uploads successfully. */
  onAttachmentUploaded: (attachment: NeedAttachmentRecord) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NeedDocumentUpload({
  needId,
  attachments,
  onAttachmentUploaded,
  disabled = false,
}: NeedDocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPES[0].value);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!needId || disabled) return;

    const list = Array.from(files);
    if (list.length === 0) return;

    for (const rawFile of list) {
      // Tag the upload with the selected document category via its file name.
      const file = withDocumentType(rawFile, documentType);
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      setPending((prev) => [...prev, { key, file, status: 'uploading' }]);

      try {
        const { attachment } = await uploadNeedAttachment(needId, file);
        onAttachmentUploaded(attachment);
        setPending((prev) => prev.filter((p) => p.key !== key));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        setPending((prev) =>
          prev.map((p) => (p.key === key ? { ...p, status: 'error' as const, error: message } : p)),
        );
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  const dismissPending = (key: string) => {
    setPending((prev) => prev.filter((p) => p.key !== key));
  };

  const canUpload = Boolean(needId) && !disabled;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="need-document-type" className="text-sm font-medium text-slate-900">
          Document type
        </label>
        <select
          id="need-document-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          disabled={!canUpload}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--mp-teal)] focus:outline-none focus:ring-1 focus:ring-[var(--mp-teal)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Choose a category, then upload the matching file. You can change it between uploads.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={NEED_ATTACHMENT_ACCEPT}
        multiple
        disabled={!canUpload}
        onChange={handleInputChange}
      />

      <div
        role="button"
        tabIndex={canUpload ? 0 : -1}
        onKeyDown={(e) => {
          if (canUpload && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (canUpload) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canUpload ? handleDrop : undefined}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          dragOver
            ? 'border-[var(--mp-teal)] bg-[var(--mp-mist)]'
            : canUpload
              ? 'border-slate-300 bg-white hover:border-slate-400'
              : 'border-slate-200 bg-slate-50 opacity-60'
        }`}
      >
        <UploadSimple weight="light" className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden />
        <p className="text-sm font-medium text-slate-900">
          {canUpload ? 'Drop files here or choose from your device' : 'Save step 1 first to upload documents'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF, JPEG, or PNG — max {formatBytes(NEED_ATTACHMENT_MAX_BYTES)} each
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          disabled={!canUpload}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip weight="light" className="mr-2 h-4 w-4" aria-hidden />
          Choose files
        </Button>
      </div>

      {(attachments.length > 0 || pending.length > 0) && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Paperclip weight="light" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{a.file_name}</p>
                {a.size_bytes != null && (
                  <p className="text-xs text-slate-500">{formatBytes(a.size_bytes)}</p>
                )}
              </div>
              <span className="shrink-0 text-xs font-medium text-green-700">Uploaded</span>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-3 text-sm">
              {p.status === 'uploading' ? (
                <CircleNotch weight="light" className="h-4 w-4 shrink-0 animate-spin text-[var(--mp-teal)]" aria-hidden />
              ) : (
                <WarningCircle weight="light" className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{p.file.name}</p>
                <p className={`text-xs ${p.status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                  {p.status === 'uploading' ? 'Uploading…' : p.error}
                </p>
              </div>
              {p.status === 'error' && (
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-slate-600"
                  aria-label={`Dismiss failed upload ${p.file.name}`}
                  onClick={() => dismissPending(p.key)}
                >
                  <Trash weight="light" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
