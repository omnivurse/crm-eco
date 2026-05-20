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
import { cn } from '@crm-eco/ui/lib/utils';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
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
  const containerRef = useRef<HTMLSpanElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onEditEnd?.();
        void releaseFieldLock(field);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onEditEnd, releaseFieldLock, field]);

  const currentLabel =
    value && carriers.find((c) => c.id === value)?.name
      ? carriers.find((c) => c.id === value)!.name
      : value && !UUID_RE.test(value)
        ? String(value)
        : null;

  const openPicker = () => {
    if (readOnly || lockOwner) return;
    setOpen(true);
    onEditStart?.();
    void acquireFieldLock(field);
  };

  const pick = useCallback(
    async (id: string | null) => {
      setOpen(false);
      onEditEnd?.();
      void releaseFieldLock(field);
      await save(field, id, target ? { target } : undefined);
    },
    [save, field, target, onEditEnd, releaseFieldLock],
  );

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
        {currentLabel ? (
          <Badge variant="secondary" className="font-normal">
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
        'relative inline-flex items-center gap-1 rounded-md px-1 -mx-1',
        'hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors',
        state?.status === 'error' && 'ring-1 ring-rose-300',
        className,
      )}
      data-no-hotkeys
      data-field={field}
      title={state?.status === 'error' ? state.error : undefined}
    >
      <button
        type="button"
        onClick={openPicker}
        aria-label={ariaLabel ?? field}
        className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-200"
      >
        {currentLabel ? (
          <Badge variant="secondary" className="font-normal">
            {currentLabel}
          </Badge>
        ) : (
          <span className="text-slate-400 italic">{placeholder}</span>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>
      {value && !open ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void pick(null);
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
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[16rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1 max-h-72 overflow-y-auto">
          {!loaded ? (
            <div className="p-3 text-xs text-slate-500 text-center inline-flex items-center gap-1.5 justify-center w-full">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading {terms.pluralLower}…
            </div>
          ) : carriers.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              <div>No {terms.pluralLower} in your list yet.</div>
              <Link
                href="/crm/settings/my-carriers"
                className="mt-1 inline-flex items-center gap-1 text-teal-600 hover:underline"
              >
                Set up my {terms.pluralLower} <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            carriers.map((c) => (
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
            ))
          )}
        </div>
      ) : null}
    </span>
  );
});
