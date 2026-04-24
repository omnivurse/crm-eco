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
import { FieldRenderer } from './FieldRenderer';
import { InlineFieldCell } from './v2/InlineFieldCell';
import { AdvisorCarrierField } from './AdvisorCarrierField';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Section accent palette
// ---------------------------------------------------------------------------
// Each entry maps a `LayoutSectionAccent` key to Tailwind classes for the card
// border, the header background, and the title text. We deliberately use full
// class strings (no template interpolation) so Tailwind's JIT picks them up.

interface AccentClassSet {
  border: string;
  header: string;
  title: string;
  ring: string;
}

const ACCENT_CLASSES: Record<LayoutSectionAccent, AccentClassSet> = {
  slate: {
    border: 'border-slate-200 dark:border-slate-700',
    header: 'bg-slate-50/70 dark:bg-slate-800/40',
    title: 'text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-200/60 dark:ring-slate-700/60',
  },
  emerald: {
    border: 'border-emerald-200 dark:border-emerald-700/40',
    header: 'bg-emerald-50/70 dark:bg-emerald-500/10',
    title: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200/60 dark:ring-emerald-700/40',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-700/40',
    header: 'bg-blue-50/70 dark:bg-blue-500/10',
    title: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-200/60 dark:ring-blue-700/40',
  },
  cyan: {
    border: 'border-cyan-200 dark:border-cyan-700/40',
    header: 'bg-cyan-50/70 dark:bg-cyan-500/10',
    title: 'text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-200/60 dark:ring-cyan-700/40',
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-700/40',
    header: 'bg-purple-50/70 dark:bg-purple-500/10',
    title: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-200/60 dark:ring-purple-700/40',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-700/40',
    header: 'bg-amber-50/70 dark:bg-amber-500/10',
    title: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200/60 dark:ring-amber-700/40',
  },
  rose: {
    border: 'border-rose-200 dark:border-rose-700/40',
    header: 'bg-rose-50/70 dark:bg-rose-500/10',
    title: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-200/60 dark:ring-rose-700/40',
  },
  pink: {
    border: 'border-pink-200 dark:border-pink-700/40',
    header: 'bg-pink-50/70 dark:bg-pink-500/10',
    title: 'text-pink-700 dark:text-pink-300',
    ring: 'ring-pink-200/60 dark:ring-pink-700/40',
  },
  indigo: {
    border: 'border-indigo-200 dark:border-indigo-700/40',
    header: 'bg-indigo-50/70 dark:bg-indigo-500/10',
    title: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-200/60 dark:ring-indigo-700/40',
  },
};

const getAccent = (accent?: LayoutSectionAccent): AccentClassSet =>
  ACCENT_CLASSES[accent ?? 'slate'];

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

    case 'number':
    case 'currency':
      input = (
        <Input
          {...commonProps}
          type="number"
          step={field.type === 'currency' ? '0.01' : '1'}
        />
      );
      break;

    case 'date': {
      // Sanitize: ISO timestamps (e.g. "2026-02-05T00:00:00.000Z") must be
      // truncated to "yyyy-MM-dd" for <input type="date">
      const dateValue = typeof value === 'string' && value
        ? value.slice(0, 10)
        : (value as string) || '';
      input = (
        <Input
          {...commonProps}
          type="date"
          value={dateValue}
          onChange={(e) => setValue(field.key, e.target.value)}
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
              {getFieldOptions(field.options).map((option) => (
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
          {getFieldOptions(field.options).map((option) => (
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
    },
    ref
  ) {
  // notes_history is legacy imported HTML rendered by LegacyNotesCard on detail views
  const visibleFields = useMemo(() => fields.filter(f => f.key !== 'notes_history'), [fields]);

  const layoutConfig = layout?.config || { sections: [{ key: 'main', label: 'Information', columns: 2 }] };
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(
      (layoutConfig.sections || [])
        .filter((s: LayoutSection) => s.collapsed)
        .map((s: LayoutSection) => s.key)
    )
  );

  // Build dynamic Zod schema based on fields
  const schema = useMemo(() => {
    const schemaShape: Record<string, z.ZodType> = {};

    for (const field of visibleFields) {
      let fieldSchema: z.ZodType;

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
        case 'datetime':
          fieldSchema = z.string();
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
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedSections(newCollapsed);
  };

  // Build the effective section list: start with layout sections, then append any
  // field-section keys that aren't covered (handles seed/migration section mismatch)
  const sections = useMemo(() => {
    const layoutSections = layoutConfig.sections || [{ key: 'main', label: 'General', columns: 2 }];
    const coveredKeys = new Set(layoutSections.map((s: LayoutSection) => s.key));

    // Find sections present in field data but not in the layout
    const extraSections: LayoutSection[] = [];
    for (const sectionKey of Object.keys(fieldsBySection)) {
      if (!coveredKeys.has(sectionKey)) {
        extraSections.push({
          key: sectionKey,
          label: sectionKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          columns: 2,
        });
      }
    }

    return [...layoutSections, ...extraSections];
  }, [layoutConfig.sections, fieldsBySection]);

  const handleFormSubmit = onSubmit ? handleSubmit(onSubmit) : undefined;

  // Helper: a single field cell (label + input or read-only renderer)
  const renderFieldCell = useCallback(
    (field: CrmField) => (
      <div
        key={field.key}
        className={cn(field.width === 'full' && 'md:col-span-2')}
      >
        <Label
          htmlFor={field.key}
          className="mb-1 block text-muted-foreground text-xs uppercase tracking-wider"
        >
          {field.label}
          {!readOnly && field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {readOnly ? (
          <div className="py-0.5 text-sm min-h-[24px]">
            {inlineEditable ? (
              <InlineFieldCell
                field={field}
                value={defaultValues[field.key]}
              />
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
        )}
      </div>
    ),
    [control, defaultValues, errors, inlineEditable, readOnly, register, setValue],
  );

  // Find the "hero summary" fields anywhere in the field list — they don't
  // need to live in the hero section to be surfaced there.
  const heroSharingField = useMemo(
    () => visibleFields.find((f) => f.key === 'sharing_entity'),
    [visibleFields],
  );
  const heroStartDateField = useMemo(
    () => visibleFields.find((f) => f.key === 'sharing_effective_date'),
    [visibleFields],
  );

  const renderSections = () => (
    <>
      {sections.map((section) => {
        const sectionFields = fieldsBySection[section.key] || [];
        const isHero = section.variant === 'hero';
        // Hero is allowed to render even with zero fields (e.g. lean Members
        // module) because it always shows the right-hand summary.
        if (sectionFields.length === 0 && !isHero) return null;

        // In readOnly mode, skip sections where every field is empty
        if (readOnly && !isHero) {
          const hasAnyValue = sectionFields.some(
            (f) => defaultValues[f.key] !== null && defaultValues[f.key] !== undefined && defaultValues[f.key] !== ''
          );
          if (!hasAnyValue) return null;
        }

        const isCollapsed = collapsedSections.has(section.key);
        const accent = getAccent(section.accent);

        return (
          <Card
            key={section.key}
            id={`section-${section.key}`}
            data-section={section.key}
            className={cn('break-inside-avoid border', accent.border)}
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
                  <span className="text-muted-foreground font-normal text-xs">
                    ({sectionFields.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className={readOnly ? 'pt-3 pb-3 px-4' : undefined}>
                {isHero ? (
                  // ──────────────────────────────────────────────────────────
                  // HERO LAYOUT
                  //   Left column  → the section's own fields (Name, etc.)
                  //   Right column → Health Share Name + Start Date summary,
                  //                  editable inline via the same form state.
                  // ──────────────────────────────────────────────────────────
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                        {sectionFields.map(renderFieldCell)}
                      </div>
                    </div>
                    <div className="md:col-span-1">
                      <div
                        className={cn(
                          'rounded-lg border p-4 h-full space-y-3 ring-1',
                          getAccent('emerald').border,
                          getAccent('emerald').header,
                          getAccent('emerald').ring,
                        )}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          Membership Snapshot
                        </p>
                        {heroSharingField ? (
                          renderFieldCell(heroSharingField)
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No Health Share field configured
                          </p>
                        )}
                        {heroStartDateField ? (
                          renderFieldCell(heroStartDateField)
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No Start Date field configured
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'grid',
                      readOnly
                        ? 'grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5'
                        : 'gap-4',
                      !readOnly &&
                        (section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'),
                    )}
                  >
                    {sectionFields.map(renderFieldCell)}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </>
  );

  // Read-only mode: render as plain div without form or actions
  // Use CSS columns (not grid) so collapsed cards truly shrink and siblings flow up
  if (readOnly) {
    return (
      <div className="columns-1 lg:columns-2 xl:columns-2 gap-3 space-y-3">
        {renderSections()}
      </div>
    );
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
