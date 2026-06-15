'use client';

/**
 * Wraps `DynamicRecordForm` for V2 inline editing: keeps form display values in
 * sync with successful PATCHes so reps do not see fields snap back to stale
 * server props while `router.refresh()` is in flight.
 */

import { useEffect, useRef, useState } from 'react';
import type { CrmField, CrmLayout, CrmRecord } from '@/lib/crm/types';
import { useRecordFieldSave } from '@/hooks/useRecordFieldSave';
import { DynamicRecordForm } from './DynamicRecordForm';

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
  const [formValues, setFormValues] = useState(defaultValues);
  const appliedSaveAtRef = useRef<Record<string, number>>({});

  // Full server refresh — merge without clobbering fields the rep is still editing.
  useEffect(() => {
    setFormValues((prev) => {
      const merged = { ...defaultValues };
      for (const [key, state] of Object.entries(saveFields)) {
        if (state.status === 'pending' || state.status === 'saving') {
          merged[key] = prev[key];
        } else if (
          state.status === 'saved' &&
          state.savedAt &&
          state.lastValue !== undefined
        ) {
          merged[key] = state.lastValue;
        }
      }
      return merged;
    });
  }, [record.updated_at, defaultValues, saveFields]);

  // Optimistic overlay per successful inline save (before RSC re-fetch completes).
  useEffect(() => {
    setFormValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, state] of Object.entries(saveFields)) {
        if (state.status !== 'saved' || !state.savedAt || state.lastValue === undefined) {
          continue;
        }
        if (appliedSaveAtRef.current[key] === state.savedAt) continue;
        appliedSaveAtRef.current[key] = state.savedAt;
        next[key] = state.lastValue;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [saveFields]);

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
