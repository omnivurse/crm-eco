'use client';

/**
 * Lead overview panel — section pills + inline field stack with live filled-count
 * updates as reps save coverage fields (no full page refresh required).
 */

import { useMemo, type ReactNode } from 'react';
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
  /**
   * Real note-record count (crm_notes + legacy entries). Feeds the notes-group
   * section pill so it mirrors the sidebar's Notes count instead of a field-fill
   * count. Same value passed as the shell's `noteCount`.
   */
  noteCount?: number;
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
  noteCount,
  belowFields,
}: RecordOverviewPanelProps) {
  const saveCtx = useRecordFieldSaveOptional();

  // Live field values = record defaults overlaid with any values the rep has
  // inline-saved this session (tracked in the save context). Derived during
  // render so section fill-counts stay current without a useState + two syncing
  // effects — which triggered cascading-render lint and left the badges a frame
  // behind. defaultValues gets a fresh reference on every record refresh, so it
  // alone captures server updates.
  const liveValues = useMemo(() => {
    const next: Record<string, unknown> = { ...defaultValues };
    if (saveCtx) {
      for (const [key, state] of Object.entries(saveCtx.fields)) {
        if (state.status === 'saved' && state.lastValue !== undefined) {
          next[key] = state.lastValue;
        }
      }
    }
    return next;
  }, [defaultValues, saveCtx]);

  const inlineEditable = layoutV2Shell || isPersonModuleKey(moduleKey);

  const sections = useMemo(
    () =>
      getSectionMeta(fields, layout, liveValues, moduleKey, {
        inlineEditable,
        noteCount,
      }),
    [fields, layout, liveValues, moduleKey, inlineEditable, noteCount],
  );

  return (
    <OverviewLayout
      recordId={recordId}
      sections={sections}
      showSectionNav
      navVariant={layoutV2Shell ? 'compact' : 'pills'}
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
