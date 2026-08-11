'use client';

/**
 * InlineLookupField — click-to-edit async lookup for `lookup` and `user`
 * field types. The stored value is a UUID; the display value is the
 * referenced record's title (or the user's name). Search is debounced
 * against `/api/crm/records?search=…` or `/api/crm/users?search=…`.
 *
 * Display labels are resolved once on mount (so the read view isn't just
 * a UUID) and cached module-level so multiple editors sharing the same
 * target don't duplicate fetches within a session.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  User,
  X,
} from 'lucide-react';
import {
  useRecordFieldSave,
  type FieldSaveTarget,
} from '@/hooks/useRecordFieldSave';
import {
  useRecordFieldLocks,
  useFieldLockOwner,
} from '@/hooks/useRecordFieldLocks';
import { LockedFieldBadge } from './LockedFieldBadge';
import { SearchMatchChips } from '@/components/crm/records/SearchMatchChips';
import { getRecordSearchMatches, type RecordSearchMatch } from '@/lib/crm/search-match';

export type InlineLookupKind = 'lookup' | 'user';

export interface InlineLookupFieldProps {
  field: string;
  value: string | null | undefined;
  /** 'lookup' searches crm_records, 'user' searches profiles. */
  kind: InlineLookupKind;
  /** For kind='lookup': target module key (field.options string). */
  targetModuleKey?: string | null;
  target?: FieldSaveTarget;
  readOnly?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

interface SearchItem {
  id: string;
  title: string;
  /** Colour-coded "matched field" chips (lookup records only). */
  matches?: RecordSearchMatch[];
}

// Resolve UUID → title for values we've already fetched. Keyed by
// `${kind}:${id}` so records + users share an address space safely.
const labelCache = new Map<string, string>();

async function resolveLabel(
  kind: InlineLookupKind,
  id: string,
): Promise<string | null> {
  const cacheKey = `${kind}:${id}`;
  const cached = labelCache.get(cacheKey);
  if (cached) return cached;
  try {
    if (kind === 'user') {
      const res = await fetch(`/api/crm/users?search=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const json = await res.json();
      const users = (json.users || json || []) as Array<{
        id: string;
        full_name?: string;
        email?: string;
      }>;
      const hit = users.find((u) => u.id === id);
      if (!hit) return null;
      const label = hit.full_name || hit.email || id;
      labelCache.set(cacheKey, label);
      return label;
    }
    const res = await fetch(`/api/crm/records/${id}`);
    if (!res.ok) return null;
    const rec = (await res.json()) as {
      id: string;
      title?: string | null;
      data?: { name?: string; email?: string } | null;
    };
    const label =
      rec.title || rec.data?.name || rec.data?.email || rec.id || id;
    labelCache.set(cacheKey, label);
    return label;
  } catch {
    return null;
  }
}

async function runSearch(
  kind: InlineLookupKind,
  q: string,
  moduleKey: string | null | undefined,
): Promise<SearchItem[]> {
  if (!q || q.length < 2) return [];
  try {
    const endpoint =
      kind === 'user'
        ? `/api/crm/users?search=${encodeURIComponent(q)}`
        : `/api/crm/records?search=${encodeURIComponent(q)}&page_size=10${
            moduleKey ? `&module_key=${encodeURIComponent(moduleKey)}` : ''
          }`;
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const json = await res.json();
    if (kind === 'user') {
      const users = (json.users || json || []) as Array<{
        id: string;
        full_name?: string;
        email?: string;
      }>;
      return users.map((u) => ({
        id: u.id,
        title: u.full_name || u.email || u.id,
      }));
    }
    const records = (json.records || []) as Array<{
      id: string;
      title?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
      data?: Record<string, unknown> | null;
    }>;
    return records.map((r) => ({
      id: r.id,
      title:
        r.title ||
        (r.data?.name as string | undefined) ||
        (r.data?.email as string | undefined) ||
        r.id,
      matches: getRecordSearchMatches(
        { title: r.title, email: r.email, phone: r.phone, status: r.status, data: r.data },
        q,
        { maxMatches: 2 },
      ),
    }));
  } catch {
    return [];
  }
}

export const InlineLookupField = memo(function InlineLookupField({
  field,
  value,
  kind,
  targetModuleKey,
  target,
  readOnly,
  placeholder = 'Search…',
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineLookupFieldProps) {
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);

  const [label, setLabel] = useState<string | null>(
    value ? labelCache.get(`${kind}:${value}`) ?? null : null,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve a stale label whenever the UUID changes. Route both the empty and
  // resolved cases through the same async continuation so we never call setState
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    let cancelled = false;
    const pending = value ? resolveLabel(kind, value) : Promise.resolve(null);
    void pending.then((l) => {
      if (cancelled) return;
      setLabel(value ? l ?? value : null);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setResults([]);
        onEditEnd?.();
        void releaseFieldLock(field);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onEditEnd, releaseFieldLock, field]);

  const handleQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const items = await runSearch(kind, q, targetModuleKey);
      setResults(items);
      setLoading(false);
    }, 250);
  };

  const openPicker = () => {
    if (readOnly || lockOwner) return;
    setOpen(true);
    setQuery('');
    setResults([]);
    onEditStart?.();
    void acquireFieldLock(field);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const pick = useCallback(
    async (item: SearchItem) => {
      labelCache.set(`${kind}:${item.id}`, item.title);
      setLabel(item.title);
      setOpen(false);
      setQuery('');
      setResults([]);
      onEditEnd?.();
      void releaseFieldLock(field);
      await save(field, item.id, target ? { target } : undefined);
    },
    [save, field, target, kind, onEditEnd, releaseFieldLock],
  );

  const clear = useCallback(async () => {
    setLabel(null);
    setOpen(false);
    onEditEnd?.();
    void releaseFieldLock(field);
    await save(field, null, target ? { target } : undefined);
  }, [save, field, target, onEditEnd, releaseFieldLock]);

  const displayIcon = kind === 'user' ? <User className="w-3.5 h-3.5 text-slate-400" /> : null;

  if (readOnly || lockOwner) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5', className)}
        data-field={field}
        title={
          lockOwner
            ? `${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`
            : undefined
        }
      >
        {displayIcon}
        {label ? (
          <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
        ) : value ? (
          <span className="text-sm text-slate-500">{String(value).slice(0, 8)}…</span>
        ) : (
          <span className="text-sm text-slate-400 italic">{placeholder}</span>
        )}
        {lockOwner ? <LockedFieldBadge owner={lockOwner} /> : null}
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      className={cn(
        'relative z-10 flex w-full min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        open && 'z-30',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
    >
      {displayIcon}
      <button
        type="button"
        onClick={openPicker}
        className="group flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-700 dark:text-slate-200"
      >
        {label ? (
          <span className="min-w-0 flex-1 truncate">{label}</span>
        ) : value ? (
          <span className="min-w-0 flex-1 truncate text-slate-500">
            {String(value).slice(0, 8)}…
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-slate-400 italic">
            {placeholder}
          </span>
        )}
        <ChevronDown className="w-3 h-3 shrink-0 text-slate-400" />
        <Pencil className="w-3 h-3 shrink-0 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {value && !open ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void clear();
          }}
          className="inline-flex items-center justify-center rounded-sm text-slate-400 hover:text-rose-500"
          aria-label="Clear"
        >
          <X className="w-3 h-3" />
        </button>
      ) : null}

      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="w-3 h-3 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[18rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={handleQuery}
              placeholder={`Search ${ariaLabel ?? field}…`}
              aria-label={ariaLabel ?? field}
              className="w-full px-2 py-1 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {query.length < 2 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                Type 2+ characters to search
              </div>
            ) : loading ? (
              <div className="p-3 text-xs text-slate-500 text-center inline-flex items-center gap-1.5 justify-center w-full">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">
                No results
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void pick(item)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-sm text-left',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    value === item.id && 'text-teal-700 dark:text-teal-300',
                  )}
                >
                  <span className="font-medium truncate w-full">{item.title}</span>
                  {item.matches && item.matches.length > 0 ? (
                    <SearchMatchChips matches={item.matches} className="mt-0.5" />
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      {item.id.slice(0, 8)}…
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </span>
  );
});
