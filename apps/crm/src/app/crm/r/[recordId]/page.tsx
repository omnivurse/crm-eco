import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  getRecordWithModule,
  getFieldsForModule,
  getDefaultLayout,
  getNotesForRecord,
  getTimelineForRecord,
  getRecordLinks,
  getAttachmentsForRecord,
  getDealStages,
  getCurrentProfile,
} from '@/lib/crm/queries';
import { RecordDetailShell } from '@/components/crm/records/RecordDetailShell';
import { RecordTimeline } from '@/components/crm/records/RecordTimeline';
import { AttachmentsPanel } from '@/components/crm/records/AttachmentsPanel';
import { RelatedRecordsPanel } from '@/components/crm/records/RelatedRecordsPanel';
import { DynamicRecordForm } from '@/components/crm/records/DynamicRecordForm';
import { NotesPanel } from './NotesPanel';
import { NotesOverviewCard } from './NotesOverviewCard';
import { LegacyNotesCard } from './LegacyNotesCard';

interface PageProps {
  params: { recordId: string };
}

async function RecordDetailContent({ params }: PageProps) {
  const { recordId } = params;

  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const result = await getRecordWithModule(recordId);
  if (!result) return notFound();

  const { record, module } = result;

  // Fetch all related data in parallel
  const [fields, layout, notes, timeline, linkedRecords, attachments, stages] = await Promise.all([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecord(recordId),
    getTimelineForRecord(recordId),
    getRecordLinks(recordId),
    getAttachmentsForRecord(recordId),
    module.key === 'deals' ? getDealStages(profile.organization_id) : Promise.resolve([]),
  ]);

  // Build defaultValues by merging JSONB data with top-level indexed columns
  // so email, phone, and status are visible even if not duplicated inside data
  const defaultValues: Record<string, unknown> = {
    ...record.data,
    ...(record.email && !record.data?.email && { email: record.email }),
    ...(record.phone && !record.data?.phone && { phone: record.phone }),
    ...(record.status && !record.data?.contact_status && { contact_status: record.status }),
  };

  return (
    <RecordDetailShell
      record={record}
      module={module}
      fields={fields}
      stages={stages}
      noteCount={notes.length}
      className="h-[calc(100vh-64px)]"
    >
      {{
        overview: ({ switchTab }) => (
          <div className="space-y-6">
            {/* Notes - Prime Real Estate */}
            <NotesOverviewCard
              notes={notes}
              recordId={recordId}
              onViewAll={() => switchTab('notes')}
            />

            {/* Legacy Notes History (imported from Zoho) */}
            {typeof record.data?.notes_history === 'string' && record.data.notes_history.trim() !== '' && (
              <LegacyNotesCard notesHtml={record.data.notes_history} />
            )}

            {/* Record Details Form */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Record Details</h3>
              <DynamicRecordForm
                record={record}
                fields={fields}
                layout={layout}
                defaultValues={defaultValues}
                readOnly
              />
            </div>
          </div>
        ),

        related: (
          <RelatedRecordsPanel
            recordId={recordId}
            linkedRecords={linkedRecords}
          />
        ),

        timeline: (
          <RecordTimeline
            events={timeline}
          />
        ),

        notes: (
          <NotesPanel
            recordId={recordId}
            notes={notes}
            orgId={profile.organization_id}
          />
        ),

        attachments: (
          <AttachmentsPanel
            recordId={recordId}
            attachments={attachments}
          />
        ),
      }}
    </RecordDetailShell>
  );
}

export default function RecordDetailPage(props: PageProps) {
  return (
    <Suspense fallback={<RecordDetailSkeleton />}>
      <RecordDetailContent {...props} />
    </Suspense>
  );
}

function RecordDetailSkeleton() {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      <div className="flex-1 overflow-hidden">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-slate-950/80 border-b border-slate-200 dark:border-white/5 p-6">
          <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
              <div className="space-y-2">
                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex gap-4">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-24 bg-slate-100 dark:bg-slate-800/50 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 animate-pulse" />
          <div className="h-48 bg-slate-100 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 animate-pulse" />
        </div>
      </div>

      {/* Rail skeleton */}
      <div className="w-64 border-l border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 p-4 animate-pulse">
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
