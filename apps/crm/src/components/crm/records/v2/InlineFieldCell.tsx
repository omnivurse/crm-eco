'use client';

/**
 * InlineFieldCell — dispatches to the right inline editor variant based
 * on a CrmField's type. This is the single entry point that
 * `DynamicRecordForm` uses when `inlineEditable=true`, so callers don't
 * need to branch on field type themselves.
 *
 * Field types that don't yet have an inline editor (multiselect, user,
 * lookup, carrier, rich-text) fall back to the existing read-only
 * `FieldRenderer`. The goal is graceful degradation, not blocking the
 * rollout on long-tail field types — those ship as follow-on PRs.
 */

import { memo, useMemo } from 'react';
import type { CrmField } from '@/lib/crm/types';
import { getFieldOptions } from '@/lib/crm/utils';
import type { FieldSaveTarget } from '@/hooks/useRecordFieldSave';
import { FieldRenderer } from '../FieldRenderer';
import { InlineFieldEditor } from './InlineFieldEditor';
import { InlineSelectField } from './InlineSelectField';
import { InlineDateField } from './InlineDateField';
import { InlineBooleanField } from './InlineBooleanField';
import { InlineMultiSelectField } from './InlineMultiSelectField';
import { InlineLookupField } from './InlineLookupField';
import { InlineCarrierField } from './InlineCarrierField';

export interface InlineFieldCellProps {
  field: CrmField;
  value: unknown;
  /** Row column vs JSONB data. Defaults to auto-detect in the save hook. */
  target?: FieldSaveTarget;
  readOnly?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
}

export const InlineFieldCell = memo(function InlineFieldCell({
  field,
  value,
  target,
  readOnly,
  onEditStart,
  onEditEnd,
  className,
}: InlineFieldCellProps) {
  const selectOptions = useMemo(() => {
    if (field.type !== 'select' && field.type !== 'picklist') return [];
    const raw = getFieldOptions(field.options);
    return raw.map((v) => ({ value: v, label: v }));
  }, [field]);

  // Legacy imported HTML rendered elsewhere — keep read-only.
  if (field.type === 'text' && field.key === 'notes_history') {
    return (
      <span className={className}>
        <FieldRenderer field={field} value={value} />
      </span>
    );
  }

  const common = {
    field: field.key,
    target,
    readOnly,
    onEditStart,
    onEditEnd,
    ariaLabel: field.label,
    className,
  };

  // Carrier-typed fields (metadata.carrier_type) override their base
  // type and render as an advisor-carrier picker regardless of whether
  // the base type is 'text' or 'select'.
  if (field.metadata?.carrier_type) {
    return (
      <InlineCarrierField
        {...common}
        value={value == null ? null : String(value)}
        carrierType={field.metadata.carrier_type}
        placeholder={`Select ${field.label.toLowerCase()}`}
      />
    );
  }

  switch (field.type) {
    case 'boolean':
      return (
        <InlineBooleanField
          {...common}
          value={typeof value === 'boolean' ? value : value === 'true' ? true : null}
          labels={{ on: 'Yes', off: 'No' }}
        />
      );

    case 'select':
    case 'picklist':
      return (
        <InlineSelectField
          {...common}
          value={value == null ? null : String(value)}
          options={selectOptions}
          placeholder={`Select ${field.label.toLowerCase()}`}
        />
      );

    case 'date':
      return (
        <InlineDateField
          {...common}
          value={value == null ? null : String(value)}
          mode="date"
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );

    case 'datetime':
      return (
        <InlineDateField
          {...common}
          value={value == null ? null : String(value)}
          mode="datetime"
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );

    case 'textarea':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="textarea"
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );

    case 'multiselect':
      return (
        <InlineMultiSelectField
          {...common}
          value={Array.isArray(value) ? (value as string[]) : value == null ? [] : [String(value)]}
          options={getFieldOptions(field.options)}
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );

    case 'user':
      return (
        <InlineLookupField
          {...common}
          value={value == null ? null : String(value)}
          kind="user"
          placeholder={`Search ${field.label.toLowerCase()}`}
        />
      );

    case 'lookup':
      return (
        <InlineLookupField
          {...common}
          value={value == null ? null : String(value)}
          kind="lookup"
          targetModuleKey={
            Array.isArray(field.options) && field.options.length > 0
              ? String(field.options[0])
              : typeof field.options === 'string'
                ? (field.options as string)
                : null
          }
          placeholder={`Search ${field.label.toLowerCase()}`}
        />
      );

    case 'email':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="email"
          placeholder={`Add ${field.label.toLowerCase()}`}
          validate={(v) => {
            if (!v) return null;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email';
          }}
        />
      );

    case 'phone':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="tel"
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );

    case 'url':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="url"
          placeholder={`Add ${field.label.toLowerCase()}`}
          validate={(v) => {
            if (!v) return null;
            try {
              new URL(v);
              return null;
            } catch {
              return 'Invalid URL';
            }
          }}
        />
      );

    case 'number':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="number"
          placeholder={`Add ${field.label.toLowerCase()}`}
          validate={(v) =>
            v === '' || !Number.isNaN(Number(v)) ? null : 'Must be a number'
          }
        />
      );

    case 'currency':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="number"
          placeholder={`Add ${field.label.toLowerCase()}`}
          validate={(v) =>
            v === '' || !Number.isNaN(Number(v)) ? null : 'Must be a number'
          }
          display={(v) => {
            const num = v == null ? NaN : Number(v);
            if (Number.isNaN(num)) return null;
            return (
              <span className="font-medium">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(num)}
              </span>
            );
          }}
        />
      );

    case 'text':
    default:
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="text"
          placeholder={`Add ${field.label.toLowerCase()}`}
        />
      );
  }
});
