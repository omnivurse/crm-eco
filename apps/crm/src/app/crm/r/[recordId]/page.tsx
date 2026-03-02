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
import { DynamicRecordForm, getSectionMeta } from '@/components/crm/records/DynamicRecordForm';
import { OverviewLayout } from '@/components/crm/records/OverviewLayout';
import { NotesPanel } from './NotesPanel';
import { NotesOverviewCard } from './NotesOverviewCard';
import { LegacyNotesCard } from './LegacyNotesCard';

interface PageProps {
  params: Promise<{ recordId: string }>;
}

/** Lazy-loaded timeline tab — fetches data only when streamed */
async function LazyTimeline({ recordId }: { recordId: string }) {
  const timeline = await getTimelineForRecord(recordId);
  return <RecordTimeline events={timeline} />;
}

/** Lazy-loaded related records tab */
async function LazyRelatedRecords({ recordId }: { recordId: string }) {
  const linkedRecords = await getRecordLinks(recordId);
  return <RelatedRecordsPanel recordId={recordId} linkedRecords={linkedRecords} />;
}

/** Lazy-loaded attachments tab */
async function LazyAttachments({ recordId }: { recordId: string }) {
  const attachments = await getAttachmentsForRecord(recordId);
  return <AttachmentsPanel recordId={recordId} attachments={attachments} />;
}

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
      <div className="h-32 bg-slate-100 dark:bg-slate-800/30 rounded-xl" />
      <div className="h-32 bg-slate-100 dark:bg-slate-800/30 rounded-xl" />
    </div>
  );
}

async function RecordDetailContent({ params }: PageProps) {
  const { recordId } = await params;

  // Step 1: Parallelize profile and record+module (no dependency between them)
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[RecordDetail] Failed to get profile:', err);
    return notFound();
  }

  if (!profile) return notFound();

  const result = await getRecordWithModule(recordId);
  if (!result) return notFound();

  const { record, module } = result;

  // Step 2: Fetch overview-critical data in parallel with safe error handling
  const [fieldsResult, layoutResult, notesResult, stagesResult] = await Promise.allSettled([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecord(recordId),
    module.key === 'deals' ? getDealStages(profile.organization_id) : Promise.resolve([]),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const layout = layoutResult.status === 'fulfilled' ? layoutResult.value : null;
  const notes = notesResult.status === 'fulfilled' ? notesResult.value : [];
  const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];

  // Build defaultValues by merging JSONB data with top-level indexed columns
  // so email, phone, and status are visible even if not duplicated inside data
  const defaultValues: Record<string, unknown> = {
    ...record.data,
    ...(record.email && !record.data?.email && { email: record.email }),
    ...(record.phone && !record.data?.phone && { phone: record.phone }),
    ...(record.status && !record.data?.contact_status && { contact_status: record.status }),
  };

  // Compute section metadata on the server for the section navigator
  const sectionMeta = getSectionMeta(fields, layout);

  const legacyNotes =
    typeof record.data?.notes_history === 'string' && record.data.notes_history.trim() !== ''
      ? record.data.notes_history
      : null;

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
        overview: (
          <OverviewLayout
            sections={sectionMeta}
            fieldContent={
              <DynamicRecordForm
                record={record}
                fields={fields}
                layout={layout}
                defaultValues={defaultValues}
                readOnly
              />
            }
            notesContent={
              <>
                <NotesOverviewCard notes={notes} recordId={recordId} />
                {legacyNotes && <LegacyNotesCard notesHtml={legacyNotes} />}
              </>
            }
          />
        ),

        related: (
          <Suspense fallback={<TabSkeleton />}>
            <LazyRelatedRecords recordId={recordId} />
          </Suspense>
        ),

        timeline: (
          <Suspense fallback={<TabSkeleton />}>
            <LazyTimeline recordId={recordId} />
          </Suspense>
        ),

        notes: (
          <NotesPanel
            recordId={recordId}
            notes={notes}
            orgId={profile.organization_id}
          />
        ),

        attachments: (
          <Suspense fallback={<TabSkeleton />}>
            <LazyAttachments recordId={recordId} />
          </Suspense>
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
