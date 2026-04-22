import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  getRecordWithModule,
  getFieldsForModule,
  getDefaultLayout,
  getNotesForRecord,
  getTimelineForRecord,
  getRecordLinks,
  getAttachmentsForRecord,
  getDealStages,
  getCachedCurrentProfile,
} from '@/lib/crm/queries';
import { resolveRecordOrMergeDestination } from '@/lib/crm/resolve-record';
import { RecordDetailShell } from '@/components/crm/records/RecordDetailShell';
import { RecordDetailShellV2 } from '@/components/crm/records/RecordDetailShellV2';
import { isLayoutV2Enabled } from '@/lib/crm/feature-flags';
import { getRecordInsights, emptyRecordInsights } from '@/lib/crm/record-insights';
import { RecordTimeline } from '@/components/crm/records/RecordTimeline';
import { AttachmentsPanel } from '@/components/crm/records/AttachmentsPanel';
import { RelatedRecordsPanel } from '@/components/crm/records/RelatedRecordsPanel';
import { DynamicRecordForm } from '@/components/crm/records/DynamicRecordForm';
import { getSectionMeta } from '@/components/crm/records/section-utils';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import { OverviewLayout } from '@/components/crm/records/OverviewLayout';
import { NotesPanel } from './NotesPanel';
import { LegacyNotesCard } from './LegacyNotesCard';
import { MergedFromToast } from '@/components/crm/records/MergedFromToast';

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

  // Step 1: Fetch profile and record+module in parallel with safe error handling
  // Use getCachedCurrentProfile to share the layout's auth result (avoids duplicate
  // profile queries and prevents transient auth failures from showing as logouts)
  const [profileResult, recordResult] = await Promise.allSettled([
    getCachedCurrentProfile(),
    getRecordWithModule(recordId),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  if (!profile) {
    if (profileResult.status === 'rejected') {
      console.error('[RecordDetail] Failed to get profile:', profileResult.reason);
    }
    return notFound();
  }

  const result = recordResult.status === 'fulfilled' ? recordResult.value : null;
  if (!result) {
    if (recordResult.status === 'rejected') {
      console.error('[RecordDetail] Failed to get record:', recordResult.reason);
    }

    // Stale-URL recovery: if this record was merged into another record
    // (forensic trail in crm_audit_log), silently forward the user to the
    // surviving keeper with a `merged_from=` hint so the destination page
    // can surface a one-time toast.
    const resolution = await resolveRecordOrMergeDestination(recordId);
    if (resolution.kind === 'merged') {
      redirect(`/crm/r/${resolution.keeperId}?merged_from=${recordId}`);
    }
    return notFound();
  }

  const { record, module } = result;

  // Step 2: Fetch overview-critical data in parallel with safe error handling.
  // The layout-v2 feature flag is resolved in the same batch so there's no
  // extra round-trip; it falls back to `false` on any error so the classic
  // shell always renders when in doubt.
  const [
    fieldsResult,
    layoutResult,
    notesResult,
    stagesResult,
    layoutV2Result,
    insightsResult,
  ] = await Promise.allSettled([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecord(recordId),
    module.key === 'deals' ? getDealStages(profile.organization_id) : Promise.resolve([]),
    isLayoutV2Enabled(profile),
    getRecordInsights(recordId),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const layout = layoutResult.status === 'fulfilled' ? layoutResult.value : null;
  const notes = notesResult.status === 'fulfilled' ? notesResult.value : [];
  const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];
  const useLayoutV2 = layoutV2Result.status === 'fulfilled' ? layoutV2Result.value : false;
  const insights =
    insightsResult.status === 'fulfilled' ? insightsResult.value : emptyRecordInsights();

  // Merge JSONB `data` with indexed `crm_records` columns (source of truth for lane/filters)
  const defaultValues = mergeCrmRecordRowIntoFormDefaults(
    record as unknown as Record<string, unknown> & {
      data?: Record<string, unknown> | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
    }
  );

  // Compute section metadata on the server for the section navigator
  const sectionMeta = getSectionMeta(fields, layout);

  const recordData = record.data || {};
  const legacyNotes =
    typeof recordData.notes_history === 'string' && (recordData.notes_history as string).trim() !== ''
      ? (recordData.notes_history as string)
      : null;

  const Shell = useLayoutV2 ? RecordDetailShellV2 : RecordDetailShell;

  return (
    <>
      <MergedFromToast recordTitle={record.title} />
      <Shell
      record={record}
      module={module}
      fields={fields}
      stages={stages}
      noteCount={notes.length}
      notes={notes}
      orgId={profile.organization_id}
      insights={insights}
      className="h-[calc(100vh-64px)]"
    >
      {{
        overview: (
          <OverviewLayout
            sections={sectionMeta}
            fieldContent={
              <>
                <DynamicRecordForm
                  record={record}
                  fields={fields}
                  layout={layout}
                  defaultValues={defaultValues}
                  readOnly
                  inlineEditable={useLayoutV2}
                />
                {/* Legacy Notes History (imported from Zoho) — below fields */}
                {legacyNotes && (
                  <div className="mt-4">
                    <LegacyNotesCard notesHtml={legacyNotes} />
                  </div>
                )}
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
      </Shell>
    </>
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
          <div className="w-full space-y-4 animate-pulse">
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
        <div className="w-full px-4 py-4 space-y-4">
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
