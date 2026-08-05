'use client';

/**
 * InlineCarrierField — click-to-edit carrier picker backed by the
 * current advisor's personal list (`crm_advisor_carriers`). Stored value
 * is the carrier UUID; display resolves to `carrier_name`.
 *
 * A module-level cache (keyed by carrier_type) holds the fetched list
 * for the session so multiple editors on the same page share one load.
 * When the advisor has no carriers of the requested type, the editor
 * falls back to a free-text input and links to the settings page.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Type,
  X,
} from 'lucide-react';
import type { FieldCarrierType } from '@/lib/crm/types';
import { getCarrierTerms } from '@/components/crm/records/section-utils';
import {
  useRecordFieldSave,
  type FieldSaveTarget,
} from '@/hooks/useRecordFieldSave';
import {
  useRecordFieldLocks,
  useFieldLockOwner,
} from '@/hooks/useRecordFieldLocks';
import { LockedFieldBadge } from './LockedFieldBadge';

interface AdvisorCarrier {
  carrier_id: string;
  carrier?: { id: string; carrier_name: string } | null;
}

interface CarrierListEntry {
  id: string;
  name: string;
}

interface DirectoryEntry {
  id: string;
  name: string;
}

// Session cache: carrier_type -> list of { id, name }. Separate from the
// FieldRenderer cache so this component can be swapped in without
// changing FieldRenderer's ownership. Keeps things loosely coupled.
const listCache = new Map<string, CarrierListEntry[]>();
const inFlight = new Map<string, Promise<CarrierListEntry[]>>();

function loadCarriers(carrierType: string): Promise<CarrierListEntry[]> {
  const hit = listCache.get(carrierType);
  if (hit) return Promise.resolve(hit);
  const pending = inFlight.get(carrierType);
  if (pending) return pending;

  const p = fetch(
    `/api/crm/advisor-carriers?carrier_type=${encodeURIComponent(carrierType)}`,
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json: { data?: AdvisorCarrier[] }) => {
      const list: CarrierListEntry[] = [];
      for (const row of json.data || []) {
        const name = row.carrier?.carrier_name;
        if (name) list.push({ id: row.carrier_id, name });
      }
      return list;
    })
    .then(async (list) => {
      // If the advisor has carriers in their personal list, use that.
      // Otherwise fall back to the full org directory so users who
      // haven't curated a personal list can still pick carriers.
      if (list.length > 0) {
        list.sort((a, b) => a.name.localeCompare(b.name));
        listCache.set(carrierType, list);
        return list;
      }
      // Fallback: org-wide directory
      const res = await fetch(
        `/api/crm/carriers?carrier_type=${encodeURIComponent(carrierType)}&limit=500`,
      );
      if (!res.ok) return [];
      const json = (await res.json()) as {
        data?: { id: string; carrier_name: string }[];
      };
      const orgList: CarrierListEntry[] = (json.data || []).map((c) => ({
        id: c.id,
        name: c.carrier_name,
      }));
      orgList.sort((a, b) => a.name.localeCompare(b.name));
      listCache.set(carrierType, orgList);
      return orgList;
    })
    .catch((err) => {
      console.warn('[InlineCarrierField] load failed', err);
      return [];
    })
    .finally(() => {
      inFlight.delete(carrierType);
    });

  inFlight.set(carrierType, p);
  return p;
}

/** Drop the cached personal list so a freshly-added carrier shows up. */
function bustListCache(carrierType: string): void {
  listCache.delete(carrierType);
  inFlight.delete(carrierType);
}

/** Search the org-wide carrier directory (carriers not yet in the personal list). */
async function searchOrgDirectory(
  carrierType: string,
  query: string,
  signal: AbortSignal,
): Promise<DirectoryEntry[]> {
  const url = `/api/crm/carriers?carrier_type=${encodeURIComponent(
    carrierType,
  )}&search=${encodeURIComponent(query)}&limit=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { id: string; carrier_name: string }[];
  };
  return (json.data || []).map((c) => ({ id: c.id, name: c.carrier_name }));
}

/** Add an org-directory carrier to the current advisor's personal list. */
async function addCarrierToMyList(carrierId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/crm/advisor-carriers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ carrier_id: carrierId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Session cache: carrier UUID -> name, resolved via the org directory by id.
// Separate from `listCache` (keyed by carrier_type) so a single stored id can be
// named even when it is absent from the advisor's personal list.
const idNameCache = new Map<string, string>();

/**
 * Resolve a single carrier UUID to its display name via the org directory.
 * Mirrors `FieldRenderer.lookupCarrierById`: used when a stored `carrier_id`
 * is NOT in the advisor's personal list (legacy import, or a ministry curated
 * by another advisor) so the field shows e.g. "Sedera HealthShare" instead of
 * a truncated UUID or an empty placeholder.
 */
async function lookupCarrierNameById(id: string): Promise<string | undefined> {
  const cached = idNameCache.get(id);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/crm/carriers/${encodeURIComponent(id)}`);
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      data?: { carrier_name?: string } | null;
      carrier_name?: string;
    };
    const name = json.data?.carrier_name ?? json.carrier_name;
    if (!name) return undefined;
    idNameCache.set(id, name);
    return name;
  } catch {
    return undefined;
  }
}

export interface InlineCarrierFieldProps {
  field: string;
  value: string | null | undefined;
  carrierType: FieldCarrierType;
  target?: FieldSaveTarget;
  readOnly?: boolean;
  placeholder?: string;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  ariaLabel?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const InlineCarrierField = memo(function InlineCarrierField({
  field,
  value,
  carrierType,
  target,
  readOnly,
  placeholder: placeholderOverride,
  onEditStart,
  onEditEnd,
  className,
  ariaLabel,
}: InlineCarrierFieldProps) {
  const pathname = usePathname();
  const terms = getCarrierTerms(carrierType);
  const placeholder = placeholderOverride ?? `Select ${terms.singularLower}`;
  const { save, fields } = useRecordFieldSave();
  const state = fields[field];
  const { acquireFieldLock, releaseFieldLock } = useRecordFieldLocks();
  const lockOwner = useFieldLockOwner(field);

  const [carriers, setCarriers] = useState<CarrierListEntry[]>(
    listCache.get(carrierType) ?? [],
  );
  const [loaded, setLoaded] = useState<boolean>(listCache.has(carrierType));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | undefined>(
    value && UUID_RE.test(value) ? idNameCache.get(value) : undefined,
  );
  const containerRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    void loadCarriers(carrierType).then((list) => {
      if (cancelled) return;
      setCarriers(list);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [carrierType, loaded]);

  // Resolve a stored carrier UUID that is absent from the advisor's list to its
  // name via the org directory, so a legacy / other-advisor ministry (e.g. a
  // Sedera carrier_id on a HealthShare contact) shows "Sedera HealthShare"
  // instead of a truncated UUID or a blank rail. Route every branch through the
  // async continuation so we never call setState synchronously in the effect
  // body (react-hooks/set-state-in-effect); same pattern as InlineLookupField.
  useEffect(() => {
    let cancelled = false;
    const needsLookup = Boolean(
      value && UUID_RE.test(value) && !carriers.some((c) => c.id === value),
    );
    const pending: Promise<string | undefined> = needsLookup
      ? lookupCarrierNameById(value as string)
      : Promise.resolve(undefined);
    void pending.then((name) => {
      if (cancelled) return;
      setResolvedName(needsLookup ? name : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [value, carriers]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery('');
    setDirectory([]);
    onEditEnd?.();
    void releaseFieldLock(field);
  }, [onEditEnd, releaseFieldLock, field]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closePicker]);

  // Debounced org-directory search whenever the query changes (2+ chars).
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setDirectory([]);
      setDirectoryLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setDirectoryLoading(true);
      searchOrgDirectory(carrierType, trimmed, ctrl.signal)
        .then((rows) => setDirectory(rows))
        .catch((err) => {
          if ((err as Error)?.name !== 'AbortError') setDirectory([]);
        })
        .finally(() => setDirectoryLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [carrierType, open, query]);

  const currentLabel =
    value && carriers.find((c) => c.id === value)?.name
      ? carriers.find((c) => c.id === value)!.name
      : value && !UUID_RE.test(value)
        ? String(value)
        : // Stored UUID not in the advisor list — use the org-directory name.
          resolvedName ?? null;

  const openPicker = () => {
    if (readOnly || lockOwner) return;
    setOpen(true);
    // Prefill the search with any free-text value so the rep can refine it.
    setQuery(value && !UUID_RE.test(value) ? String(value) : '');
    onEditStart?.();
    void acquireFieldLock(field);
    queueMicrotask(() => inputRef.current?.focus());
  };

  const pick = useCallback(
    async (id: string | null) => {
      closePicker();
      await save(field, id, target ? { target } : undefined);
    },
    [save, field, target, closePicker],
  );

  const handleAddToMyList = useCallback(
    async (carrier: DirectoryEntry) => {
      setAdding(carrier.id);
      const ok = await addCarrierToMyList(carrier.id);
      setAdding(null);
      if (!ok) {
        // Still let the rep proceed by storing the name as text.
        void pick(carrier.name);
        return;
      }
      bustListCache(carrierType);
      const list = await loadCarriers(carrierType);
      setCarriers(list);
      setLoaded(true);
      void pick(carrier.id);
    },
    [carrierType, pick],
  );

  const trimmedQuery = query.trim();
  const personalMatches = trimmedQuery
    ? carriers.filter((c) =>
        c.name.toLowerCase().includes(trimmedQuery.toLowerCase()),
      )
    : carriers;
  const personalIds = new Set(carriers.map((c) => c.id));
  const personalNames = new Set(carriers.map((c) => c.name.trim().toLowerCase()));
  const directorySuggestions = directory.filter(
    (d) =>
      !personalIds.has(d.id) && !personalNames.has(d.name.trim().toLowerCase()),
  );
  const showFreeTextFallback =
    trimmedQuery.length > 0 &&
    !personalMatches.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase()) &&
    !directorySuggestions.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());

  if (readOnly || lockOwner) {
    return (
      <span
        className={cn('inline-flex max-w-full min-w-0 items-center gap-1.5', className)}
        data-field={field}
        title={
          lockOwner
            ? `${lockOwner.fullName || lockOwner.email || 'Someone'} is editing this field`
            : currentLabel || undefined
        }
      >
        {currentLabel ? (
          <Badge variant="secondary" className="max-w-full min-w-0 truncate font-normal">
            {currentLabel}
          </Badge>
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
        'relative flex w-full min-w-0 max-w-full items-center gap-1 rounded-md px-1 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : currentLabel || undefined}
    >
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel ?? field}
        className="inline-flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-700 dark:text-slate-200"
      >
        {currentLabel ? (
          <Badge variant="secondary" className="min-w-0 flex-1 truncate font-normal">
            {currentLabel}
          </Badge>
        ) : (
          <span className="truncate text-slate-400 italic">{placeholder}</span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
      </button>
      {value && !open ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void pick(null);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-sm text-slate-400 hover:text-rose-500"
          aria-label="Clear"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}

      {state?.status === 'saving' || state?.status === 'pending' ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-teal-500" />
      ) : state?.status === 'error' ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500" />
      ) : state?.status === 'saved' ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : null}

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[18rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 max-h-80 overflow-y-auto">
          {/* Search / type a new carrier */}
          <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closePicker();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const lower = trimmedQuery.toLowerCase();
                  const exactPersonal = personalMatches.find(
                    (c) => c.name.toLowerCase() === lower,
                  );
                  if (exactPersonal) return void pick(exactPersonal.id);
                  const exactDir = directorySuggestions.find(
                    (c) => c.name.toLowerCase() === lower,
                  );
                  if (exactDir) return void handleAddToMyList(exactDir);
                  if (trimmedQuery) void pick(trimmedQuery);
                }
              }}
              placeholder={`Search or add ${terms.singularLower}…`}
              className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
            {(directoryLoading || !loaded) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            )}
          </div>

          {/* Personal / directory list */}
          {!loaded ? (
            <div className="p-3 text-xs text-slate-500 text-center inline-flex items-center gap-1.5 justify-center w-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading {terms.pluralLower}…
            </div>
          ) : personalMatches.length > 0 ? (
            <div>
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                My {terms.pluralLower}
              </div>
              {personalMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void pick(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left',
                    'hover:bg-slate-100 dark:hover:bg-slate-800',
                    value === c.id && 'text-teal-700 dark:text-teal-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 items-center justify-center rounded-full border',
                      value === c.id
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {value === c.id ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          ) : carriers.length === 0 && !trimmedQuery ? (
            <div className="px-2 pb-1 pt-0.5 text-[11px] text-slate-500">
              No {terms.pluralLower} in your list yet — type a name below to add one.
            </div>
          ) : (
            <div className="px-2 pb-1 pt-0.5 text-[11px] text-slate-500">
              No {terms.pluralLower} in your list match &quot;{trimmedQuery}&quot;.
            </div>
          )}

          {/* Org directory results — carriers not yet in the personal list */}
          {trimmedQuery.length >= 2 && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                From organization directory
              </div>
              {directoryLoading && directorySuggestions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-slate-500">Searching…</div>
              ) : directorySuggestions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-slate-500">No directory matches.</div>
              ) : (
                directorySuggestions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="truncate">{c.name}</span>
                    <button
                      type="button"
                      disabled={adding === c.id}
                      onClick={() => void handleAddToMyList(c)}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700/40 dark:bg-teal-500/10 dark:text-teal-300"
                    >
                      {adding === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add &amp; select
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Free-text fallback — enter a brand-new carrier like "Elevate" */}
          {showFreeTextFallback && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void pick(trimmedQuery)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Type className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Use &quot;<span className="font-medium">{trimmedQuery}</span>&quot; as text
                </span>
              </button>
            </div>
          )}

          {/* Footer — manage list link */}
          <div className="mt-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
            <Link
              href={`/crm/settings/my-carriers${pathname ? `?returnTo=${encodeURIComponent(pathname)}` : ''}`}
              className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline dark:text-teal-400"
              onClick={closePicker}
            >
              Manage my {terms.pluralLower} <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </span>
  );
});
