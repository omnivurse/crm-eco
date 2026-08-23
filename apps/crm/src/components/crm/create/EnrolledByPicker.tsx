'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SuggestPicker, type SuggestStatus } from './SuggestPicker';

/** One row of GET /api/crm/advisors (public.advisors, org-scoped). */
interface AdvisorRow {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  advisor_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/** What the picker commits: the display name plus the `public.advisors.id` (null = typed free text). */
export interface ProducerPick {
  name: string;
  id: string | null;
}

/** A row in the list: a producer from the store, or the explicit free-text escape. */
export interface ProducerOption extends ProducerPick {
  /** True for the "Not in list — add as typed" row (no id is written). */
  addAsTyped?: boolean;
}

function advisorLabel(row: AdvisorRow): string {
  const name = (row.name ?? row.full_name ?? row.advisor_name ?? '').trim();
  if (name) return name;
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
}

/** Debounce between the last keystroke and the producers fetch. */
export const ENROLLED_BY_SEARCH_DEBOUNCE_MS = 200;
export const ENROLLED_BY_ERROR_MESSAGE = "Couldn't load producers";
/** Label of the explicit free-text escape row (owner decision D5). */
export const ENROLLED_BY_ADD_AS_TYPED_LABEL = 'Not in list — add as typed';

export function producerOptionLabel(item: ProducerOption): string {
  return item.addAsTyped ? `${ENROLLED_BY_ADD_AS_TYPED_LABEL}: “${item.name}”` : item.name;
}

/**
 * Options shown for a settled search: the store's rows, plus — when something
 * is typed that no row matches exactly (case-insensitive) — the
 * "Not in list — add as typed" escape as the last row.
 */
export function producerOptionsFor(query: string, rows: readonly ProducerPick[]): ProducerOption[] {
  const out: ProducerOption[] = rows.map((r) => ({ name: r.name, id: r.id }));
  const q = query.trim();
  if (q && !rows.some((r) => r.name.toLowerCase() === q.toLowerCase())) {
    out.push({ name: q, id: null, addAsTyped: true });
  }
  return out;
}

/**
 * Producer / "Enrolled by" picker. Same keyboard + ARIA contract as
 * SuggestPicker (shared via useComboboxList). Fetches lazily: nothing is
 * requested until the field is focused, then each edit re-queries after a
 * 200 ms debounce (in-flight requests are aborted).
 *
 * Data source: GET /api/crm/advisors → public.advisors, org-scoped by
 * organization_id (profile + RLS). Committing a row calls `onChange(name)`
 * and `onSelect({ name, id })`; typing calls only `onChange`, so the host
 * can clear a previously picked id. The last row "Not in list — add as
 * typed" commits `{ name: <typed>, id: null }`.
 */
export function EnrolledByPicker({
  id,
  value,
  onChange,
  onSelect,
  className,
  placeholder,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  /** Fired when a row is committed (Enter / Tab / click) — the id is null for "add as typed". */
  onSelect?: (pick: ProducerPick) => void;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [touched, setTouched] = useState(false);
  /** Last settled fetch: which query it answered and what came back. */
  const [result, setResult] = useState<{ query: string; rows: ProducerPick[]; error: boolean } | null>(null);

  const query = value.trim();
  // Derived, not stored: anything typed since the last settled fetch is "loading"
  // (the debounced effect below will answer it), so no setState runs synchronously
  // inside the effect.
  const status: SuggestStatus =
    !touched ? 'idle' : result === null || result.query !== query ? 'loading' : result.error ? 'error' : 'idle';

  const options = useMemo<ProducerOption[]>(
    () => (result && !result.error && result.query === query ? producerOptionsFor(query, result.rows) : []),
    [result, query],
  );

  useEffect(() => {
    if (!touched) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ is_active: 'true', limit: '40' });
      if (query.length >= 1) params.set('search', query);
      fetch(`/api/crm/advisors?${params}`, { signal: ctrl.signal, credentials: 'same-origin' })
        .then((res) => {
          if (!res.ok) throw new Error(`advisors ${res.status}`);
          return res.json() as Promise<{ data?: AdvisorRow[] }>;
        })
        .then((body) => {
          const seen = new Set<string>();
          const rows: ProducerPick[] = [];
          for (const row of body.data ?? []) {
            const name = advisorLabel(row);
            if (!name) continue;
            const rowId = typeof row.id === 'string' && row.id ? row.id : null;
            const dedupeKey = rowId ?? name.toLowerCase();
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            rows.push({ name, id: rowId });
          }
          setResult({ query, rows, error: false });
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return;
          setResult({ query, rows: [], error: true });
        });
    }, ENROLLED_BY_SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, touched]);

  const commit = useCallback(
    (item: ProducerOption) => {
      onChange(item.name);
      onSelect?.({ name: item.name, id: item.id });
    },
    [onChange, onSelect],
  );

  return (
    <SuggestPicker<ProducerOption>
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      getLabel={producerOptionLabel}
      getKey={(item) => (item.addAsTyped ? '__add_as_typed__' : (item.id ?? `name:${item.name}`))}
      onSelect={commit}
      filter="none"
      status={status}
      loadingMessage="Searching…"
      emptyMessage="No match"
      errorMessage={ENROLLED_BY_ERROR_MESSAGE}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      onFocus={() => setTouched(true)}
    />
  );
}
