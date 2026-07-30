'use client';

/**
 * Wraps `DynamicRecordForm` for V2 inline editing: keeps form display values in
 * sync with successful PATCHes so reps do not see fields snap back to stale
 * server props while `router.refresh()` is in flight.
 */

import { useMemo } from 'react';
import type { CrmField, CrmLayout, CrmRecord } from '@/lib/crm/types';
import { useRecordFieldSave } from '@/hooks/useRecordFieldSave';
import { DynamicRecordForm } from './DynamicRecordForm';

/**
 * Whether a just-saved value should be considered "already reflected" by the
 * incoming server prop. Used to decide when the optimistic overlay can be
 * dropped in favour of the server value. Treats null / undefined / '' as one
 * equivalent "empty" so a field cleared to '' converges once the server
 * returns null, and compares arrays (multiselect) element-wise.
 *
 * Exported so every surface that overlays inline saves on server props
 * (form values, section fill badges, header fields) shares one convergence
 * rule instead of drifting apart.
 */
export function serverHasCaughtUp(serverValue: unknown, savedValue: unknown): boolean {
  if (serverValue === savedValue) return true;
  if (Array.isArray(serverValue) && Array.isArray(savedValue)) {
    return (
      serverValue.length === savedValue.length &&
      serverValue.every((v, i) => v === savedValue[i])
    );
  }
  const serverEmpty =
    serverValue === null || serverValue === undefined || serverValue === '';
  const savedEmpty =
    savedValue === null || savedValue === undefined || savedValue === '';
  if (serverEmpty && savedEmpty) return true;
  // Numeric fields round-trip as strings in JSONB but back as numbers on the
  // row; compare loosely so "12" and 12 count as caught up.
  if (
    (typeof serverValue === 'number' || typeof serverValue === 'string') &&
    (typeof savedValue === 'number' || typeof savedValue === 'string') &&
    String(serverValue) === String(savedValue)
  ) {
    return true;
  }
  return false;
}

export interface InlineEditableRecordFormProps {
  record: CrmRecord;
  fields: CrmField[];
  layout?: CrmLayout | null;
  defaultValues: Record<string, unknown>;
  moduleKey?: string;
}

export function InlineEditableRecordForm({
  record,
  fields,
  layout,
  defaultValues,
  moduleKey,
}: InlineEditableRecordFormProps) {
  const { fields: saveFields } = useRecordFieldSave();

  // Reconcile server props with in-flight / recently-saved inline edits.
  //
  // Derived (not effect-synced) state: the display value for each field is the
  // server prop, overlaid with any inline save the server hasn't reflected yet.
  //
  // The optimistic overlay must be *durable*: `useRecordFieldSave` clears a
  // field's status from `saved` → `idle` ~4s after the PATCH resolves, but the
  // server prop (`defaultValues`) only updates when the parent triggers a
  // `router.refresh()`. On the classic detail shell the save provider has no
  // `onSaved` refresh, so keying the overlay on `status === 'saved'` made every
  // inline edit snap back to the stale server value 4s later — the change was
  // persisted in the DB but appeared to "revert". We therefore keep applying a
  // field's last-saved value until the incoming server prop actually reflects
  // it (`serverHasCaughtUp`), at which point the server value takes over again.
  const formValues = useMemo(() => {
    const merged = { ...defaultValues };
    for (const [key, state] of Object.entries(saveFields)) {
      // `lastValue` is only populated on a successful save. While a field is
      // pending/saving its last *successful* value keeps showing (so the field
      // doesn't flash the stale server value mid-flight); once idle we keep it
      // sticky until the server prop catches up.
      if (state.lastValue === undefined) continue;
      if (
        state.status === 'pending' ||
        state.status === 'saving' ||
        !serverHasCaughtUp(defaultValues[key], state.lastValue)
      ) {
        merged[key] = state.lastValue;
      }
    }
    return merged;
  }, [defaultValues, saveFields, record.id]);

  return (
    <DynamicRecordForm
      record={record}
      fields={fields}
      layout={layout}
      defaultValues={formValues}
      moduleKey={moduleKey}
      readOnly
      inlineEditable
    />
  );
}
