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

  // Fields with custom resolvers (carriers, lookups, users, rich text)
  // aren't safe to round-trip through a simple inline editor yet. Render
  // read-only with the existing FieldRenderer so the UI stays accurate.
  const hasCustomRenderer =
    !!field.metadata?.carrier_type ||
    field.type === 'user' ||
    field.type === 'lookup' ||
    field.type === 'multiselect' ||
    (field.type === 'text' && field.key === 'notes_history');

  if (hasCustomRenderer) {
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
