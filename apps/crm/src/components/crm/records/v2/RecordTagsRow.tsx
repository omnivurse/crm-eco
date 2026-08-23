'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { X, Plus, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';
import { queuedSend } from '@/lib/offline/queued-send';
import { toastCopy } from '@/lib/crm/toast-copy';

export interface RecordTagsRowProps {
  recordId: string;
  /** Full record.data object — tags live at `data.tags` (string[]). */
  recordData: Record<string, unknown> | null | undefined;
  /** Parent may disable editing for viewers or converted leads. */
  readOnly?: boolean;
  className?: string;
  onChange?: (tags: string[]) => void;
}

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

function readTags(data: Record<string, unknown> | null | undefined): string[] {
  const raw = data?.tags;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Inline tag chips displayed under the record title, matching Zoho's
 * "Add Tags" control. Tags are stored in `crm_records.data.tags` as a
 * string[] — additive, no schema change required.
 */
export function RecordTagsRow({
  recordId,
  recordData,
  readOnly,
  className,
  onChange,
}: RecordTagsRowProps) {
  const [tags, setTags] = useState<string[]>(() => readTags(recordData));
  const [inputOpen, setInputOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  /** FB-6: inline validation message shown beside the tag input. */
  const [tagError, setTagError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local state synced if the parent re-renders with a fresh record.
  useEffect(() => {
    setTags(readTags(recordData));
  }, [recordData]);

  useEffect(() => {
    if (inputOpen) inputRef.current?.focus();
  }, [inputOpen]);

  const persist = useCallback(
    async (next: string[], previous: string[]) => {
      setSaving(true);
      const result = await queuedSend({
        method: 'PATCH',
        url: `/api/crm/records/${recordId}`,
        // DATA SAFETY: single-key patch — never spread `recordData` back into
        // the body (it may carry read-time twin/projection enrichment). The
        // server merges JSONB (record-patch-service.ts).
        body: { data: { tags: next } },
        queue: {
          label: 'Update tags',
          // Collapse rapid tag toggles into one queued mutation — the
          // final tag array is last-write-wins.
          dedupeKey: `record:${recordId}:tags`,
          recordId,
        },
      });
      setSaving(false);

      if (result.ok) {
        onChange?.(next);
        return;
      }
      if (result.queued) {
        // Keep the optimistic state — the topbar pill surfaces the
        // pending sync. Parent gets the new tags so the rest of the
        // page stays consistent.
        onChange?.(next);
        const q = toastCopy.queued('tags');
        toast.info(q.title, { description: q.description });
        return;
      }
      // Terminal server error — rollback.
      setTags(previous);
      toast.error(toastCopy.failed('save the tags', result.error, 'Try again'));
    },
    [recordId, onChange],
  );

  const addTag = useCallback(
    (value: string) => {
      const normalized = value.trim().replace(/\s+/g, ' ');
      if (!normalized) return;
      // FB-6: inline validation (role=alert beside the input), not a toast.
      if (normalized.length > MAX_TAG_LENGTH) {
        setTagError(`Tags must be ${MAX_TAG_LENGTH} characters or fewer`);
        return;
      }
      if (tags.length >= MAX_TAGS) {
        setTagError(`You can add up to ${MAX_TAGS} tags per record`);
        return;
      }
      setTagError(null);
      if (tags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
        setDraft('');
        return;
      }
      const previous = tags;
      const next = [...tags, normalized];
      setTags(next);
      setDraft('');
      void persist(next, previous);
    },
    [tags, persist],
  );

  const removeTag = useCallback(
    (value: string) => {
      const previous = tags;
      const next = tags.filter((t) => t !== value);
      setTags(next);
      void persist(next, previous);
    },
    [tags, persist],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputOpen(false);
      setDraft('');
    }
  };

  return (
    <div className={cn('flex items-center flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10"
        >
          <Tag className="w-3 h-3 text-slate-400" />
          {tag}
          {!readOnly && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}

      {!readOnly && inputOpen && (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (tagError) setTagError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft);
            } else {
              setInputOpen(false);
              setTagError(null);
            }
          }}
          maxLength={MAX_TAG_LENGTH}
          aria-invalid={tagError ? true : undefined}
          aria-describedby={tagError ? 'crm-record-tag-help' : undefined}
          placeholder="Tag name, Enter to save"
          className="h-6 px-2 rounded-full text-xs bg-white dark:bg-slate-900 border border-teal-400 dark:border-teal-500 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/30 min-w-[140px]"
        />
      )}

      {!readOnly && inputOpen && tagError && (
        <span id="crm-record-tag-help" role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {tagError}
        </span>
      )}

      {!readOnly && !inputOpen && (
        <button
          type="button"
          onClick={() => setInputOpen(true)}
          data-testid="crm-record-add-tags"
          className={cn(
            'inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 border border-dashed border-slate-300 dark:border-white/10',
            // RP-5 / D6c: on a tagless record the dashed pill is on demand —
            // invisible at rest, shown when the identity block (`group/identity`
            // on the record header) is hovered / focused-within or the pill
            // itself has focus. Still in the tab order and still tappable
            // (opacity does not block pointer events).
            tags.length === 0 &&
              'opacity-0 transition-opacity focus-visible:opacity-100 focus:opacity-100 group-hover/identity:opacity-100 group-focus-within/identity:opacity-100',
          )}
        >
          <Plus className="w-3 h-3" />
          {tags.length === 0 ? 'Add Tags' : 'Add'}
        </button>
      )}

      {saving && <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-1" />}
    </div>
  );
}
