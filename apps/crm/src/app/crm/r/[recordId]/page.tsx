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
// FB-4 / D8: the V2 shell is THE record page — no V1 fallback, no per-user
// layout flag. (V1 file + toggle deletion is tracked separately.)
import { RecordDetailShellV2 } from '@/components/crm/records/RecordDetailShellV2';
import { getRecordInsights, emptyRecordInsights } from '@/lib/crm/record-insights';
import { RecordLayoutNotice } from './RecordLayoutNotice';
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
  const [
    fieldsResult,
    layoutResult,
    notesResult,
    stagesResult,
    insightsResult,
    twinResult,
  ] = await Promise.allSettled([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
    getNotesForRecordAggregated(record, module.key),
    module.key === 'deals' ? getDealStages(profile.organization_id) : Promise.resolve([]),
    getRecordInsights(recordId),
    getTwinDataForRecord(record, module.key),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const layout = layoutResult.status === 'fulfilled' ? layoutResult.value : null;
  // RP-M2: never fail open silently. A rejected layout fetch (transient) and a
  // missing default layout row (configuration) both degrade to the one-section
  // form, but each gets its own visible notice in the overview — and a log line.
  const layoutNoticeKind: 'error' | 'missing' | null =
    layoutResult.status === 'rejected' ? 'error' : layout === null ? 'missing' : null;
  if (layoutResult.status === 'rejected') {
    console.error('[RecordDetail] Failed to load the default layout:', layoutResult.reason);
  } else if (layout === null) {
    console.warn(`[RecordDetail] No default layout row for module "${module.key}" (${module.id})`);
  }
  const notes = notesResult.status === 'fulfilled' ? notesResult.value : [];
  const stages = stagesResult.status === 'fulfilled' ? stagesResult.value : [];
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

  return (
    <>
      <MergedFromToast recordTitle={record.title} />
      <RecordDetailShellV2
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
          <>
            {layoutNoticeKind && (
              <RecordLayoutNotice kind={layoutNoticeKind} moduleName={module.name_plural || module.name} />
            )}
            <RecordOverviewPanel
              recordId={recordId}
              record={record}
              fields={fields}
              layout={layout}
              defaultValues={defaultValues}
              moduleKey={module.key}
              layoutV2Shell
              noteCount={notes.length + legacyNoteCount}
            />
          </>
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
      </RecordDetailShellV2>
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

/**
 * RP-8: mirrors the V2 shell's paint order — breadcrumb row, hero (avatar ·
 * title · meta · action cluster), top-tab strip, section jump bar, then the
 * Coverage Snapshot card and two section cards. No right-rail block: the V2
 * rail is collapsed by default, so a rail skeleton only caused a layout jump.
 */
function RecordDetailSkeleton() {
  const bone = 'bg-slate-200 dark:bg-slate-800 rounded';
  const soft = 'bg-slate-100 dark:bg-slate-800/40 rounded';
  return (
    <div
      className="flex h-[calc(100dvh-7.25rem)] flex-col overflow-hidden"
      role="status"
      aria-label="Loading record"
      aria-busy="true"
      data-testid="crm-record-skeleton"
    >
      {/* Sticky header block: breadcrumb + hero + tab strip */}
      <div className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-white/5 dark:bg-slate-950 xl:px-6">
        <div className="animate-pulse">
          <div className="mb-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-4 w-20 ${bone}`} />
              <div className={`h-4 w-3 ${bone}`} />
              <div className={`h-4 w-36 ${bone}`} />
            </div>
            <div className={`hidden h-8 w-56 md:block ${soft}`} />
          </div>
          <div className="flex items-start gap-4">
            <div className={`h-14 w-14 shrink-0 rounded-xl ${bone}`} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-7 w-56 max-w-full ${bone}`} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <div className={`h-4 w-40 ${soft}`} />
                <div className={`h-4 w-28 ${soft}`} />
                <div className={`h-5 w-20 rounded-full ${soft}`} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className={`hidden h-8 w-16 lg:block ${soft}`} />
              <div className={`h-8 w-28 ${bone}`} />
              <div className={`h-8 w-8 ${soft}`} />
            </div>
          </div>
          <div className="mt-3 flex gap-0 border-b border-slate-200 dark:border-white/5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-4 py-3">
                <div className={`h-4 w-16 ${soft}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section jump bar + snapshot + section cards */}
      <div className="w-full flex-1 space-y-4 overflow-hidden px-4 py-3 xl:px-6">
        <div className="flex items-center gap-2 animate-pulse">
          {['w-20', 'w-24', 'w-16', 'w-20', 'w-24', 'w-16'].map((w, i) => (
            <div key={i} className={`h-7 ${w} ${soft}`} />
          ))}
        </div>
        <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-slate-800/30" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-slate-800/30" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-slate-800/30" />
      </div>
    </div>
  );
}
