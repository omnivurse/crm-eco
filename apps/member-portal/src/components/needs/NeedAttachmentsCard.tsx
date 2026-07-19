'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Download, Trash, ArrowsClockwise, CircleNotch } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui';
import type { NeedAttachmentView } from '@/lib/data/need-attachments';
import { removeNeedAttachment, restoreNeedAttachment } from '@/lib/needs/attachment-client';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NeedAttachmentsCardProps {
  needId: string;
  attachments: NeedAttachmentView[];
  /** When false (e.g. the need is closed), documents can't be removed. */
  canRemove?: boolean;
}

const UNDO_WINDOW_MS = 8000;

export function NeedAttachmentsCard({ needId, attachments, canRemove = true }: NeedAttachmentsCardProps) {
  const [items, setItems] = useState<NeedAttachmentView[]>(attachments);
  const [removed, setRemoved] = useState<NeedAttachmentView[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Clear any pending undo-window timers on unmount (avoid setState-after-unmount).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of Object.keys(pending)) clearTimeout(pending[id]);
    };
  }, []);

  const handleRemove = useCallback(
    async (a: NeedAttachmentView) => {
      setBusyId(a.id);
      setError(null);
      try {
        await removeNeedAttachment(needId, a.id);
        setItems((prev) => prev.filter((x) => x.id !== a.id));
        setRemoved((prev) => [a, ...prev]);
        timers.current[a.id] = setTimeout(() => {
          setRemoved((prev) => prev.filter((r) => r.id !== a.id));
          delete timers.current[a.id];
        }, UNDO_WINDOW_MS);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove the document.');
      } finally {
        setBusyId(null);
      }
    },
    [needId],
  );

  const handleUndo = useCallback(
    async (a: NeedAttachmentView) => {
      setBusyId(a.id);
      setError(null);
      try {
        await restoreNeedAttachment(needId, a.id);
        if (timers.current[a.id]) {
          clearTimeout(timers.current[a.id]);
          delete timers.current[a.id];
        }
        setRemoved((prev) => prev.filter((r) => r.id !== a.id));
        setItems((prev) =>
          [a, ...prev].sort((x, y) => (x.created_at < y.created_at ? 1 : -1)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not restore the document.');
      } finally {
        setBusyId(null);
      }
    },
    [needId],
  );

  if (items.length === 0 && removed.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText weight="light" className="h-4 w-4 text-slate-500" aria-hidden />
          Supporting documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
        <ul className="divide-y divide-slate-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{a.file_name}</p>
                <p className="text-xs text-slate-500">
                  {new Date(a.created_at).toLocaleDateString()}
                  {a.size_bytes != null ? ` · ${formatBytes(a.size_bytes)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {a.download_url ? (
                  <a
                    href={a.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download weight="light" className="h-3.5 w-3.5" aria-hidden />
                    Download
                  </a>
                ) : null}
                {canRemove ? (
                  <button
                    type="button"
                    onClick={() => void handleRemove(a)}
                    disabled={busyId === a.id}
                    aria-label={`Remove ${a.file_name}`}
                    className="inline-flex items-center rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    {busyId === a.id ? (
                      <CircleNotch weight="light" className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash weight="light" className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {removed.map((a) => (
            <li
              key={`removed-${a.id}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0"
            >
              <p className="min-w-0 truncate text-sm text-slate-400">
                <span className="line-through">{a.file_name}</span> — removed
              </p>
              <button
                type="button"
                onClick={() => void handleUndo(a)}
                disabled={busyId === a.id}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--mp-teal)] hover:opacity-80 disabled:opacity-50"
              >
                {busyId === a.id ? (
                  <CircleNotch weight="light" className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ArrowsClockwise weight="light" className="h-3.5 w-3.5" aria-hidden />
                )}
                Undo
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
