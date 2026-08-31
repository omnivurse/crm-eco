'use client';

import { FileText } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';
import type { InboxDraft } from '@/lib/inbox/types';

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function previewText(draft: InboxDraft): string {
  const raw = draft.body_text || draft.body_html || '';
  return raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function recipientLabel(draft: InboxDraft): string {
  const first = draft.to_addresses?.[0];
  if (!first) return '(No recipient)';
  return first.name || first.email;
}

interface DraftsListProps {
  drafts: InboxDraft[];
  onSelectDraft: (draft: InboxDraft) => void;
  mobileView: 'list' | 'detail';
}

export function DraftsList({ drafts, onSelectDraft, mobileView }: DraftsListProps) {
  return (
    <div
      className={cn(
        'flex-1 lg:flex-none flex-shrink-0 glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col lg:w-80 xl:w-96',
        mobileView === 'detail' ? 'hidden lg:flex' : 'flex',
      )}
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drafts</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {drafts.length === 1 ? '1 saved draft' : `${drafts.length} saved drafts`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No drafts</p>
            <p className="text-xs text-center mt-1">
              Saved and scheduled messages will appear here
            </p>
          </div>
        ) : (
          drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => onSelectDraft(draft)}
              className="w-full text-left p-3 lg:p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {recipientLabel(draft)}
                </p>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {formatTime(draft.updated_at)}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 truncate mt-0.5">
                {draft.subject?.trim() || '(No subject)'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {previewText(draft) || 'Empty draft'}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
