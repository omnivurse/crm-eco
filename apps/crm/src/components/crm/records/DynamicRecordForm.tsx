'use client';

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  useForm,
  useWatch,
  useFormState,
  type Control,
  type UseFormRegister,
} from 'react-hook-form';
import { flushSync } from 'react-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import { Label } from '@crm-eco/ui/components/label';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { cn } from '@crm-eco/ui/lib/utils';
import type {
  CrmField,
  CrmLayout,
  CrmRecord,
  LayoutSection,
  LayoutSectionAccent,
} from '@/lib/crm/types';
import { getFieldOptions } from '@/lib/crm/utils';
import { toDatetimeLocalValue } from '@/lib/crm/datetime-local';
import { normalizeDateColumnValue } from '@/lib/crm/merge-crm-data-json-to-row';
import { classifyCarrierValue } from '@/lib/crm/coverage-carriers';
import {
  isCarrierIdentityField,
  resolveInlineCarrierType,
} from '@/lib/crm/carrier-field';
import {
  coerceCoverageSnapshotFieldValue,
  coverageSnapshotEnrolledByLabel,
  HEALTH_INSURANCE_PLAN_LABEL,
  isCapacityProductValue,
  selectCoverageSnapshotPlanFields,
} from '@/lib/crm/coverage-snapshot-plan-fields';
import {
  isVisibleEnrolledByField,
  shouldShowOwnershipFieldInForm,
} from '@/lib/crm/ownership-field-dedupe';
import {
  addressFormLabel,
  shouldShowAddressFieldInForm,
} from '@/lib/crm/address-field-dedupe';
import { resolveCoverageSnapshotPlanType } from '@/lib/crm/coverage-snapshot-plan-type';
import { selectHeroSharingField } from '@/lib/crm/coverage-snapshot-identity';
import {
  dateValueToInputDisplay,
  maskDateTyping,
} from '@/lib/crm/date-field-bounds';
import { FieldRenderer } from './FieldRenderer';
import { InlineFieldCell } from './v2/InlineFieldCell';
import {
  formatCurrencyInputValue,
  fieldUsesDecimalMoney,
  isValidCurrencyTyping,
  parseCurrencyInput,
} from '@/lib/crm/currency-input';
import { AdvisorCarrierField } from './AdvisorCarrierField';
import {
  CRM_SECTION_NAV_EVENT,
  buildEffectiveSections,
  getSectionNavGroup,
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  isRecordFormExcludedField,
  shouldAlwaysShowEmptySection,
} from './section-utils';
import { formatPhoneDisplay } from '@/lib/crm/phone-normalize';
import {
  INLINE_EDIT_GRID_CLASS,
  FULL_ROW_SPAN_CLASS,
  fieldSpansFullRow,
  shouldUseDenseFieldRow,
} from './field-layout';
import { getSectionCardAccent } from './section-accent-tokens';
import {
  getPersistedExpandedSections,
  persistSectionExpanded,
} from '@/lib/crm/record-section-persistence';
import {
  shouldShowEndDateFieldInSection,
} from '@/lib/crm/coverage-end-date-fields';
import { CalendarClock, ChevronDown, ChevronRight, Loader2, ShieldCheck, Heart, Shield } from 'lucide-react';

// Section accent palette — see section-accent-tokens.ts (shared with SectionNav).

const getAccent = (accent?: LayoutSectionAccent) => getSectionCardAccent(accent);

/**
 * CREATE-form defaults for person modules (contacts / leads / members): only the
 * sections a rep needs to enter a new member stay open — Name (core/main),
 * Health Share, Health Insurance, Address, Ownership & Management (producer /
 * referring), Identifiers. Every other section starts collapsed so the form is
 * not a 40-card wall. This is a UI-only override for mode="create"; it never
 * touches crm_layouts and never applies to edit / detail views. Sections
 * containing a REQUIRED field are always kept open so native validation can
 * focus them.
 */
export const CREATE_FORM_EXPANDED_SECTION_KEYS: readonly string[] = [
  'core',
  'main',
  'health_sharing',
  'health_insurance',
  'insurance',
  'address',
  'management',
  'identifiers',
];

/**
 * Label for the Membership Snapshot's carrier/entity row. The snapshot resolves
 * one field to represent coverage, but that field may be the health-share
 * `sharing_entity`, the `health_insurance_carrier`, or a generic `carrier`. Show
 * a label that matches the actual coverage type so an insurer (e.g. "Cigna")
 * never reads as a "Sharing Entity". The stored value wins over the field's
 * static metadata so a mis-filed value is still labeled correctly.
 */
function coverageCarrierLabel(
  field: CrmField,
  value: unknown,
  planType?: 'healthshare' | 'insurance' | 'unknown',
): string {
  const byValue = classifyCarrierValue(value);
  const byMeta = field.metadata?.carrier_type;
  if (byValue === 'insurance' || byMeta === 'insurance') return 'Insurance Carrier';
  if (byValue === 'healthshare' || byMeta === 'healthshare') return 'Sharing Entity';
  // Unrecognized carrier value: fall back to the record's overall coverage type
  // so a mis-filed insurer (e.g. "Bright Health" stored in sharing_entity) on an
  // insurance record still reads "Insurance Carrier", not "Sharing Entity".
  if (planType === 'insurance') return 'Insurance Carrier';
  if (planType === 'healthshare') return 'Sharing Entity';
  return field.label;
}

// Search dropdown for lookup/user fields
function LookupSearchField({
  field,
  value,
  onChange,
  error,
}: {
  field: CrmField;
  value: string | undefined;
  onChange: (val: string) => void;
  error?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const endpoint = field.type === 'user'
        ? `/api/crm/users?search=${encodeURIComponent(q)}`
        : `/api/crm/records?search=${encodeURIComponent(q)}&page_size=10${field.options ? `&module_key=${field.options}` : ''}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items = field.type === 'user'
        ? (data.users || data || []).map((u: any) => ({ id: u.id, title: u.full_name || u.email || u.id }))
        : (data.records || []).map((r: any) => ({ id: r.id, title: r.title || r.data?.name || r.data?.email || r.id }));
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [field.type, field.options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={query || selectedLabel}
        onChange={handleInputChange}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={`Search ${field.label.toLowerCase()}...`}
        className={cn(error && 'border-destructive')}
      />
      {open && (query.length >= 2) && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-slate-500 text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  onChange(item.id);
                  setSelectedLabel(item.title);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-slate-400 ml-2">{item.id.slice(0, 8)}...</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Isolated per-field component — only re-renders when its own value changes
const FormFieldRenderer = memo(function FormFieldRenderer({
  field,
  control,
  register,
  setValue,
  error,
  initialValue,
}: {
  field: CrmField;
  control: Control<Record<string, unknown>>;
  register: UseFormRegister<Record<string, unknown>>;
  setValue: (name: string, value: unknown) => void;
  error?: string;
  /** Value the form was opened with (stored truth) — used to avoid rewriting untouched phones. */
  initialValue?: unknown;
}) {
  const value = useWatch({ name: field.key, control });
  const marketType = useWatch({ name: 'market_type', control });
  const sharingEntity = useWatch({ name: 'sharing_entity', control });
  const healthInsuranceCarrier = useWatch({
    name: 'health_insurance_carrier',
    control,
  });

  const commonProps = {
    id: field.key,
    ...register(field.key),
    className: cn(error && 'border-destructive'),
    placeholder: field.tooltip || `Enter ${field.label.toLowerCase()}`,
    ...(field.required && { required: true }),
  };

  let input: React.ReactNode;

  // Carrier identity (metadata.carrier_type OR indexed `carrier_id`).
  // Live crm_fields still types `carrier_id` as lookup; that UUID is an
  // insurance_carriers.id, not a crm_records.id.
  if (isCarrierIdentityField(field)) {
    const carrierField = field.metadata?.carrier_type
      ? field
      : {
          ...field,
          metadata: {
            ...field.metadata,
            carrier_type: resolveInlineCarrierType(field, {
              market_type: marketType,
              sharing_entity: sharingEntity,
              health_insurance_carrier: healthInsuranceCarrier,
            }),
          },
        };
    return (
      <>
        <AdvisorCarrierField
          field={carrierField}
          value={value as string | undefined}
          onChange={(val) => setValue(field.key, val)}
          error={!!error}
        />
        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </>
    );
  }

  switch (field.type) {
    case 'text':
      input = <Input {...commonProps} type="text" />;
      break;

    case 'phone': {
      // Normalise to the canonical display format (NNN-NNN-NNNN, the dominant
      // formatted style in prod — see phone-normalize.ts) on blur, but ONLY
      // when the user actually changed the value: an untouched stored phone
      // must round-trip byte-for-byte (never rewrite saved data on read).
      const { onBlur: rhfBlur, ...phoneReg } = commonProps;
      input = (
        <Input
          {...phoneReg}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onBlur={(e) => {
            const raw = e.target.value;
            const formatted = formatPhoneDisplay(raw);
            const stored = initialValue === null || initialValue === undefined ? '' : String(initialValue);
            if (formatted !== raw && raw.trim() !== '' && raw !== stored) {
              setValue(field.key, formatted);
            }
            void rhfBlur(e);
          }}
        />
      );
      break;
    }

    case 'email':
      input = <Input {...commonProps} type="email" />;
      break;

    case 'url':
      input = <Input {...commonProps} type="url" />;
      break;

    case 'textarea':
      input = <Textarea {...commonProps} rows={3} />;
      break;

    case 'currency':
      input = (
        <Input
          id={field.key}
          className={cn(error && 'border-destructive')}
          // Neutral amount placeholder — do not echo the field label (avoids
          // "Annual deductible" / "Enter annual deductible" visual collision).
          placeholder="$0.00"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={formatCurrencyInputValue(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw !== '' && !isValidCurrencyTyping(raw)) return;
            setValue(field.key, raw === '' ? null : raw);
          }}
          onBlur={(e) => {
            setValue(field.key, parseCurrencyInput(e.target.value));
          }}
          {...(field.required && { required: true })}
        />
      );
      break;

    case 'number':
      if (fieldUsesDecimalMoney(field)) {
        input = (
          <Input
            id={field.key}
            className={cn(error && 'border-destructive')}
            placeholder="$0.00"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={formatCurrencyInputValue(value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw !== '' && !isValidCurrencyTyping(raw)) return;
              setValue(field.key, raw === '' ? null : raw);
            }}
            onBlur={(e) => {
              setValue(field.key, parseCurrencyInput(e.target.value));
            }}
            {...(field.required && { required: true })}
          />
        );
      } else {
        input = (
          <Input
            {...commonProps}
            type="number"
            step="1"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              setValue(field.key, raw === '' ? null : Number(raw));
            }}
          />
        );
      }
      break;

    case 'date': {
      // Stored ISO → MM/DD/YYYY; a value mid-typing is shown as typed. Never
      // normalise partial input here — it pivoted "09/01/20" to 2020 before
      // the user finished typing "2026" (see dateValueToInputDisplay).
      const dateValue = dateValueToInputDisplay(value);
      // Render fully controlled. Spreading register()'s `ref` lets RHF
      // imperatively write the raw stored value (ISO yyyy-MM-dd) into the DOM on
      // mount, visually overriding our masked `value` until the field is edited —
      // so a saved DOB displayed as "1982-02-25" instead of "02/25/1982". Drop
      // the ref; the field stays in form state via setValue (below) + register().
      const { ref: _dateRef, ...dateCommon } = commonProps;
      input = (
        <Input
          {...dateCommon}
          type="text"
          inputMode="numeric"
          placeholder="MM/DD/YYYY"
          value={dateValue}
          onChange={(e) =>
            setValue(field.key, e.target.value ? e.target.value : null)
          }
          onBlur={(e) => {
            // Format to MM/DD/YYYY when leaving the field. Doing this on blur
            // (rather than each keystroke) avoids caret jumps from the form's
            // re-renders. Storage still normalizes to ISO on save.
            const masked = maskDateTyping(e.target.value);
            setValue(field.key, masked ? masked : null);
          }}
        />
      );
      break;
    }

    case 'datetime': {
      const dtValue = toDatetimeLocalValue(value);
      input = (
        <Input
          {...commonProps}
          type="datetime-local"
          value={dtValue}
          onChange={(e) => setValue(field.key, e.target.value)}
        />
      );
      break;
    }

    case 'boolean':
      input = (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.key}
            checked={!!value}
            onCheckedChange={(checked) => setValue(field.key, checked)}
          />
          <Label htmlFor={field.key} className="text-sm font-normal">
            {field.tooltip || 'Yes'}
          </Label>
        </div>
      );
      break;

    case 'select':
    case 'picklist':
      input = (
        <>
          <Select
            value={value as string}
            onValueChange={(val) => setValue(field.key, val)}
          >
            <SelectTrigger className={cn(error && 'border-destructive')}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {getFieldOptions(field.options, field.key).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name={field.key} value={(value as string) || ''} {...(field.required && { required: true })} />
        </>
      );
      break;

    case 'multiselect': {
      const selectedValues = (value as string[]) || [];
      input = (
        <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
          {getFieldOptions(field.options, field.key).map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`${field.key}-${option}`}
                checked={selectedValues.includes(option)}
                onCheckedChange={(checked) => {
                  const newValues = checked
                    ? [...selectedValues, option]
                    : selectedValues.filter((v) => v !== option);
                  setValue(field.key, newValues);
                }}
              />
              <Label htmlFor={`${field.key}-${option}`} className="text-sm font-normal">
                {option}
              </Label>
            </div>
          ))}
        </div>
      );
      break;
    }

    case 'user':
    case 'lookup':
      input = (
        <LookupSearchField
          field={field}
          value={value as string | undefined}
          onChange={(val) => setValue(field.key, val)}
          error={!!error}
        />
      );
      break;

    default:
      input = <Input {...commonProps} />;
  }

  return (
    <>
      {input}
      {error && (
        <p className="text-sm text-destructive mt-1">{error}</p>
      )}
    </>
  );
});

export interface DynamicRecordFormHandle {
  getValues: () => Record<string, unknown>;
  reset: (values?: Record<string, unknown>) => void;
}

interface DynamicRecordFormProps {
  fields: CrmField[];
  layout?: CrmLayout | null;
  defaultValues?: Record<string, unknown>;
  record?: CrmRecord;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  readOnly?: boolean;
  /** When true, renders fields without wrapping in a form element (for use inside server action forms) */
  embedded?: boolean;
  /** Fires when dirty state changes (edit mode — e.g. unsaved banner / navigation guard) */
  onDirtyChange?: (dirty: boolean) => void;
  /** All form values after each update (debounce in parent for auto-save) */
  onValuesChange?: (values: Record<string, unknown>) => void;
  /**
   * V2 opt-in: when true AND `readOnly` is true, each field cell becomes
   * inline-editable (click to edit / blur to save). The parent must
   * already be wrapped in a `<RecordFieldSaveProvider>` so saves can be
   * dispatched. Non-supported field types (multiselect, user, lookup,
   * carrier) fall back to the read-only renderer.
   */
  inlineEditable?: boolean;
  /** Used to keep coverage sections visible on person modules after lead conversion. */
  moduleKey?: string;
  /**
   * Optional content rendered between the Coverage Snapshot and the section
   * cards (record detail V2 puts its plan-change / dependent / support
   * histories and the recent-notes strip here). Nothing else changes.
   */
  beforeSections?: React.ReactNode;
}

export const DynamicRecordForm = forwardRef<DynamicRecordFormHandle, DynamicRecordFormProps>(
  function DynamicRecordForm(
    {
      fields,
      layout,
      defaultValues = {},
      record,
      onSubmit,
      onCancel,
      isLoading = false,
      mode = 'create',
      readOnly = false,
      embedded = false,
      onDirtyChange,
      onValuesChange,
      inlineEditable = false,
      moduleKey,
      beforeSections,
    },
    ref
  ) {
  // Legacy notes_history HTML is rendered by LegacyNotesCard / Notes tab — not the form.
  const visibleFields = useMemo(
    () => fields.filter((f) => !isRecordFormExcludedField(f.key)),
    [fields],
  );

  const layoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };
  const isCreateForm = !readOnly && mode === 'create' && !record;
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const collapsed = new Set(
      (layoutConfig.sections || [])
        .filter((s: LayoutSection) => s.collapsed)
        .map((s: LayoutSection) => s.key),
    );
    if (isCreateForm) {
      const allSectionKeys = new Set<string>(
        (layoutConfig.sections || []).map((s: LayoutSection) => s.key),
      );
      const requiredSections = new Set<string>();
      for (const f of visibleFields) {
        allSectionKeys.add(f.section || 'main');
        if (f.required) requiredSections.add(f.section || 'main');
      }
      if (isPersonModuleKey(moduleKey)) {
        // Create-mode override (see CREATE_FORM_EXPANDED_SECTION_KEYS): collapse
        // every section except the entry-critical ones. Field/section keys, not
        // layout order, decide — so it works even when crm_layouts has no row.
        for (const key of allSectionKeys) {
          if (CREATE_FORM_EXPANDED_SECTION_KEYS.includes(key)) collapsed.delete(key);
          else collapsed.add(key);
        }
      }
      // A section holding a required field is never collapsed on create: the
      // embedded form keeps collapsed inputs mounted-but-hidden, and a hidden
      // required input would block native submit with no visible message.
      for (const key of requiredSections) collapsed.delete(key);
    }
    if (record?.id && typeof window !== 'undefined') {
      for (const key of getPersistedExpandedSections(record.id)) {
        collapsed.delete(key);
      }
    }
    return collapsed;
  });

  // Build dynamic Zod schema based on fields
  const schema = useMemo(() => {
    const schemaShape: Record<string, z.ZodType> = {};

    for (const field of visibleFields) {
      let fieldSchema: z.ZodType;

      // Carrier identity fields render AdvisorCarrierField which accepts
      // both UUIDs (carrier picked from list) and free-text (typed
      // manually via the "Use X as text" fallback). The value must
      // validate as any string, not just UUID.
      if (isCarrierIdentityField(field)) {
        schemaShape[field.key] = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.preprocess(
              (v) => (v === undefined || v === null || (typeof v === 'string' && !v.trim()) ? null : v),
              z.string().nullable(),
            );
        continue;
      }

      switch (field.type) {
        case 'text':
        case 'textarea':
          fieldSchema = z.string();
          if (field.validation?.minLength) {
            fieldSchema = (fieldSchema as z.ZodString).min(field.validation.minLength);
          }
          if (field.validation?.maxLength) {
            fieldSchema = (fieldSchema as z.ZodString).max(field.validation.maxLength);
          }
          break;

        case 'email':
          fieldSchema = z.string().email('Invalid email address');
          break;

        case 'phone':
          // Digits-only; empty → null so optional phones don't fail regex.
          // Names/initials belong in *_owner / *_owner_name companion fields.
          fieldSchema = z.preprocess(
            (v) => {
              if (v === undefined || v === null) return null;
              if (typeof v === 'string' && v.trim() === '') return null;
              return typeof v === 'string' ? v.trim() : v;
            },
            field.required
              ? z
                  .string({ required_error: `${field.label} is required` })
                  .regex(
                    /^[\d\s\-\+\(\)]+$/,
                    'Invalid phone number — use digits only (put names in Owner Name)',
                  )
              : z
                  .string()
                  .regex(
                    /^[\d\s\-\+\(\)]+$/,
                    'Invalid phone number — use digits only (put names in Owner Name)',
                  )
                  .nullable(),
          );
          break;

        case 'url':
          fieldSchema = z.string().url('Invalid URL');
          break;

        case 'number':
        case 'currency':
          fieldSchema = z.coerce.number();
          if (field.validation?.min !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).min(field.validation.min);
          }
          if (field.validation?.max !== undefined) {
            fieldSchema = (fieldSchema as z.ZodNumber).max(field.validation.max);
          }
          break;

        case 'date':
          fieldSchema = z.preprocess(
            (v) => normalizeDateColumnValue(v),
            field.required
              ? z
                  .string({ required_error: `${field.label} is required` })
                  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
              : z
                  .string()
                  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
                  .nullable(),
          );
          break;

        case 'datetime':
          fieldSchema = z.preprocess(
            (v) => {
              if (v === undefined || v === null) return null;
              if (typeof v === 'string' && v.trim() === '') return null;
              return v;
            },
            field.required
              ? z.string().min(1, `${field.label} is required`)
              : z.string().nullable(),
          );
          break;

        case 'boolean':
          fieldSchema = z.boolean();
          break;

        case 'select':
        case 'picklist':
          fieldSchema = z.string();
          break;

        case 'multiselect':
          fieldSchema = z.array(z.string());
          break;

        case 'lookup':
        case 'user':
          fieldSchema = z.string().uuid();
          break;

        default:
          fieldSchema = z.unknown();
      }

      // Make optional if not required.
      //
      // For UUID fields (`lookup` / `user`), empty strings come in from
      // legacy data and cleared inputs, and would otherwise fail the
      // `.uuid()` check — blocking the inner form submit with a
      // confusing "Invalid uuid" inline error. Preprocess `""` into
      // `null` so optional lookups accept "no selection" gracefully.
      if (!field.required) {
        if (field.type === 'lookup' || field.type === 'user') {
          fieldSchema = z.preprocess(
            (v) => {
              if (v === undefined || v === null) return null;
              if (typeof v === 'string' && v.trim() === '') return null;
              return v;
            },
            z.string().uuid().nullable(),
          );
        } else if (field.type === 'phone') {
          // Already empty→null + nullable inside the phone case above.
        } else {
          fieldSchema = fieldSchema.optional().nullable();
        }
      }

      schemaShape[field.key] = fieldSchema;
    }

    return z.object(schemaShape);
  }, [visibleFields]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, CrmField[]> = {};
    const marketType =
      (typeof record?.market_type === 'string' ? record.market_type : null) ??
      (typeof defaultValues.market_type === 'string' ? defaultValues.market_type : null);
    for (const field of visibleFields) {
      if (!shouldShowEndDateFieldInSection(field.key, field.section || 'main')) {
        continue;
      }
      if (
        !shouldShowOwnershipFieldInForm({
          fieldKey: field.key,
          moduleKey,
          values: defaultValues,
          marketType,
        })
      ) {
        continue;
      }
      if (
        !shouldShowAddressFieldInForm({
          fieldKey: field.key,
          moduleKey,
          values: defaultValues,
        })
      ) {
        continue;
      }
      const section = field.section || 'main';
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(field);
    }
    // Sort fields within each section by display_order
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.display_order - b.display_order);
    }
    return grouped;
  }, [visibleFields, defaultValues, moduleKey, record]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
    reset,
    getValues,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as Record<string, unknown>,
  });

  const { isDirty } = useFormState({ control });

  useImperativeHandle(ref, () => ({
    getValues: () => getValues() as Record<string, unknown>,
    reset: (values?: Record<string, unknown>) => {
      if (values) reset(values);
      else reset();
    },
  }));

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const watchedValues = useWatch({ control });
  useEffect(() => {
    if (!onValuesChange || readOnly) return;
    onValuesChange((watchedValues || {}) as Record<string, unknown>);
  }, [watchedValues, onValuesChange, readOnly]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const newCollapsed = new Set(prev);
      const willExpand = newCollapsed.has(key);
      if (willExpand) {
        newCollapsed.delete(key);
      } else {
        newCollapsed.add(key);
      }
      if (record?.id) {
        persistSectionExpanded(record.id, key, willExpand);
      }
      return newCollapsed;
    });
  };

  /** Overview section pills: expand accordion so `#section-{key}` scroll targets aren't height-zero. */
  useEffect(() => {
    const onNav = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!key || typeof key !== 'string') return;
      setCollapsedSections((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        if (record?.id) persistSectionExpanded(record.id, key, true);
        return next;
      });
    };
    window.addEventListener(CRM_SECTION_NAV_EVENT, onNav as EventListener);
    return () => window.removeEventListener(CRM_SECTION_NAV_EVENT, onNav as EventListener);
  }, [record?.id]);

  const sections = useMemo(
    () => buildEffectiveSections(layoutConfig, Object.keys(fieldsBySection), moduleKey),
    [layoutConfig, fieldsBySection, moduleKey],
  );

  const handleFormSubmit = onSubmit ? handleSubmit(onSubmit) : undefined;

  // Helper: a single field cell (label + input or read-only renderer)
  const renderFieldCell = useCallback(
    (
      field: CrmField,
      opts?: {
        row?: boolean;
        tightLabel?: boolean;
        displayValue?: unknown;
        /**
         * Force the static (FieldRenderer) view even on an edit form. Used by
         * the Coverage Snapshot so a key is registered as an input exactly ONCE
         * (in its section card) — never a second time inside the banner.
         */
        readOnlyView?: boolean;
        /**
         * Fixed display label for the cell (e.g. the Coverage Snapshot's
         * "Enrolled by" row, whichever field feeds it). Only the visible
         * label changes — the field itself, its input and its key are untouched.
         */
        label?: string;
        /** Hover title for the label; defaults to the field's tooltip / label. */
        labelTitle?: string;
      },
    ) => {
      const cellReadOnly = readOnly || Boolean(opts?.readOnlyView);
      const enrolledByLabel = isVisibleEnrolledByField(field.key, moduleKey, defaultValues)
        ? coverageSnapshotEnrolledByLabel(field)
        : null;
      const planLabel =
        field.key === 'health_insurance_plan_name' || field.key === 'insurance_plan_name'
          ? HEALTH_INSURANCE_PLAN_LABEL
          : null;
      const cellLabel =
        opts?.label ??
        enrolledByLabel?.label ??
        planLabel ??
        addressFormLabel(field.key, moduleKey, field.label);
      const cellLabelTitle =
        opts?.labelTitle ?? enrolledByLabel?.title ?? field.tooltip ?? cellLabel;
      const cellInlineEditable = inlineEditable && !opts?.readOnlyView;
      // Dense side-by-side rows only for static read-only (no click-to-edit).
      // Inline-edit mode must use stacked label→value cells: auto-fit ~220px
      // columns left ~60px for the value after a w-40 label, so "Add …" inputs
      // and native <select> overlays spilled into the next column.
      const denseRow = shouldUseDenseFieldRow({
        row: opts?.row,
        readOnly: cellReadOnly,
        inlineEditable: cellInlineEditable,
      });
      const cellValue =
        opts && 'displayValue' in opts
          ? opts.displayValue
          : defaultValues[field.key];
      const labeledField = cellLabel === field.label ? field : { ...field, label: cellLabel };

      const valueNode = cellReadOnly ? (
        <div
          className={cn(
            'text-sm min-w-0 max-w-full',
            denseRow ? 'min-h-[20px]' : 'py-0.5 min-h-[28px]',
          )}
        >
          {cellInlineEditable ? (
            <InlineFieldCell
              field={labeledField}
              value={cellValue}
              relatedValues={defaultValues}
            />
          ) : (
            <FieldRenderer
              field={labeledField}
              value={cellValue}
              relatedValues={defaultValues}
            />
          )}
        </div>
      ) : (
        <FormFieldRenderer
          field={labeledField}
          control={control}
          register={register}
          setValue={setValue}
          error={errors[field.key]?.message as string | undefined}
          initialValue={defaultValues[field.key]}
        />
      );

      // Dense "line" layout for static read-only: label left, value right.
      if (denseRow) {
        return (
          <div
            key={field.key}
            className={cn(
              'flex min-w-0 items-baseline gap-3 border-b border-border/40 py-1.5 overflow-hidden',
              fieldSpansFullRow(field) && FULL_ROW_SPAN_CLASS,
            )}
          >
            <Label
              // A static snapshot cell must not claim the section input's id.
              htmlFor={opts?.readOnlyView ? undefined : field.key}
              title={cellLabelTitle}
              className={cn(
                'shrink-0 truncate text-muted-foreground text-[11px] font-medium uppercase leading-snug tracking-wide',
                opts?.tightLabel ? 'w-32' : 'w-40',
              )}
            >
              {cellLabel}
            </Label>
            <div className="min-w-0 flex-1 overflow-hidden">{valueNode}</div>
          </div>
        );
      }

      // Stacked cell — edit forms + inline-editable overview. Comfortable
      // breathing room; value stays contained so editors never collide.
      return (
        <div
          key={field.key}
          className={cn(
            'relative min-w-0 max-w-full rounded-md',
            inlineEditable && 'focus-within:z-20',
            fieldSpansFullRow(field) && FULL_ROW_SPAN_CLASS,
          )}
        >
          <Label
            htmlFor={field.key}
            className="mb-0.5 block truncate text-muted-foreground text-[11px] font-medium uppercase tracking-wider"
            title={cellLabelTitle}
          >
            {cellLabel}
            {!readOnly && field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <div className="min-w-0 max-w-full">{valueNode}</div>
          {field.tooltip && !inlineEditable && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
              {field.tooltip}
            </p>
          )}
        </div>
      );
    },
    [control, defaultValues, errors, inlineEditable, moduleKey, readOnly, register, setValue],
  );

  // Find the "hero summary" fields anywhere in the field list — they don't
  // need to live in the hero section to be surfaced there. We resolve in a
  // priority order so this works whether the record's coverage data lives
  // in the health-sharing fields, the insurance fields, or a custom field
  // sitting in either section.
  const hasValue = useCallback(
    (key: string) => {
      const v = defaultValues[key];
      return v !== null && v !== undefined && v !== '';
    },
    [defaultValues],
  );

  const findFieldByKey = useCallback(
    (key: string) => visibleFields.find((f) => f.key === key),
    [visibleFields],
  );

  const findFieldInSection = useCallback(
    (section: string, predicate: (f: CrmField) => boolean) =>
      visibleFields.find((f) => f.section === section && predicate(f)),
    [visibleFields],
  );

  // Pattern-matched fallbacks: walk every field in the module and pick the
  // first whose key matches our heuristic. This is the safety net that fires
  // when a record's module uses non-standard section names or custom keys —
  // the snapshot still surfaces *something* useful.
  const matchByKeyPattern = useCallback(
    (patterns: RegExp[], typeFilter: (f: CrmField) => boolean) => {
      // Prefer a populated match first
      for (const pattern of patterns) {
        const populated = visibleFields.find(
          (f) => typeFilter(f) && pattern.test(f.key) && hasValue(f.key),
        );
        if (populated) return populated;
      }
      // Fall back to the first existing field that matches any pattern
      for (const pattern of patterns) {
        const existing = visibleFields.find((f) => typeFilter(f) && pattern.test(f.key));
        if (existing) return existing;
      }
      return undefined;
    },
    [visibleFields, hasValue],
  );

  const heroSharingField = useMemo(() => {
    const isCarrierType = (f: CrmField) => f.type === 'select' || f.type === 'text';
    const candidates = [
      findFieldByKey('sharing_entity'),
      findFieldByKey('health_insurance_carrier'),
      findFieldByKey('insurance_carrier'),
      findFieldByKey('carrier'),
      findFieldByKey('carrier_name'),
      findFieldByKey('coverage_option'),
      findFieldInSection('health_sharing', isCarrierType),
      findFieldInSection('health_insurance', isCarrierType),
      findFieldInSection('insurance_coverage', isCarrierType),
      findFieldInSection('insurance', isCarrierType),
      // Generic key-pattern fallback (any module / custom section)
      matchByKeyPattern(
        [/sharing|share/i, /carrier|provider/i, /entity/i, /coverage/i],
        isCarrierType,
      ),
    ].filter((f): f is CrmField => Boolean(f));

    // Prefer a candidate whose value is *resolvable* (a carrier UUID or a real
    // ministry name) over an ambiguous legacy value like `carrier: "Other"`, so
    // a HealthShare member with `sharing_entity: <Sedera UUID>` never reads
    // "Sharing Entity: Other". Falls back to first-populated, then placeholder.
    return selectHeroSharingField({ candidates, values: defaultValues });
  }, [findFieldByKey, findFieldInSection, matchByKeyPattern, defaultValues]);

  // Classify the record's coverage as health-sharing vs insurance so the
  // snapshot shows ONE coherent set of terms — never an insurance Monthly
  // Premium next to a health-share Monthly Contribution — and so the carrier
  // row is labelled correctly. Logic lives in resolveCoverageSnapshotPlanType
  // (conflict override: healthshare market_type + known insurer hero → insurance).
  const recordPlanType = useMemo<'healthshare' | 'insurance' | 'unknown'>(() => {
    const heroCarrierValue = heroSharingField
      ? defaultValues[heroSharingField.key]
      : undefined;
    const resolved = resolveCoverageSnapshotPlanType({
      values: defaultValues,
      heroCarrierValue,
      hasValue,
    });
    // Field metadata can still tip an otherwise-unknown hero when market_type
    // and product aliases did not decide.
    if (resolved !== 'unknown' || !heroSharingField) return resolved;
    const byMeta = heroSharingField.metadata?.carrier_type;
    if (byMeta === 'insurance' || byMeta === 'healthshare') return byMeta;
    return resolved;
  }, [heroSharingField, defaultValues, hasValue]);

  // Relabel the resolved carrier row so insurance vs health sharing read as
  // distinct (same field key, so inline edit still saves to the right field).
  const heroSharingFieldForDisplay = useMemo(() => {
    if (!heroSharingField) return undefined;
    const label = coverageCarrierLabel(heroSharingField, defaultValues[heroSharingField.key], recordPlanType);
    return label === heroSharingField.label ? heroSharingField : { ...heroSharingField, label };
  }, [heroSharingField, defaultValues, recordPlanType]);

  const heroStartDateField = useMemo(() => {
    const isDateType = (f: CrmField) => f.type === 'date';
    const candidates = [
      findFieldByKey('sharing_effective_date'),
      findFieldByKey('health_insurance_start_date'),
      findFieldByKey('insurance_effective_date'),
      findFieldByKey('effective_date'),
      findFieldByKey('start_date'),
      findFieldByKey('original_start_date'),
      findFieldByKey('current_year_start_date'),
      findFieldInSection('health_sharing', isDateType),
      findFieldInSection('health_insurance', isDateType),
      findFieldInSection('insurance_coverage', isDateType),
      findFieldInSection('insurance', isDateType),
      findFieldInSection('start_date', isDateType),
      // Generic key-pattern fallback
      matchByKeyPattern(
        [/effective.*date|start.*date|begin.*date/i, /^date$/i],
        isDateType,
      ),
    ].filter((f): f is CrmField => Boolean(f));

    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, findFieldInSection, matchByKeyPattern, hasValue]);

  // Referral context (source + referring member). Reps need this at a glance
  // when talking with a member, so we surface it in the snapshot instead of
  // leaving it buried in the Financial / Conversion section below.
  const heroReferralSourceField = useMemo(() => {
    const isTextish = (f: CrmField) =>
      f.type === 'text' || f.type === 'select' || f.type === 'picklist';
    const candidates = [
      findFieldByKey('referral_source'),
      findFieldByKey('referral'),
      matchByKeyPattern([/referral.?source/i, /^referral$/i], isTextish),
    ].filter((f): f is CrmField => Boolean(f));
    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, matchByKeyPattern, hasValue]);

  const heroReferringMemberField = useMemo(() => {
    const isTextish = (f: CrmField) =>
      f.type === 'text' || f.type === 'select' || f.type === 'picklist';
    const candidates = [
      findFieldByKey('referring_member'),
      matchByKeyPattern([/referring.?member/i, /referred.?by/i, /referrer/i], isTextish),
    ].filter((f): f is CrmField => Boolean(f));
    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, matchByKeyPattern, hasValue]);

  // "Enrolled by" — the advisor / agent / producer who enrolled this member.
  // Client asks that "who enrolled" is visible on the contact at a glance;
  // native + enrollment-created contacts carry it in `producer` (or the
  // advisor / agent / lead_owner aliases) rather than the normalized columns.
  const heroEnrolledByField = useMemo(() => {
    const isTextish = (f: CrmField) =>
      f.type === 'text' ||
      f.type === 'select' ||
      f.type === 'picklist' ||
      f.type === 'lookup' ||
      f.type === 'user';
    const candidates = [
      findFieldByKey('producer_name'),
      findFieldByKey('producer'),
      findFieldByKey('advisor_name'),
      findFieldByKey('advisor'),
      findFieldByKey('agent'),
      findFieldByKey('lead_owner'),
      matchByKeyPattern([/^producer/i, /^advisor/i, /^agent$/i, /lead.?owner/i], isTextish),
    ].filter((f): f is CrmField => Boolean(f));
    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, matchByKeyPattern, hasValue]);

  // Member ID — carrier / sharing / dental member number so reps can quote
  // it back without opening the coverage section.
  const heroMemberIdField = useMemo(() => {
    const isTextish = (f: CrmField) =>
      f.type === 'text' || f.type === 'number';
    const candidates = [
      findFieldByKey('member_number'),
      findFieldByKey('e123_member_id'),
      findFieldByKey('sharing_member_id'),
      findFieldByKey('dental_member_id'),
      matchByKeyPattern([/member.?(number|id)$/i], isTextish),
    ].filter((f): f is CrmField => Boolean(f));
    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, matchByKeyPattern, hasValue]);

  /** Product / plan / tier lines for the coverage snapshot (never duplicates carrier/date rows). */
  const heroProductPlanFields = useMemo(() => {
    const skipKeys = new Set<string>();
    if (heroSharingField) skipKeys.add(heroSharingField.key);
    if (heroStartDateField) skipKeys.add(heroStartDateField.key);

    // Selection + amount-label invariant live in selectCoverageSnapshotPlanFields
    // so "Monthly Premium" cannot appear twice (regression-tested). Passing
    // `values` makes selection populated-first, so a real contribution / tier is
    // never pushed past the row cap by an empty placeholder field.
    return selectCoverageSnapshotPlanFields({
      fields: visibleFields,
      skipKeys,
      planType: recordPlanType,
      values: defaultValues,
    });
  }, [visibleFields, heroSharingField, heroStartDateField, recordPlanType, defaultValues]);

  /**
   * The Coverage Snapshot is a READ summary. On the detail page it is static
   * (or click-to-edit in inline mode). On create/edit FORMS it is always static:
   * rendering editable inputs there registered the same key twice (banner +
   * section card) so FormData carried duplicate entries. Each key now has
   * exactly one input — in its section — and the banner shows what is on file.
   */
  const snapshotStatic = readOnly ? !inlineEditable : true;

  /** Omit empty rows in static read-only snapshot; keep placeholders in edit / inline-edit. */
  const heroProductPlanSnapshotFields = useMemo(() => {
    const hasSnapshotValue = (key: string) => {
      const display = coerceCoverageSnapshotFieldValue(key, defaultValues[key]);
      if (display === null || display === undefined || display === '') return false;
      // Capacity aliases are coerced to null above; keep a belt-and-suspenders check.
      if (key === 'product' && isCapacityProductValue(defaultValues[key])) return false;
      return true;
    };
    if (snapshotStatic) {
      return heroProductPlanFields.filter((f) => hasSnapshotValue(f.key));
    }
    return heroProductPlanFields;
  }, [heroProductPlanFields, defaultValues, snapshotStatic]);

  /**
   * Context rows for the snapshot (referral source, referring member,
   * enrolled-by advisor, member ID); empty rows dropped in static read-only
   * view. Never duplicates a row already shown in the plan / carrier / date
   * cluster (e.g. `sharing_member_id` for HealthShare plans).
   */
  const heroReferralSnapshotFields = useMemo(() => {
    const seen = new Set<string>();
    if (heroSharingField) seen.add(heroSharingField.key);
    if (heroStartDateField) seen.add(heroStartDateField.key);
    for (const f of heroProductPlanFields) seen.add(f.key);
    const fields = [
      heroReferralSourceField,
      heroReferringMemberField,
      heroEnrolledByField,
      heroMemberIdField,
    ].filter((f): f is CrmField => {
      if (!f || seen.has(f.key)) return false;
      seen.add(f.key);
      return true;
    });
    if (snapshotStatic) {
      return fields.filter((f) => hasValue(f.key));
    }
    return fields;
  }, [
    heroReferralSourceField,
    heroReferringMemberField,
    heroEnrolledByField,
    heroMemberIdField,
    heroSharingField,
    heroStartDateField,
    heroProductPlanFields,
    hasValue,
    snapshotStatic,
  ]);

  // ── Coverage Snapshot ─────────────────────────────────────────────────
  // Lifted OUT of the Lead Information hero (where it crowded the fields as a
  // narrow right sidebar) into a full-width banner pinned to the top of the
  // record. Horizontal reading order: identity rail (coverage type + carrier)
  // │ plan / product / effective date │ referral context. The accent tracks
  // the record's coverage type so the banner reads as one system with the
  // Market Type chip in the header (emerald = HealthShare, blue = Insurance,
  // slate = unclassified). Cells still render through renderFieldCell, so
  // inline editing is unchanged.
  const renderCoverageSnapshot = () => {
    if (!sections.some((s) => s.variant === 'hero')) return null;
    // A brand-new record has nothing on file yet — the summary banner would
    // only say "Not set" above the very fields being filled in. Skip it.
    if (isCreateForm) return null;

    const accent =
      recordPlanType === 'insurance'
        ? {
            Icon: Shield,
            label: 'Insurance Coverage',
            wrap: 'border-blue-200/70 from-blue-50/80 ring-blue-500/10 dark:border-blue-500/25 dark:from-blue-500/[0.08] dark:ring-blue-400/10',
            iconWrap: 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
            eyebrow: 'text-blue-700 dark:text-blue-300',
            divider: 'bg-blue-500/20 dark:bg-blue-400/20',
          }
        : recordPlanType === 'healthshare'
          ? {
              Icon: Heart,
              label: 'HealthShare Coverage',
              wrap: 'border-emerald-200/70 from-emerald-50/80 ring-emerald-500/10 dark:border-emerald-500/25 dark:from-emerald-500/[0.08] dark:ring-emerald-400/10',
              iconWrap: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
              eyebrow: 'text-emerald-700 dark:text-emerald-300',
              divider: 'bg-emerald-500/20 dark:bg-emerald-400/20',
            }
          : {
              Icon: ShieldCheck,
              label: 'Coverage',
              wrap: 'border-slate-200/80 from-slate-50/70 ring-slate-500/5 dark:border-slate-700/60 dark:from-slate-800/40 dark:ring-slate-400/5',
              iconWrap: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
              eyebrow: 'text-slate-600 dark:text-slate-300',
              divider: 'bg-slate-400/20 dark:bg-slate-500/30',
            };
    const AccentIcon = accent.Icon;

    const staticView = snapshotStatic;
    const carrierHasValue = heroSharingField ? hasValue(heroSharingField.key) : false;
    const showDate =
      Boolean(heroStartDateField) &&
      (!staticView || (heroStartDateField ? hasValue(heroStartDateField.key) : false));
    const hasDetail = heroProductPlanSnapshotFields.length > 0 || showDate;
    const hasReferral = heroReferralSnapshotFields.length > 0;
    const isEmpty = staticView && !carrierHasValue && !hasDetail && !hasReferral;

    const divider = (
      <div className={cn('hidden w-px self-stretch lg:block', accent.divider)} aria-hidden />
    );

    return (
      <div className={cn('rounded-xl border bg-gradient-to-br to-transparent shadow-sm ring-1', accent.wrap)}>
        <div className="flex flex-col gap-x-6 gap-y-3 p-3 lg:flex-row lg:flex-wrap lg:items-stretch">
          {/* Identity rail — coverage type + carrier / sharing entity */}
          <div className="flex items-start gap-3 lg:w-64 lg:shrink-0">
            <span
              className={cn(
                'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                accent.iconWrap,
              )}
            >
              <AccentIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', accent.eyebrow)}>
                {accent.label}
              </div>
              <div className="mt-1.5">
                {heroSharingFieldForDisplay && (carrierHasValue || !staticView) ? (
                  renderFieldCell(heroSharingFieldForDisplay, { readOnlyView: !readOnly })
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
              {(() => {
                // Read-only chip for a pending scheduled plan change (CRM-only
                // records; consumed by the apply-scheduled-plan-changes cron).
                const spc = record?.data?.scheduled_plan_change as
                  | { to_plan?: string; effective_date?: string }
                  | null
                  | undefined;
                if (!spc || typeof spc !== 'object' || !spc.effective_date) return null;
                return (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Upcoming: {spc.to_plan || 'plan change'} · starts {spc.effective_date}
                  </span>
                );
              })()}
            </div>
          </div>

          {isEmpty ? (
            <div className="flex flex-1 items-center border-t border-dashed pt-3 lg:border-0 lg:pt-0">
              {divider}
              <p className="text-sm text-muted-foreground lg:pl-6">
                No coverage details on file yet — add a carrier, plan, and effective date to
                complete this member&apos;s snapshot.
              </p>
            </div>
          ) : (
            <>
              {divider}
              {/* One dense auto-fill grid for plan / product / effective date
                  AND the referral + enrolled-by + member-ID context. Reps
                  want everything at a glance; the earlier three-rail layout
                  stacked one field per row and left two rails mostly empty. */}
              <div
                className="grid flex-1 gap-x-6 gap-y-2 border-t border-dashed pt-3 lg:border-0 lg:pt-0"
                style={{
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(min(100%, 13rem), 1fr))',
                }}
              >
                {heroProductPlanSnapshotFields.map((field) =>
                  renderFieldCell(field, {
                    row: true,
                    tightLabel: true,
                    readOnlyView: !readOnly,
                    // Capacity aliases ("Health Insurance") must not read as a
                    // Membership / plan name — show the empty placeholder instead.
                    displayValue: coerceCoverageSnapshotFieldValue(
                      field.key,
                      defaultValues[field.key],
                    ),
                  }),
                )}
                {showDate &&
                  heroStartDateField &&
                  renderFieldCell(heroStartDateField, {
                    row: true,
                    tightLabel: true,
                    readOnlyView: !readOnly,
                  })}
                {heroReferralSnapshotFields.map((field) => {
                  // "Who enrolled" wears ONE label everywhere (matches the
                  // dashboard's "Enrolled by" column) no matter whether
                  // producer_name / agent / advisor supplied the value; the
                  // field's own label stays available as the hover title.
                  const enrolledBy =
                    heroEnrolledByField && field.key === heroEnrolledByField.key
                      ? coverageSnapshotEnrolledByLabel(field)
                      : null;
                  return renderFieldCell(field, {
                    row: true,
                    tightLabel: true,
                    readOnlyView: !readOnly,
                    ...(enrolledBy
                      ? { label: enrolledBy.label, labelTitle: enrolledBy.title }
                      : {}),
                  });
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSections = () => {
    /** Clears sticky overview pills + approximate shell header when scrolling from section nav. */
    const overviewScrollAid = readOnly ? 'scroll-mt-[175px]' : '';

    return (
    <>
      {renderCoverageSnapshot()}
      {beforeSections}
      {sections.map((section) => {
        const snapshotEnrolledByKey =
          heroEnrolledByField &&
          heroReferralSnapshotFields.some((f) => f.key === heroEnrolledByField.key)
            ? heroEnrolledByField.key
            : undefined;
        const sectionFields = (fieldsBySection[section.key] || []).filter(
          (f) => f.key !== snapshotEnrolledByKey,
        );
        const isHero = section.variant === 'hero';
        const forceCoverageSection = shouldAlwaysShowEmptySection(
          moduleKey,
          section.key,
          inlineEditable,
        );
        // The coverage summary now lives in the top banner, so a hero with no
        // fields of its own has nothing left to show — let it collapse like any
        // other empty section.
        // Person-module coverage sections must never disappear — reps add insurance
        // here immediately after lead → contact conversion.
        if (sectionFields.length === 0 && !forceCoverageSection) return null;

        // In static read-only mode, omit full cards where every field is empty —
        // keep a cross-column anchor so section pills still scroll (IDs match
        // Overview nav). In inline-edit mode we ALWAYS render the full card so
        // reps can fill blank fields (e.g. Address) without the whole section
        // disappearing as they type or clear the last value.
        // Person-module coverage sections (Health Share, Health Insurance, etc.)
        // also stay visible so reps can add data right after lead → contact conversion.
        if (
          readOnly &&
          !inlineEditable &&
          !isHero &&
          !shouldAlwaysShowEmptySection(moduleKey, section.key, inlineEditable)
        ) {
          const hasAnyValue = sectionFields.some(
            (f) =>
              defaultValues[f.key] !== null &&
              defaultValues[f.key] !== undefined &&
              defaultValues[f.key] !== ''
          );
          if (!hasAnyValue) {
            return (
              <div
                key={section.key}
                id={`section-${section.key}`}
                data-section={section.key}
                className={cn(
                  '[column-span:all] w-full h-px overflow-hidden shrink-0',
                  overviewScrollAid,
                )}
                aria-hidden
              />
            );
          }
        }

        const isCollapsed = collapsedSections.has(section.key);
        const accent = getAccent(section.accent);

        return (
          <Card
            key={section.key}
            id={`section-${section.key}`}
            data-section={section.key}
            className={cn('break-inside-avoid border', accent.border, overviewScrollAid)}
          >
            <CardHeader
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              aria-controls={`section-${section.key}-content`}
              className={cn(
                'cursor-pointer hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                accent.header,
                readOnly ? 'py-2 px-4' : 'py-3',
              )}
              onClick={() => toggleSection(section.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection(section.key);
                }
              }}
            >
              <CardTitle
                className={cn(
                  'font-medium flex items-center gap-2',
                  accent.title,
                  readOnly ? 'text-sm' : 'text-base',
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {section.label}
                {sectionFields.length > 0 && (
                  <span className="ml-auto text-[11px] font-normal tabular-nums text-muted-foreground">
                    {sectionFields.filter((f) => hasValue(f.key)).length} of {sectionFields.length} filled
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            {/* The embedded (server-action) form keeps collapsed content MOUNTED
                but hidden so the inputs stay in the DOM: the create page builds
                FormData from the DOM, so an unmounted section would silently drop
                what the user typed there (or a restored draft value). Read-only
                and RHF-submitted forms unmount as before. */}
            {(!isCollapsed || (embedded && !readOnly)) && (
              <CardContent
                id={`section-${section.key}-content`}
                hidden={isCollapsed}
                className={cn(readOnly ? 'pt-3 pb-3 px-4' : undefined, isCollapsed && 'hidden')}
              >
                {isHero ? (
                  // ──────────────────────────────────────────────────────────
                  // HERO LAYOUT — Name/core fields. Inline-edit uses a capped
                  // 2-col stacked grid so inputs never collide. Static read-only
                  // may pack denser for scan.
                  // ──────────────────────────────────────────────────────────
                  <div
                    className={cn(
                      'grid',
                      inlineEditable
                        ? INLINE_EDIT_GRID_CLASS
                        : readOnly
                          ? 'gap-x-8 gap-y-1'
                          : 'gap-x-5 gap-y-3',
                    )}
                    style={
                      !inlineEditable && readOnly
                        ? {
                            gridTemplateColumns:
                              'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
                          }
                        : !readOnly
                          ? {
                              gridTemplateColumns:
                                'repeat(auto-fill, minmax(min(100%, 16rem), 1fr))',
                            }
                          : undefined
                    }
                  >
                    {sectionFields.map((f) => renderFieldCell(f, { row: true }))}
                  </div>
                ) : sectionFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isPersonCoverageSectionKey(section.key)
                      ? 'Coverage fields are not configured for this section. Ask an admin to run coverage field parity, or use Edit to add fields in Settings.'
                      : getSectionNavGroup(section.key) === 'notes'
                        ? 'Notes live in the Notes tab — use the Notes pill above to open them.'
                        : 'No fields are configured for this section yet. An admin can add them in Settings.'}
                  </p>
                ) : (
                  <div
                    className={cn(
                      'grid',
                      inlineEditable
                        ? INLINE_EDIT_GRID_CLASS
                        : readOnly
                          ? 'gap-x-8 gap-y-1'
                          : 'gap-4',
                      !readOnly &&
                        !inlineEditable &&
                        (section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'),
                    )}
                    style={
                      readOnly && !inlineEditable
                        ? {
                            gridTemplateColumns:
                              'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))',
                          }
                        : undefined
                    }
                  >
                    {sectionFields.map((f) => renderFieldCell(f, { row: true }))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </>
    );
  };

  // Read-only overview: single column so section order matches the nav pills
  // (multi-column masonry fills top-to-bottom per column and scrambles order).
  if (readOnly) {
    return <div className="space-y-3">{renderSections()}</div>;
  }

  // When embedded in a server action form, just render the fields without form wrapper
  if (embedded) {
    return (
      <div
        className="space-y-6"
        // Native validation on the host <form>: if the offending input sits in
        // a collapsed (hidden) section, expand it synchronously so the browser
        // can focus it and show its message instead of failing silently.
        onInvalidCapture={(e) => {
          const sectionKey = (e.target as HTMLElement | null)
            ?.closest?.('[data-section]')
            ?.getAttribute('data-section');
          if (!sectionKey || !collapsedSections.has(sectionKey)) return;
          flushSync(() => {
            setCollapsedSections((prev) => {
              if (!prev.has(sectionKey)) return prev;
              const next = new Set(prev);
              next.delete(sectionKey);
              return next;
            });
          });
        }}
      >
        {renderSections()}
      </div>
    );
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {renderSections()}

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="min-w-24">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Record'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
  }
);

DynamicRecordForm.displayName = 'DynamicRecordForm';
