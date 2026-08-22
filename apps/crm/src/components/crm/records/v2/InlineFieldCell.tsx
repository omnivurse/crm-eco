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

import { memo, useMemo, type ReactNode } from 'react';
import type { CrmField } from '@/lib/crm/types';
import { getFieldOptions } from '@/lib/crm/utils';
import { describeRecordedAge, householdAgeSlot } from '@/lib/crm/household-age';
import { formatPhoneOwnerLabel, isCleanPhoneValue } from '@/lib/crm/phone-owner';
import type { FieldSaveTarget } from '@/hooks/useRecordFieldSave';
import { FieldRenderer } from '../FieldRenderer';
import { InlineFieldEditor } from './InlineFieldEditor';
import { InlineSelectField } from './InlineSelectField';
import { InlineDateField } from './InlineDateField';
import { InlineBooleanField } from './InlineBooleanField';
import { InlineMultiSelectField } from './InlineMultiSelectField';
import { InlineLookupField } from './InlineLookupField';
import { InlineCarrierField } from './InlineCarrierField';
import {
  fieldUsesDecimalMoney,
  formatCurrencyDisplay,
  isValidCurrencyTyping,
  parseCurrencyInput,
} from '@/lib/crm/currency-input';
import {
  isCarrierIdentityField,
  resolveInlineCarrierType,
} from '@/lib/crm/carrier-field';

/**
 * Render a money value for a click-to-edit cell.
 *
 * Guards against `Number('') === 0`: a blank / unset amount shows the "—"
 * placeholder instead of "$0.00" (legacy Zoho JSONB frequently stores "" for an
 * unset amount, which previously surfaced as "$0.00" on the coverage snapshot).
 * A genuine `0` still renders "$0.00".
 */
function renderMoneyDisplay(value: string | number | null | undefined): ReactNode {
  const formatted = formatCurrencyDisplay(value);
  if (formatted === null) {
    return <span className="text-slate-400 dark:text-slate-500">—</span>;
  }
  return <span className="font-medium">{formatted}</span>;
}

export interface InlineFieldCellProps {
  field: CrmField;
  value: unknown;
  /** Row column vs JSONB data. Defaults to auto-detect in the save hook. */
  target?: FieldSaveTarget;
  readOnly?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  className?: string;
  /** Sibling values for phone owner badges (merged record data). */
  relatedValues?: Record<string, unknown> | null;
}

export const InlineFieldCell = memo(function InlineFieldCell({
  field,
  value,
  target,
  readOnly,
  onEditStart,
  onEditEnd,
  className,
  relatedValues,
}: InlineFieldCellProps) {
  const selectOptions = useMemo(() => {
    if (field.type !== 'select' && field.type !== 'picklist') return [];
    const raw = getFieldOptions(field.options, field.key);
    return raw.map((v) => ({ value: v, label: v }));
  }, [field]);

  // Legacy notes_history HTML is owned by LegacyNotesCard / Notes tab.
  // If it ever reaches this cell, keep it read-only (never inline-edit).
  if (field.key === 'notes_history') {
    return (
      <span className={className}>
        <FieldRenderer field={field} value={value} relatedValues={relatedValues} />
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

  // Carrier identity (metadata.carrier_type OR indexed `carrier_id`).
  // Live crm_fields still types `carrier_id` as lookup; that UUID is an
  // insurance_carriers.id (e.g. Sedera HealthShare), not a crm_records.id.
  if (isCarrierIdentityField(field)) {
    return (
      <InlineCarrierField
        {...common}
        value={value == null ? null : String(value)}
        carrierType={resolveInlineCarrierType(field, relatedValues)}
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
          options={getFieldOptions(field.options, field.key)}
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

    case 'phone': {
      const ownerLabel = formatPhoneOwnerLabel(field.key, relatedValues);
      return (
        <span className="inline-flex flex-col min-w-0 w-full">
          <InlineFieldEditor
            {...common}
            value={value == null ? '' : String(value)}
            type="tel"
            placeholder={`Add ${field.label.toLowerCase()}`}
            validate={(v) => {
              if (!v) return null;
              return isCleanPhoneValue(v)
                ? null
                : 'Digits only — put names in Owner Name';
            }}
          />
          {ownerLabel ? (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {ownerLabel}
            </span>
          ) : null}
        </span>
      );
    }

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
      if (fieldUsesDecimalMoney(field)) {
        return (
          <InlineFieldEditor
            {...common}
            value={value == null ? '' : String(value)}
            type="text"
            moneyDecimals={2}
            // Short empty cue — avoid echoing the label (e.g. "Add annual deductible")
            // which collided with the dense left-hand label column.
            placeholder="—"
            validate={(v) => {
              if (v === '') return null;
              if (!isValidCurrencyTyping(v)) return 'Enter up to 2 decimal places';
              const n = parseCurrencyInput(v);
              return n == null ? 'Must be a number' : null;
            }}
            display={renderMoneyDisplay}
          />
        );
      }
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="number"
          placeholder={`Add ${field.label.toLowerCase()}`}
          validate={(v) => {
            if (v === '') return null;
            const n = Number(v);
            if (Number.isNaN(n)) return 'Must be a number';
            const { min, max } = field.validation ?? {};
            if (min !== undefined && n < min) return `Must be at least ${min}`;
            if (max !== undefined && n > max) return `Must be at most ${max}`;
            return null;
          }}
          // Household ages: show what the recorded age most likely is today
          // (person modules render through this cell, not FieldRenderer).
          display={
            householdAgeSlot(field.key) && value != null && value !== ''
              ? (v) => {
                  const recorded = describeRecordedAge(field.key, v, relatedValues);
                  if (!recorded) return String(v ?? '');
                  return (
                    <>
                      {recorded.stored}
                      {recorded.hint && (
                        <span className="ml-1.5 text-xs text-muted-foreground">{recorded.hint}</span>
                      )}
                    </>
                  );
                }
              : undefined
          }
        />
      );

    case 'currency':
      return (
        <InlineFieldEditor
          {...common}
          value={value == null ? '' : String(value)}
          type="text"
          moneyDecimals={2}
          placeholder="—"
          validate={(v) => {
            if (v === '') return null;
            if (!isValidCurrencyTyping(v)) return 'Enter up to 2 decimal places';
            const n = parseCurrencyInput(v);
            return n == null ? 'Must be a number' : null;
          }}
          display={renderMoneyDisplay}
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
