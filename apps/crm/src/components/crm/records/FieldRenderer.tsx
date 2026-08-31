'use client';

import { memo, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CrmField } from '@/lib/crm/types';
import { formatPhoneOwnerLabel } from '@/lib/crm/phone-owner';
import { describeRecordedAge } from '@/lib/crm/household-age';
import {
  isCarrierIdentityField,
  resolveInlineCarrierType,
} from '@/lib/crm/carrier-field';
import { Mail, Phone, ExternalLink, Check, X, Copy } from 'lucide-react';
import DOMPurify from 'dompurify';
import { fieldOffersOptionChoices, labelForFieldOption } from '@/lib/crm/utils';

// Parse a value into a Date for display. Date-only strings (YYYY-MM-DD) are
// constructed in local time so they render as the same calendar day in every
// timezone — `new Date('2025-11-01')` would otherwise be parsed as UTC midnight
// and shown as Oct 31 in any UTC- zone.
function parseFieldDate(raw: unknown): Date {
  const s = String(raw);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

// ---------------------------------------------------------------------------
// Carrier-name resolution
// ---------------------------------------------------------------------------
// For carrier-typed fields, the underlying value is a UUID (carrier_id). The
// detail view should render the carrier_name. We keep an in-memory module-level
// cache so a record with multiple carrier fields only triggers one fetch per
// (carrierType) and rows aren't re-resolved on every re-render.

interface CarrierLite {
  id: string;
  carrier_name: string;
}

const carrierCache = new Map<string, Map<string, string>>(); // type -> id -> name
const inFlight = new Map<string, Promise<Map<string, string>>>();

function loadAdvisorCarriers(carrierType: string): Promise<Map<string, string>> {
  const cached = carrierCache.get(carrierType);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(carrierType);
  if (existing) return existing;

  const p = fetch(`/api/crm/advisor-carriers?carrier_type=${encodeURIComponent(carrierType)}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json: { data?: Array<{ carrier_id: string; carrier?: CarrierLite | null }> }) => {
      const map = new Map<string, string>();
      for (const row of json.data || []) {
        const name = row.carrier?.carrier_name;
        if (name) map.set(row.carrier_id, name);
      }
      carrierCache.set(carrierType, map);
      inFlight.delete(carrierType);
      return map;
    })
    .catch((err) => {
      console.error('[FieldRenderer] carrier load failed', err);
      inFlight.delete(carrierType);
      return new Map<string, string>();
    });

  inFlight.set(carrierType, p);
  return p;
}

/** Look up a single carrier by ID from the org directory (fallback). */
async function lookupCarrierById(id: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/crm/carriers/${encodeURIComponent(id)}`);
    if (!res.ok) return undefined;
    const json = await res.json();
    const name = json.data?.carrier_name ?? json.carrier_name;
    return name || undefined;
  } catch {
    return undefined;
  }
}

/** Look up a carrier name from the advisor's personal list, falling back to the org directory. */
function CarrierName({ carrierType, value }: { carrierType: string; value: string }) {
  const initial = carrierCache.get(carrierType)?.get(value);
  const [name, setName] = useState<string | undefined>(initial);
  const [loaded, setLoaded] = useState<boolean>(initial !== undefined);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    loadAdvisorCarriers(carrierType)
      .then(async (map) => {
        if (cancelled) return;
        const resolved = map.get(value);
        if (resolved) {
          setName(resolved);
          setLoaded(true);
          return;
        }
        // Not in advisor's personal list — try org directory by ID
        if (UUID_RE.test(value)) {
          const orgName = await lookupCarrierById(value);
          if (cancelled) return;
          if (orgName) {
            // Cache it for future lookups
            map.set(value, orgName);
            setName(orgName);
          }
        }
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [carrierType, value, loaded]);

  // While loading we display a placeholder. Once loaded, show the resolved
  // name or the raw value as a fallback (legacy free-text).
  const display =
    name ?? (UUID_RE.test(value) ? (loaded ? value : '…') : value);

  return (
    <Badge variant="secondary" className="font-medium">
      {display}
    </Badge>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitize(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
  return DOMPurify.sanitize(dirty);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all ml-1"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400" />
      )}
    </button>
  );
}

interface FieldRendererProps {
  field: CrmField;
  value: unknown;
  className?: string;
  /**
   * Sibling field values (usually merged record.data + column mirrors).
   * Used to show phone ownership badges without stuffing names into digits.
   */
  relatedValues?: Record<string, unknown> | null;
}

// Memoized component to prevent unnecessary re-renders in table cells
export const FieldRenderer = memo(function FieldRenderer({
  field,
  value,
  className,
  relatedValues,
}: FieldRendererProps) {
  if (value === null || value === undefined || value === '') {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  // Carrier identity (metadata.carrier_type OR indexed `carrier_id`).
  // Live crm_fields still types `carrier_id` as lookup; the UUID is an
  // insurance_carriers.id, not a crm_records.id.
  if (isCarrierIdentityField(field)) {
    return (
      <span className={className}>
        <CarrierName
          carrierType={resolveInlineCarrierType(field, relatedValues)}
          value={String(value)}
        />
      </span>
    );
  }

  switch (field.type) {
    case 'text':
    case 'textarea': {
      const str = String(value);
      if (field.key === 'notes_history' && str.includes('<')) {
        const clean = sanitize(str);
        return (
          <div
            className={cn('whitespace-pre-wrap [&_b]:font-semibold', className)}
            dangerouslySetInnerHTML={{ __html: clean }}
          />
        );
      }
      if (fieldOffersOptionChoices(field)) {
        return (
          <Badge variant="secondary" className={className}>
            {labelForFieldOption(field.options, value, field.key)}
          </Badge>
        );
      }
      return (
        <span className={cn('font-medium text-slate-900 dark:text-slate-100', className)}>
          {str}
        </span>
      );
    }

    case 'email':
      return (
        <span className="group inline-flex items-center gap-0">
          <a
            href={`mailto:${value}`}
            className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
          >
            <Mail className="w-3 h-3" />
            {String(value)}
          </a>
          <CopyButton value={String(value)} />
        </span>
      );

    case 'phone': {
      const ownerLabel = formatPhoneOwnerLabel(field.key, relatedValues);
      return (
        <span className="inline-flex flex-col">
          <span className="group inline-flex items-center gap-0">
            <a
              href={`tel:${String(value).replace(/[^\d+]/g, '')}`}
              className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
            >
              <Phone className="w-3 h-3" />
              {String(value)}
            </a>
            <CopyButton value={String(value)} />
          </span>
          {ownerLabel ? (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {ownerLabel}
            </span>
          ) : field.tooltip ? (
            <span className="text-[10px] text-slate-400 mt-0.5">{field.tooltip}</span>
          ) : null}
        </span>
      );
    }

    case 'url':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-flex items-center gap-1 text-brand-teal-600 hover:underline', className)}
        >
          <ExternalLink className="w-3 h-3" />
          {new URL(String(value)).hostname}
        </a>
      );

    case 'number': {
      // A year is a label, not a quantity — never "2,026".
      if (/_year$/.test(field.key)) {
        return <span className={className}>{String(value)}</span>;
      }
      // A household member's age typed in without a DOB goes stale silently;
      // the trigger keeps the recorded-on date, so show what it most likely
      // is today next to what was written.
      const recorded = describeRecordedAge(field.key, value, relatedValues);
      if (recorded) {
        return (
          <span className={className}>
            {recorded.stored}
            {recorded.hint && (
              <span className="ml-1.5 text-xs text-muted-foreground">{recorded.hint}</span>
            )}
          </span>
        );
      }
      return (
        <span className={className}>
          {typeof value === 'number' ? value.toLocaleString() : String(value)}
        </span>
      );
    }

    case 'currency':
      return (
        <span className={cn('font-medium', className)}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(value))}
        </span>
      );

    case 'date': {
      let dateFormatted: string;
      try {
        dateFormatted = format(parseFieldDate(value), 'MMM d, yyyy');
      } catch {
        dateFormatted = String(value);
      }
      return <span className={className}>{dateFormatted}</span>;
    }

    case 'datetime': {
      let datetimeFormatted: string;
      try {
        datetimeFormatted = format(parseFieldDate(value), 'MMM d, yyyy h:mm a');
      } catch {
        datetimeFormatted = String(value);
      }
      return <span className={className}>{datetimeFormatted}</span>;
    }

    case 'boolean':
      return value ? (
        <span className={cn('inline-flex items-center gap-1 text-brand-emerald-600', className)}>
          <Check className="w-4 h-4" />
          Yes
        </span>
      ) : (
        <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
          <X className="w-4 h-4" />
          No
        </span>
      );

    case 'select':
    case 'picklist':
      return (
        <Badge variant="secondary" className={className}>
          {labelForFieldOption(field.options, value, field.key)}
        </Badge>
      );

    case 'multiselect':
      const values = Array.isArray(value) ? value : [value];
      return (
        <div className={cn('flex flex-wrap gap-1', className)}>
          {values.map((v, i) => (
            <Badge key={i} variant="secondary">
              {labelForFieldOption(field.options, v, field.key)}
            </Badge>
          ))}
        </div>
      );

    case 'user':
    case 'lookup':
      // These would typically show linked record names
      return <span className={cn('text-brand-teal-600', className)}>{String(value)}</span>;

    default:
      return <span className={className}>{String(value)}</span>;
  }
});

// Helper to render value in table cell (compact view)
export function renderCellValue(field: CrmField, value: unknown): React.ReactNode {
  return <FieldRenderer field={field} value={value} />;
}

// Helper to get display value as string (for exports, etc.)
export function getDisplayValue(field: CrmField, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // Carrier identity: try the in-memory cache (populated when a record
  // with the same carrier_type was viewed earlier in the session).
  if (isCarrierIdentityField(field)) {
    const carrierType = resolveInlineCarrierType(field);
    const map = carrierCache.get(carrierType);
    const resolved = map?.get(String(value));
    if (resolved) return resolved;
    return String(value);
  }

  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'date':
      try {
        return format(parseFieldDate(value), 'yyyy-MM-dd');
      } catch {
        return String(value);
      }

    case 'datetime':
      try {
        return format(parseFieldDate(value), 'yyyy-MM-dd HH:mm');
      } catch {
        return String(value);
      }

    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(Number(value));

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);

    case 'multiselect':
      return Array.isArray(value) ? value.join(', ') : String(value);

    default:
      return String(value);
  }
}
