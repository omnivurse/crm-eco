'use client';

/**
 * AdvisorCarrierField — searchable carrier picker used by `DynamicRecordForm`.
 *
 * Behavior:
 *   1. Search input filters the advisor's personal carrier list
 *      (`crm_advisor_carriers`) for the requested `carrier_type`.
 *   2. When the query has 2+ chars, we also probe the org-wide
 *      `insurance_carriers` directory and surface matches that aren't in the
 *      advisor's list yet, with a one-click "Add to my list" action.
 *   3. If the typed query doesn't exactly match any carrier, a "Use \"VSP\"
 *      as text" option commits the raw text as the field value. This is the
 *      escape hatch so a user is never blocked because their carrier isn't
 *      in the catalog yet.
 *   4. A persistent "Manage my carriers" link points to settings.
 *
 * Stored value: either a carrier UUID (preferred) or a free-text string
 * (legacy / opt-in). Both flow into FormData.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import { cn } from '@crm-eco/ui/lib/utils';
import type {
  AdvisorCarrierWithCarrier,
  CrmField,
  FieldCarrierType,
  InsuranceCarrier,
} from '@/lib/crm/types';
import { getCarrierTerms } from '@/components/crm/records/section-utils';

interface AdvisorCarrierFieldProps {
  field: CrmField;
  value: string | undefined;
  onChange: (val: string) => void;
  error?: boolean;
}

interface PersonalEntry {
  id: string;
  name: string;
}

interface DirectoryEntry {
  id: string;
  name: string;
  type: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: string): boolean => UUID_RE.test(v);

/** Module-level cache of personal carriers per type so multiple pickers share one fetch. */
const personalCache = new Map<string, PersonalEntry[]>();
const personalInFlight = new Map<string, Promise<PersonalEntry[]>>();

function loadPersonalCarriers(
  carrierType: FieldCarrierType,
): Promise<PersonalEntry[]> {
  const hit = personalCache.get(carrierType);
  if (hit) return Promise.resolve(hit);
  const pending = personalInFlight.get(carrierType);
  if (pending) return pending;

  const p = fetch(
    `/api/crm/advisor-carriers?carrier_type=${encodeURIComponent(carrierType)}`,
  )
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json: { data?: AdvisorCarrierWithCarrier[] }) => {
      const list: PersonalEntry[] = [];
      for (const row of json.data || []) {
        const name = row.carrier?.carrier_name;
        if (name) list.push({ id: row.carrier_id, name });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      personalCache.set(carrierType, list);
      personalInFlight.delete(carrierType);
      return list;
    })
    .catch((err) => {
      console.warn('[AdvisorCarrierField] personal load failed', err);
      personalInFlight.delete(carrierType);
      return [];
    });

  personalInFlight.set(carrierType, p);
  return p;
}

/** Bust the personal-carriers cache after we add one inline so the new entry shows up everywhere. */
function bustPersonalCache(carrierType: FieldCarrierType): void {
  personalCache.delete(carrierType);
  personalInFlight.delete(carrierType);
}

async function searchOrgDirectory(
  carrierType: FieldCarrierType,
  query: string,
  signal: AbortSignal,
): Promise<DirectoryEntry[]> {
  const url = `/api/crm/carriers?carrier_type=${encodeURIComponent(
    carrierType,
  )}&search=${encodeURIComponent(query)}&limit=10`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: { data?: InsuranceCarrier[] } = await res.json();
  return (json.data || []).map((c) => ({
    id: c.id,
    name: c.carrier_name,
    type: c.carrier_type ?? null,
  }));
}

async function addCarrierToMyList(carrierId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/crm/advisor-carriers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ carrier_id: carrierId }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[AdvisorCarrierField] add to my list failed', err);
    return false;
  }
}

export function AdvisorCarrierField({
  field,
  value,
  onChange,
  error,
}: AdvisorCarrierFieldProps) {
  const carrierType = field.metadata?.carrier_type as
    | FieldCarrierType
    | undefined;
  const terms = getCarrierTerms(carrierType);

  const [personal, setPersonal] = useState<PersonalEntry[]>(
    carrierType ? personalCache.get(carrierType) ?? [] : [],
  );
  const [personalLoaded, setPersonalLoaded] = useState<boolean>(
    carrierType ? personalCache.has(carrierType) : true,
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial load of the personal list for this carrier type.
  useEffect(() => {
    if (!carrierType || personalLoaded) return;
    let cancelled = false;
    void loadPersonalCarriers(carrierType).then((list) => {
      if (cancelled) return;
      setPersonal(list);
      setPersonalLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [carrierType, personalLoaded]);

  // Debounced org-directory search whenever the query changes.
  useEffect(() => {
    if (!carrierType || !open) return;
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
          if ((err as Error)?.name !== 'AbortError') {
            console.warn('[AdvisorCarrierField] directory search failed', err);
            setDirectory([]);
          }
        })
        .finally(() => setDirectoryLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [carrierType, open, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Display label for the current value (UUID → name lookup, otherwise raw text).
  const currentLabel = useMemo<string | null>(() => {
    if (!value) return null;
    if (isUuid(value)) {
      const hit = personal.find((c) => c.id === value);
      return hit ? hit.name : null;
    }
    return value;
  }, [personal, value]);

  const personalMatches = useMemo<PersonalEntry[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return personal;
    return personal.filter((c) => c.name.toLowerCase().includes(trimmed));
  }, [personal, query]);

  const personalIds = useMemo(
    () => new Set(personal.map((p) => p.id)),
    [personal],
  );

  // Directory entries to surface as "addable" — exclude carriers already in
  // the personal list (they're shown above) and exclude exact-name dupes.
  const directorySuggestions = useMemo<DirectoryEntry[]>(() => {
    const personalNames = new Set(
      personal.map((p) => p.name.trim().toLowerCase()),
    );
    return directory.filter(
      (d) =>
        !personalIds.has(d.id) &&
        !personalNames.has(d.name.trim().toLowerCase()),
    );
  }, [directory, personal, personalIds]);

  const trimmedQuery = query.trim();

  // Show the free-text "Use 'X'" option when the user typed something that
  // isn't an exact case-insensitive match of an entry already on screen.
  const showFreeTextFallback = useMemo<boolean>(() => {
    if (!trimmedQuery) return false;
    const lower = trimmedQuery.toLowerCase();
    if (personalMatches.some((c) => c.name.toLowerCase() === lower)) return false;
    if (directorySuggestions.some((c) => c.name.toLowerCase() === lower)) {
      return false;
    }
    return true;
  }, [directorySuggestions, personalMatches, trimmedQuery]);

  const openPicker = useCallback(() => {
    setOpen(true);
    // Pre-populate the search with any free-text current value so the user
    // can edit / refine it instead of starting from scratch.
    if (value && !isUuid(value)) {
      setQuery(value);
    } else {
      setQuery('');
    }
    queueMicrotask(() => inputRef.current?.focus());
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const commit = useCallback(
    (next: string) => {
      onChange(next);
      close();
    },
    [close, onChange],
  );

  const handleAddToMyList = useCallback(
    async (carrier: DirectoryEntry) => {
      if (!carrierType) return;
      setAdding(carrier.id);
      const ok = await addCarrierToMyList(carrier.id);
      setAdding(null);
      if (!ok) return;
      bustPersonalCache(carrierType);
      const list = await loadPersonalCarriers(carrierType);
      setPersonal(list);
      setPersonalLoaded(true);
      commit(carrier.id);
    },
    [carrierType, commit],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange],
  );

  // Carrier-type missing → fall back to a plain text input so we never crash
  // a form just because metadata is incomplete.
  if (!carrierType) {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        className={cn(error && 'border-destructive')}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input so the value is included in native <form> submissions
          (the parent uses Next server actions which read FormData). */}
      <input
        type="hidden"
        name={field.key}
        value={value ?? ''}
        {...(field.required && { required: true })}
      />

      {/* Trigger */}
      <button
        type="button"
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm',
          'border-input hover:border-slate-300 dark:hover:border-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/40',
          error && 'border-destructive',
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {currentLabel ? (
            <Badge variant="secondary" className="font-normal">
              {currentLabel}
              {value && !isUuid(value) && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  custom
                </span>
              )}
            </Badge>
          ) : (
            <span className="text-muted-foreground">
              Select {field.label.toLowerCase()}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="rounded p-0.5 hover:text-rose-500 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {/* Search input */}
          <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/60">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Enter commits in priority order: exact personal match →
                  // exact directory match → free text.
                  const lower = trimmedQuery.toLowerCase();
                  const exactPersonal = personalMatches.find(
                    (c) => c.name.toLowerCase() === lower,
                  );
                  if (exactPersonal) {
                    commit(exactPersonal.id);
                    return;
                  }
                  const exactDir = directorySuggestions.find(
                    (c) => c.name.toLowerCase() === lower,
                  );
                  if (exactDir) {
                    void handleAddToMyList(exactDir);
                    return;
                  }
                  if (trimmedQuery) commit(trimmedQuery);
                }
              }}
              placeholder={`Search ${terms.pluralLower}…`}
              className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
            {(directoryLoading || !personalLoaded) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            )}
          </div>

          {/* Personal list */}
          {!personalLoaded ? (
            <div className="p-3 text-center text-xs text-slate-500">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Loading your carriers…
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
                  onClick={() => commit(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800',
                    value === c.id && 'text-teal-700 dark:text-teal-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 items-center justify-center rounded-full border',
                      value === c.id
                        ? 'border-teal-500 bg-teal-500 text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {value === c.id && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          ) : personal.length === 0 ? (
            <div className="px-2 pb-1 pt-0.5 text-[11px] text-slate-500">
              No {terms.pluralLower} in your list yet.
            </div>
          ) : (
            <div className="px-2 pb-1 pt-0.5 text-[11px] text-slate-500">
              No {terms.pluralLower} in your list match "{trimmedQuery}".
            </div>
          )}

          {/* Org directory results */}
          {trimmedQuery.length >= 2 && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                From organization directory
              </div>
              {directoryLoading && directorySuggestions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-slate-500">
                  Searching…
                </div>
              ) : directorySuggestions.length === 0 ? (
                <div className="px-2 py-1 text-xs text-slate-500">
                  No directory matches.
                </div>
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

          {/* Free-text fallback */}
          {showFreeTextFallback && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <button
                type="button"
                onClick={() => commit(trimmedQuery)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Type className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Use "<span className="font-medium">{trimmedQuery}</span>" as
                  text
                </span>
              </button>
              <p className="px-2 pb-1 text-[10px] text-slate-400">
                Saves the typed text for now. You can ask an admin to add it to
                the catalog later.
              </p>
            </div>
          )}

          {/* Footer — manage list link */}
          <div className="mt-1 border-t border-slate-100 px-2 py-1.5 dark:border-slate-800">
            <Link
              href="/crm/settings/my-carriers"
              className="inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline dark:text-teal-400"
              onClick={close}
            >
              <Sparkles className="h-3 w-3" />
              Manage my {terms.pluralLower}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Validation hint */}
      {error && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Please pick or enter a value.
        </p>
      )}
    </div>
  );
}

export default AdvisorCarrierField;
