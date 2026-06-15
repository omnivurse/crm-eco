'use client';

/**
 * Record overview field stack — picks inline vs read-only rendering and wraps
 * the save provider when the classic shell is active (V2 shell already owns it).
 */

import type { CrmField, CrmLayout, CrmRecord } from '@/lib/crm/types';
import { RecordFieldSaveProvider } from '@/hooks/useRecordFieldSave';
import { isPersonModuleKey } from './section-utils';
import { DynamicRecordForm } from './DynamicRecordForm';
import { InlineEditableRecordForm } from './InlineEditableRecordForm';

export interface RecordOverviewFieldsProps {
  record: CrmRecord;
  fields: CrmField[];
  layout?: CrmLayout | null;
  defaultValues: Record<string, unknown>;
  moduleKey: string;
  /** When true, {@link RecordDetailShellV2} already wraps the page in a save provider. */
  layoutV2Shell: boolean;
}

export function RecordOverviewFields({
  record,
  fields,
  layout,
  defaultValues,
  moduleKey,
  layoutV2Shell,
}: RecordOverviewFieldsProps) {
  const inlineEditable = layoutV2Shell || isPersonModuleKey(moduleKey);

  const form = inlineEditable ? (
    <InlineEditableRecordForm
      record={record}
      fields={fields}
      layout={layout}
      defaultValues={defaultValues}
      moduleKey={moduleKey}
    />
  ) : (
    <DynamicRecordForm
      record={record}
      fields={fields}
      layout={layout}
      defaultValues={defaultValues}
      moduleKey={moduleKey}
      readOnly
    />
  );

  if (inlineEditable && !layoutV2Shell) {
    return (
      <RecordFieldSaveProvider
        recordId={record.id}
        initialUpdatedAt={record.updated_at ?? null}
        onSaved={() => {
          // Optimistic overlays handle display; avoid router.refresh() resetting
          // section accordion + scroll while editing family fields.
        }}
      >
        {form}
      </RecordFieldSaveProvider>
    );
  }

  return form;
}
