'use client';

/**
 * Lead overview panel — section pills + inline field stack with live filled-count
 * updates as reps save coverage fields (no full page refresh required).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CrmField, CrmLayout, CrmRecord } from '@/lib/crm/types';
import { RecordFieldSaveProvider, useRecordFieldSaveOptional } from '@/hooks/useRecordFieldSave';
import { getSectionMeta, isPersonModuleKey } from './section-utils';
import { OverviewLayout } from './OverviewLayout';
import { RecordOverviewFields } from './RecordOverviewFields';

export interface RecordOverviewPanelProps {
  recordId: string;
  record: CrmRecord;
  fields: CrmField[];
  layout?: CrmLayout | null;
  defaultValues: Record<string, unknown>;
  moduleKey: string;
  layoutV2Shell: boolean;
  /** Optional content below the field stack (e.g. legacy notes). */
  belowFields?: ReactNode;
}

function LiveSectionOverview({
  recordId,
  record,
  fields,
  layout,
  defaultValues,
  moduleKey,
  layoutV2Shell,
  belowFields,
}: RecordOverviewPanelProps) {
  const saveCtx = useRecordFieldSaveOptional();
  const [liveValues, setLiveValues] = useState(defaultValues);

  useEffect(() => {
    setLiveValues(defaultValues);
  }, [record.updated_at, defaultValues]);

  useEffect(() => {
    if (!saveCtx) return;
    setLiveValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [key, state] of Object.entries(saveCtx.fields)) {
        if (state.status !== 'saved' || state.lastValue === undefined) continue;
        if (next[key] !== state.lastValue) {
          next[key] = state.lastValue;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [saveCtx?.fields]);

  const sections = useMemo(
    () => getSectionMeta(fields, layout, liveValues, moduleKey),
    [fields, layout, liveValues, moduleKey],
  );

  return (
    <OverviewLayout
      recordId={recordId}
      sections={sections}
      fieldContent={
        <>
          <RecordOverviewFields
            record={record}
            fields={fields}
            layout={layout}
            defaultValues={defaultValues}
            moduleKey={moduleKey}
            layoutV2Shell={layoutV2Shell}
            saveProviderWrapped
          />
          {belowFields}
        </>
      }
    />
  );
}

export function RecordOverviewPanel(props: RecordOverviewPanelProps) {
  const needsOwnProvider =
    !props.layoutV2Shell && isPersonModuleKey(props.moduleKey);

  const panel = <LiveSectionOverview {...props} />;

  if (!needsOwnProvider) {
    return panel;
  }

  return (
    <RecordFieldSaveProvider
      recordId={props.record.id}
      initialUpdatedAt={props.record.updated_at ?? null}
    >
      {panel}
    </RecordFieldSaveProvider>
  );
}
