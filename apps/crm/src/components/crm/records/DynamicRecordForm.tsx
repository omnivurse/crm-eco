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
  isoDateToMaskedDisplay,
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
  shouldAlwaysShowEmptySection,
} from './section-utils';
import { getSectionCardAccent } from './section-accent-tokens';
import {
  getPersistedExpandedSections,
  persistSectionExpanded,
} from '@/lib/crm/record-section-persistence';
import {
  shouldShowEndDateFieldInSection,
} from '@/lib/crm/coverage-end-date-fields';
import { ChevronDown, ChevronRight, Loader2, ShieldCheck, Heart, Shield } from 'lucide-react';

// Section accent palette — see section-accent-tokens.ts (shared with SectionNav).

const getAccent = (accent?: LayoutSectionAccent) => getSectionCardAccent(accent);

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
}: {
  field: CrmField;
  control: Control<Record<string, unknown>>;
  register: UseFormRegister<Record<string, unknown>>;
  setValue: (name: string, value: unknown) => void;
  error?: string;
}) {
  const value = useWatch({ name: field.key, control });

  const commonProps = {
    id: field.key,
    ...register(field.key),
    className: cn(error && 'border-destructive'),
    placeholder: field.tooltip || `Enter ${field.label.toLowerCase()}`,
    ...(field.required && { required: true }),
  };

  let input: React.ReactNode;

  // Carrier-typed fields take precedence regardless of the underlying field
  // type (`select`, `lookup`, etc.) — the advisor's personal carrier list is
  // always the source of truth.
  if (field.metadata?.carrier_type) {
    return (
      <>
        <AdvisorCarrierField
          field={field}
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
    case 'phone':
      input = <Input {...commonProps} type="text" />;
      break;

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
          placeholder={field.tooltip || `Enter ${field.label.toLowerCase()}`}
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
            placeholder={field.tooltip || `Enter ${field.label.toLowerCase()}`}
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
      const iso = normalizeDateColumnValue(value);
      const dateValue = iso
        ? isoDateToMaskedDisplay(iso)
        : typeof value === 'string'
          ? value
          : '';
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
    },
    ref
  ) {
  // notes_history is legacy imported HTML rendered by LegacyNotesCard on detail views
  const visibleFields = useMemo(() => fields.filter(f => f.key !== 'notes_history'), [fields]);

  const layoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const collapsed = new Set(
      (layoutConfig.sections || [])
        .filter((s: LayoutSection) => s.collapsed)
        .map((s: LayoutSection) => s.key),
    );
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

      // Carrier-typed fields render AdvisorCarrierField which accepts
      // both UUIDs (carrier picked from list) and free-text (typed
      // manually via the "Use X as text" fallback). The value must
      // validate as any string, not just UUID.
      if (field.metadata?.carrier_type) {
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
          fieldSchema = z.string();
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
    for (const field of visibleFields) {
      if (!shouldShowEndDateFieldInSection(field.key, field.section || 'main')) {
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
  }, [visibleFields]);

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
    (field: CrmField, opts?: { row?: boolean; tightLabel?: boolean }) => {
      const denseRow = Boolean(opts?.row) && readOnly;

      const valueNode = readOnly ? (
        <div className={cn('text-sm', denseRow ? 'min-h-[20px]' : 'py-0.5 min-h-[24px]')}>
          {inlineEditable ? (
            <InlineFieldCell field={field} value={defaultValues[field.key]} />
          ) : (
            <FieldRenderer field={field} value={defaultValues[field.key]} />
          )}
        </div>
      ) : (
        <FormFieldRenderer
          field={field}
          control={control}
          register={register}
          setValue={setValue}
          error={errors[field.key]?.message as string | undefined}
        />
      );

      // Dense "line" layout for read-only records: label on the left, value on
      // the right, hairline separators, minimal vertical rhythm. Packs far more
      // fields per screen so reps scan and find things without scrolling.
      if (denseRow) {
        return (
          <div
            key={field.key}
            className={cn(
              'flex items-baseline gap-3 border-b border-border/40 py-1.5',
              field.width === 'full' && 'md:col-span-2',
            )}
          >
            <Label
              htmlFor={field.key}
              className={cn(
                'shrink-0 text-muted-foreground text-[11px] font-medium uppercase leading-snug tracking-wide',
                opts?.tightLabel ? 'w-24' : 'w-36',
              )}
            >
              {field.label}
            </Label>
            <div className="min-w-0 flex-1">{valueNode}</div>
          </div>
        );
      }

      return (
        <div key={field.key} className={cn(field.width === 'full' && 'md:col-span-2')}>
          <Label
            htmlFor={field.key}
            className="mb-1 block text-muted-foreground text-xs uppercase tracking-wider"
          >
            {field.label}
            {!readOnly && field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {valueNode}
        </div>
      );
    },
    [control, defaultValues, errors, inlineEditable, readOnly, register, setValue],
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

    return candidates.find((f) => hasValue(f.key)) ?? candidates[0];
  }, [findFieldByKey, findFieldInSection, matchByKeyPattern, hasValue]);

  // Classify the record's coverage as health-sharing vs insurance so the
  // snapshot shows ONE coherent set of terms — never an insurance Monthly
  // Premium next to a health-share Monthly Contribution — and so the carrier
  // row is labelled correctly. Priority:
  //   1. an explicit coverage / product / plan-type field — matches the
  //      "Product: Insurance" the rep sees, and can't be fooled by an
  //      unrecognized carrier name;
  //   2. a recognized carrier value / metadata;
  //   3. a presence heuristic over fields EXCLUSIVE to one type — never
  //      `sharing_entity`, which can hold a mis-filed insurer like "Bright
  //      Health" and would otherwise read as health-sharing.
  // Falls back to 'unknown' (nothing filtered — real data is never hidden).
  const recordPlanType = useMemo<'healthshare' | 'insurance' | 'unknown'>(() => {
    // Indexed market_type is canonical — prefer it over heuristics/aliases.
    const market = defaultValues.market_type;
    if (market === 'healthshare') return 'healthshare';
    if (market === 'traditional_insurance') return 'insurance';

    const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    for (const k of ['coverage_type', 'plan_type', 'product_type', 'product', 'coverage_category']) {
      const v = norm(defaultValues[k]);
      if (!v) continue;
      if (/\b(share|sharing|health.?share|ministry|hcsm)\b/.test(v)) return 'healthshare';
      if (/\b(insurance|major.?medical|aca|marketplace|traditional|ppo|hmo|epo)\b/.test(v)) return 'insurance';
    }
    if (heroSharingField) {
      const byValue = classifyCarrierValue(defaultValues[heroSharingField.key]);
      if (byValue !== 'unknown') return byValue;
      const byMeta = heroSharingField.metadata?.carrier_type;
      if (byMeta === 'insurance' || byMeta === 'healthshare') return byMeta;
    }
    const hasSharing = ['monthly_contribution', 'monthly_share', 'share_amount', 'iua_amount', 'member_tier', 'sharing_status', 'sharing_member_id'].some((k) => hasValue(k));
    const hasInsurance = ['health_insurance_carrier', 'insurance_carrier', 'monthly_premium', 'health_insurance_plan_name', 'insurance_plan_name', 'health_insurance_premium', 'insurance_premium'].some((k) => hasValue(k));
    if (hasSharing && !hasInsurance) return 'healthshare';
    if (hasInsurance && !hasSharing) return 'insurance';
    return 'unknown';
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

  /** Product / plan / tier lines for the emerald snapshot (never duplicates carrier/date rows). */
  const heroProductPlanFields = useMemo(() => {
    const skipKeys = new Set<string>();
    if (heroSharingField) skipKeys.add(heroSharingField.key);
    if (heroStartDateField) skipKeys.add(heroStartDateField.key);

    // Plan-type separation: skip the OTHER coverage type's exclusive rows so a
    // health-share member never shows an insurance Monthly Premium, and an
    // insurance member never shows a Monthly Contribution / IUA. 'unknown'
    // skips nothing (both the preferred-key loop and the pattern fallback below
    // honor skipKeys).
    if (recordPlanType === 'healthshare') {
      // Only unambiguous insurance terms. 'coverage_option'/'plan_name' are
      // left neutral (either type can carry one) so a real value is never hidden.
      for (const k of ['health_insurance_plan_name', 'insurance_plan_name', 'health_insurance_premium', 'monthly_premium']) skipKeys.add(k);
    } else if (recordPlanType === 'insurance') {
      for (const k of ['monthly_share', 'monthly_contribution', 'iua_amount', 'member_tier', 'sharing_member_id', 'sharing_status']) skipKeys.add(k);
    }

    const preferredKeys = [
      'product',
      'health_insurance_plan_name',
      'insurance_plan_name',
      'health_insurance_premium',
      'plan_name',
      'plan_type',
      'coverage_option',
      'monthly_share',
      'monthly_contribution',
      'monthly_premium',
      'monthly_amount',
      'monthly_rate',
      'iua_amount',
      'member_tier',
      'sharing_member_id',
      'sharing_status',
      'previous_product',
    ];

    const out: CrmField[] = [];
    const seen = new Set<string>();

    const tryAdd = (f: CrmField | undefined) => {
      if (!f || skipKeys.has(f.key) || seen.has(f.key)) return;
      out.push(f);
      seen.add(f.key);
    };

    for (const k of preferredKeys) {
      tryAdd(findFieldByKey(k));
      if (out.length >= 6) break;
    }

    if (out.length < 6) {
      const patterned = visibleFields.filter(
        (f) =>
          !skipKeys.has(f.key) &&
          !seen.has(f.key) &&
          (f.type === 'text' ||
            f.type === 'textarea' ||
            f.type === 'select' ||
            f.type === 'picklist' ||
            f.type === 'number' ||
            f.type === 'currency') &&
          /plan|product|tier|premium|monthly|contribution|coverage.?option|member.?tier|rate|amount/i.test(
            f.key,
          ),
      );
      for (const f of patterned) {
        tryAdd(f);
        if (out.length >= 6) break;
      }
    }

    return out;
  }, [visibleFields, findFieldByKey, heroSharingField, heroStartDateField, recordPlanType]);

  /** Omit empty rows in static read-only snapshot; keep placeholders in edit / inline-edit. */
  const heroProductPlanSnapshotFields = useMemo(() => {
    if (readOnly && !inlineEditable) {
      return heroProductPlanFields.filter((f) => hasValue(f.key));
    }
    return heroProductPlanFields;
  }, [heroProductPlanFields, hasValue, inlineEditable, readOnly]);

  /** Referral rows for the snapshot; empty rows dropped in static read-only view. */
  const heroReferralSnapshotFields = useMemo(() => {
    const seen = new Set<string>();
    const fields = [heroReferralSourceField, heroReferringMemberField].filter(
      (f): f is CrmField => {
        if (!f || seen.has(f.key)) return false;
        seen.add(f.key);
        return true;
      },
    );
    if (readOnly && !inlineEditable) {
      return fields.filter((f) => hasValue(f.key));
    }
    return fields;
  }, [heroReferralSourceField, heroReferringMemberField, hasValue, inlineEditable, readOnly]);

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

    const staticView = readOnly && !inlineEditable;
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
                  renderFieldCell(heroSharingFieldForDisplay)
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
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
              {hasDetail && (
                <>
                  {divider}
                  <div
                    className="grid flex-1 gap-x-6 gap-y-0 border-t border-dashed pt-3 lg:border-0 lg:pt-0"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                  >
                    {heroProductPlanSnapshotFields.map((field) =>
                      renderFieldCell(field, { row: true, tightLabel: true }),
                    )}
                    {showDate &&
                      heroStartDateField &&
                      renderFieldCell(heroStartDateField, { row: true, tightLabel: true })}
                  </div>
                </>
              )}
              {hasReferral && (
                <>
                  {/* No divider before the referral cluster: with lg:flex-wrap it
                      may wrap to its own row when the column is narrow (e.g. the
                      insights rail is open), and a stray vertical rule would hang
                      off the end of the previous row. */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0 border-t border-dashed pt-3 sm:grid-cols-2 lg:w-56 lg:shrink-0 lg:grid-cols-1 lg:border-0 lg:pt-0">
                    {heroReferralSnapshotFields.map((field) =>
                      renderFieldCell(field, { row: true, tightLabel: true }),
                    )}
                  </div>
                </>
              )}
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
      {sections.map((section) => {
        const sectionFields = fieldsBySection[section.key] || [];
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
              className={cn(
                'cursor-pointer hover:bg-muted/50 transition-colors',
                accent.header,
                readOnly ? 'py-2 px-4' : 'py-3',
              )}
              onClick={() => toggleSection(section.key)}
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
            {!isCollapsed && (
              <CardContent className={readOnly ? 'pt-3 pb-3 px-4' : undefined}>
                {isHero ? (
                  // ──────────────────────────────────────────────────────────
                  // HERO LAYOUT — the section's own fields (Name, etc.) now get
                  // the full width. The coverage summary that used to sit in a
                  // narrow right sidebar here has moved to renderCoverageSnapshot()
                  // (the full-width banner pinned to the top of the record).
                  // Auto-pack into as many ~220px columns as the width allows.
                  // ──────────────────────────────────────────────────────────
                  <div
                    className={cn('grid', readOnly ? 'gap-x-6' : 'gap-x-5 gap-y-3')}
                    style={{
                      gridTemplateColumns: readOnly
                        ? 'repeat(auto-fit, minmax(220px, 1fr))'
                        : 'repeat(auto-fit, minmax(230px, 1fr))',
                    }}
                  >
                    {sectionFields.map((f) => renderFieldCell(f, { row: true }))}
                  </div>
                ) : sectionFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Coverage fields are not configured for this section. Ask an admin to
                    run coverage field parity, or use Edit to add fields in Settings.
                  </p>
                ) : (
                  <div
                    className={cn(
                      'grid',
                      readOnly
                        ? 'gap-x-6'
                        : 'gap-4',
                      !readOnly &&
                        (section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'),
                    )}
                    style={
                      readOnly
                        ? { gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }
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
      <div className="space-y-6">
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
