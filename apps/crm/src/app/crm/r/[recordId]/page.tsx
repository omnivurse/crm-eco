import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import {
  getRecordWithModule,
  getFieldsForModule,
  getDefaultLayout,
  getNotesForRecordAggregated,
  getTwinDataForRecord,
  getTimelineForRecordAggregated,
  getRecordLinks,
  getAttachmentsForRecord,
  getDealStages,
  getCachedCurrentProfile,
} from '@/lib/crm/queries';
import { resolveRecordOrMergeDestination } from '@/lib/crm/resolve-record';
import { applyAge65AutoCancelForRecord, applyScheduledEndDateCancelForRecordView } from '@/lib/crm/membership-lifecycle';
import { RecordDetailShell } from '@/components/crm/records/RecordDetailShell';
import { RecordDetailShellV2 } from '@/components/crm/records/RecordDetailShellV2';
import { isLayoutV2Enabled } from '@/lib/crm/feature-flags';
import { getRecordInsights, emptyRecordInsights } from '@/lib/crm/record-insights';
import { RecordTimeline } from '@/components/crm/records/RecordTimeline';
import { AttachmentsSectionClient } from '@/components/crm/records/AttachmentsSectionClient';
import { RelatedRecordsPanelClient } from '@/components/crm/records/RelatedRecordsPanelClient';
import { RecordOverviewPanel } from '@/components/crm/records/RecordOverviewPanel';
import { CommunicationsTab } from '@/components/crm/records/CommunicationsTab';
import { mergeCrmRecordRowIntoFormDefaults } from '@/lib/crm/record-form-defaults';
import { hasLegacyNotesHistory } from '@/lib/crm/note-dedupe';
import { NotesPanel } from './NotesPanel';
import { LegacyNotesCard } from './LegacyNotesCard';
import { MergedFromToast } from '@/components/crm/records/MergedFromToast';

interface PageProps {
  params: Promise<{ recordId: string }>;
}

/** Lazy-loaded timeline tab — fetches data only when streamed */
async function LazyTimeline({ recordId }: { recordId: string }) {
  const timeline = await getTimelineForRecordAggregated(recordId);
  return <RecordTimeline events={timeline} />;
}

/** Lazy-loaded related records tab */
async function LazyRelatedRecords({ recordId }: { recordId: string }) {
  const linkedRecords = await getRecordLinks(recordId);
  return (
    <RelatedRecordsPanelClient
      recordId={recordId}
      initialLinkedRecords={linkedRecords}
    />
  );
}

const CRM_UPLOAD_ROLES = ['crm_admin', 'crm_manager', 'crm_agent'] as const;
const CRM_ATTACHMENT_DELETE_ROLES = ['crm_admin', 'crm_manager'] as const;

/** Lazy-loaded attachments tab */
async function LazyAttachments({
  recordId,
  attachmentsCanUpload,
  attachmentsCanDelete,
}: {
  recordId: string;
  attachmentsCanUpload: boolean;
  attachmentsCanDelete: boolean;
}) {
  const attachments = await getAttachmentsForRecord(recordId);
  return (
    <AttachmentsSectionClient
      recordId={recordId}
      attachments={attachments}
      canUpload={attachmentsCanUpload}
      canDelete={attachmentsCanDelete}
    />
  );
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
    // Avoid misleading global 404: middleware already ensured a session; missing
    // profile here is usually auth/cookie drift or a transient read failure.
    redirect('/crm-login?error=profile_fetch_failed');
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

  // Live application of the HealthShare age-65 auto-cancel rule. The RPC is a
  // no-op for non-healthshare records, records without a DOB, and records
  // already cancelled, so calling it for every record view is cheap. When it
  // does apply a cancellation we re-fetch the record once so the page renders
  // the post-cancellation state.
  let activeResult = result;
  if (result.module.key === 'contacts' || result.module.key === 'members') {
    const [age65Applied, scheduledCancelApplied] = await Promise.all([
      applyAge65AutoCancelForRecord(result.record.id),
      applyScheduledEndDateCancelForRecordView(result.record.id),
    ]);
    if (
      (age65Applied && age65Applied.count > 0) ||
      scheduledCancelApplied?.cancelled
    ) {
      const refreshed = await getRecordWithModule(recordId);
      if (refreshed) {
        activeResult = refreshed;
      }
    }
  }

  const { record, module } = activeResult;

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
    twinResult,
  ] = await Promise.allSettled([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecordAggregated(record, module.key),
    module.key === 'deals' ? getDealStages(profile.organization_id) : Promise.resolve([]),
    isLayoutV2Enabled(profile),
    getRecordInsights(recordId),
    getTwinDataForRecord(record, module.key),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const layout = layoutResult.status === 'fulfilled' ? layoutResult.value : null;
  const notes = notesResult.status === 'fulfilled' ? notesResult.value : [];
  const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];
  const useLayoutV2 = layoutV2Result.status === 'fulfilled' ? layoutV2Result.value : false;
  const insights =
    insightsResult.status === 'fulfilled' ? insightsResult.value : emptyRecordInsights();
  // Fuller profile for the same person in another module, used to fill blanks
  // only. A failed lookup degrades to the record's own data rather than erroring.
  const twinData = twinResult.status === 'fulfilled' ? twinResult.value : null;

  // Merge JSONB `data` with indexed `crm_records` columns (source of truth for lane/filters)
  const defaultValues = mergeCrmRecordRowIntoFormDefaults(
    record as unknown as Record<string, unknown> & {
      data?: Record<string, unknown> | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
    },
    { moduleKey: module.key, twinData },
  );

  // Section pill counts are computed client-side in RecordOverviewPanel so
  // filled-count badges update as reps inline-save without a full refresh.

  const recordData = record.data || {};
  const notesHistoryRaw =
    typeof recordData.notes_history === 'string' ? recordData.notes_history : '';
  // Show imported history whenever there IS any, regardless of whether Zoho
  // wrote it as HTML. Gating on markup hid hundreds of records whose history
  // is plain text ("11-6-15 He's in CA 'til Mon…") — the exact "my notes
  // vanished" report this work exists to end. Only short scalars (plan ids,
  // member numbers) stored in the same key are still suppressed.
  const legacyNotes = hasLegacyNotesHistory(notesHistoryRaw) ? notesHistoryRaw : null;

  // Count legacy entries so the Notes tab badge reflects them too. Mirrors
  // LegacyNotesCard's contract: HTML history splits on <hr>; plain-text
  // history splits on a date at the start of a line (and is at least one).
  const legacyNoteCount = legacyNotes
    ? /<hr\s*\/?>|<br\s*\/?>|<b>/i.test(legacyNotes)
      ? Math.max(
          1,
          legacyNotes
            .split(/<hr\s*\/?>/gi)
            .map((c) => c.replace(/<[^>]*>/g, '').trim())
            .filter((c) => c.length > 0).length,
        )
      : Math.max(1, (legacyNotes.match(/^[ \t]*\d{1,2}[-./]\d{1,2}[-./]\d{2,4}[.:\s-]/gm) || []).length)
    : 0;

  // V2 shell prefers insights.counts.notes; fold legacy entries in so the
  // tab badge stays accurate regardless of which shell path renders.
  const insightsWithLegacy =
    legacyNoteCount > 0
      ? {
          ...insights,
          counts: { ...insights.counts, notes: insights.counts.notes + legacyNoteCount },
        }
      : insights;

  const Shell = useLayoutV2 ? RecordDetailShellV2 : RecordDetailShell;

  return (
    <>
      <MergedFromToast recordTitle={record.title} />
      <Shell
      record={record}
      module={module}
      fields={fields}
      stages={stages}
      noteCount={notes.length + legacyNoteCount}
      notes={notes}
      orgId={profile.organization_id}
      insights={insightsWithLegacy}
      className="h-[calc(100dvh-7.25rem)]"
    >
      {{
        overview: (
          <RecordOverviewPanel
            recordId={recordId}
            record={record}
            fields={fields}
            layout={layout}
            defaultValues={defaultValues}
            moduleKey={module.key}
            layoutV2Shell={useLayoutV2}
            noteCount={notes.length + legacyNoteCount}
            belowFields={
              // Layout V2 shows a compact "Recent notes" strip ABOVE the field
              // stack (RecordDetailShellV2 → RecentNotesStrip, same aggregated
              // `notes`), so the full notes card no longer trails 27 section
              // cards. Legacy imported notes still render below the fields.
              legacyNotes ? (
                <div className="mt-4 space-y-4">
                  <LegacyNotesCard notesHtml={legacyNotes} />
                </div>
              ) : undefined
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
          <div className="space-y-4">
            <NotesPanel
              recordId={recordId}
              notes={notes}
              orgId={profile.organization_id}
              hasLegacyNotes={!!legacyNotes}
            />
            {legacyNotes && <LegacyNotesCard notesHtml={legacyNotes} />}
          </div>
        ),

        attachments: (
          <Suspense fallback={<TabSkeleton />}>
            <LazyAttachments
              recordId={recordId}
              attachmentsCanUpload={
                !!profile.crm_role &&
                CRM_UPLOAD_ROLES.includes(profile.crm_role as (typeof CRM_UPLOAD_ROLES)[number])
              }
              attachmentsCanDelete={
                !!profile.crm_role &&
                CRM_ATTACHMENT_DELETE_ROLES.includes(
                  profile.crm_role as (typeof CRM_ATTACHMENT_DELETE_ROLES)[number],
                )
              }
            />
          </Suspense>
        ),

        communications: (
          <CommunicationsTab
            recordId={recordId}
            orgId={profile.organization_id}
            email={record.email}
            phone={record.phone}
          />
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
    <div className="flex h-[calc(100dvh-7.25rem)]">
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
