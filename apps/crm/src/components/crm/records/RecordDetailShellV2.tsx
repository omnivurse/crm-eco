'use client';

/**
 * RecordDetailShellV2 — Zoho-style 3-column CRM record detail layout.
 *
 * Shipped behind the `crm.layout.v2` feature flag. Users can opt in from
 * /crm/profile. Classic `RecordDetailShell` remains untouched so rollback is
 * a single flag toggle.
 *
 * Layout:
 *   ┌ Header: breadcrumb + InlineRecordSearch ──────────────────────────┐
 *   │ Avatar · Title + meta · Tags · [Convert…][Email][Remind][Edit][Add Note ▾][⋯] │
 *   │ Stage bar (deals) · Normalization banner (admin/manager only)     │
 *   │ Tabs: Overview · Timeline  (Data Privacy lives under ⋯)           │
 *   ├────────────┬──────────────────────────────┬──────────────────────┤
 *   │ Related    │ Main panel                   │ Insights             │
 *   │ rail       │ (Details / Notes / Emails /  │ · Best time to       │
 *   │ + Links    │  Attachments / Related / …)  │ · Quick actions      │
 *   │ + Add      │                              │ · Record info        │
 *   └────────────┴──────────────────────────────┴──────────────────────┘
 */

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, memo, useRef } from 'react';
import { queuedSend } from '@/lib/offline/queued-send';
import { cachedFetch } from '@/lib/offline/cached-fetch';
import { trackRecentRecord } from '@/lib/offline/recent-records';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Edit,
  MoreHorizontal,
  Mail,
  Phone,
  CheckSquare,
  StickyNote,
  Upload,
  UserPlus,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  ChevronDown,
  PanelRightClose,
  Shield,
  Clock as ClockIcon,
  Link2,
  ExternalLink,
  Plus,
  LayoutDashboard,
  ClipboardList,
  Users,
  LifeBuoy,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { IdentityActionsHeader } from '@crm-eco/ui/components/identity-actions-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@crm-eco/ui/components/tabs';
import { Input } from '@crm-eco/ui/components/input';
import { Textarea } from '@crm-eco/ui/components/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@crm-eco/ui/components/sheet';
import { toast } from 'sonner';
import { formatNoteTimestamp, formatNoteRelative } from '@/lib/crm/note-timestamp';
import { cn } from '@crm-eco/ui/lib/utils';
import { supabase } from '@/lib/supabase-client';
import { sanitizeNoteHtml, getNoteAuthorDisplay } from '@/lib/crm/note-sanitize';
import { NoteRichArea } from '@/components/crm/notes/NoteRichArea';
import { RecordToolbarGlobalSearch } from './RecordToolbarGlobalSearch';
import { StageSelector } from '@/components/crm/blueprints';
import { ComposerBar } from '@/components/zoho/ComposerBar';
import { ConvertToContactDialog } from '@/components/crm/records/ConvertToContactDialog';
import { ConvertLeadButton } from '@/components/crm/records/ConvertLeadButton';
import { ConvertLeadMenu } from './v2/ConvertLeadMenu';
import {
  getCoreStatusPickerItems,
  getEnrollActionLabel,
  getMemberNoun,
  isActiveCoverageStatus,
  relabelStatusForMarket,
} from '@/lib/crm/member-terminology';
import { statusLane, statusToneForValue, sanitizeReturnTo, withReturnTo } from '@/lib/crm/status-lanes';
import { StatusBadge } from '@/components/ui/status-badge';
import { toastCopy } from '@/lib/crm/toast-copy';
import { stripLegacyAuthorAttribution } from '@/lib/crm/note-sanitize';
import { MergeRecordDialog } from '@/components/crm/records/MergeRecordDialog';
import {
  MarketTypeBadge,
  NormalizationBadge,
  NormalizationBanner,
  OwnershipDisplay,
  getOwnerLabel,
} from '@/components/shared/crm-lane-badges';
import { CapacityBadges } from '@/components/shared/capacity-badge';
import type { CrmRecord, CrmModule, CrmField, CrmDealStage, CrmNoteWithAuthor } from '@/lib/crm/types';
import type { RecordInsights } from '@/lib/crm/record-insights';
import { getRecordDisplayName } from '@/lib/crm/display-name';
import { RecordAvatarTile } from './v2/RecordAvatarTile';
import { RecordTagsRow } from './v2/RecordTagsRow';
import {
  type RelatedListNavItem,
  type RecordRelatedListLink,
} from './v2/RecordRelatedListNav';
import { RecordRelatedListChips } from './v2/RecordRelatedListChips';
import { MobileActionBar } from './v2/MobileActionBar';
import { RecordInsightsPanel } from './v2/RecordInsightsPanel';
import { HabitNextBestActions } from '@/components/crm/habits/HabitNextBestActions';
import { RecordBriefingCard } from './v2/RecordBriefingCard';
import { InlineRecordSearch, type NavigateToMatchArgs } from './v2/InlineRecordSearch';
import { SendEmailDialog } from './v2/SendEmailDialog';
import {
  AiFollowUpEmailButton,
  type AiFollowUpEmailDraft,
} from './v2/AiFollowUpEmailButton';
import { NoteTemplatePicker } from './v2/NoteTemplatePicker';
import { CustomizeRelatedListsDialog, type CustomizeRelatedListsItem } from './v2/CustomizeRelatedListsDialog';
import { RecordOverviewSlotsProvider } from './RecordOverviewSlots';
import { DataPrivacyPanel } from './v2/DataPrivacyPanel';
import { FilterableTimeline } from './v2/FilterableTimeline';
import { KeyboardShortcutsDialog } from './v2/KeyboardShortcutsDialog';
import { PresenceStack } from './v2/PresenceStack';
import { InlineFieldEditor } from './v2/InlineFieldEditor';
import { UnsavedChangesPill } from './v2/UnsavedChangesPill';
import { MembershipChangeHistory } from './v2/MembershipChangeHistory';
import { DependentCoverageHistory } from './v2/DependentCoverageHistory';
import { MemberSupportTickets } from './v2/MemberSupportTickets';
import { RecordTasksPanel } from './v2/RecordTasksPanel';
import {
  RecordCampaignsPanel,
  RecordCadencesPanel,
  RecordMeetingsPanel,
  RecordVisitsPanel,
  RecordSocialPanel,
  RecordProductsPanel,
} from './v2/RecordRelatedListPanels';
import { RecordLinksEditorDialog } from './v2/RecordLinksEditorDialog';
import { FollowUpReminderDialog } from './FollowUpReminderDialog';
import { FollowUpBanner } from './FollowUpBanner';
import { useSyncBroadcast } from '@/hooks/useSyncBroadcast';
import { RecordFieldSaveProvider, useRecordFieldSaveOptional } from '@/hooks/useRecordFieldSave';
import { NoteComposeProvider } from '@/components/crm/notes/NoteComposeContext';
import { parseRecordComposeParams } from '@/lib/crm/note-compose';
import { RecordFieldLocksProvider } from '@/hooks/useRecordFieldLocks';
import { RecordAiContextProvider } from './v2/RecordAiContext';
import { useUiPreferences } from '@/hooks/useUiPreferences';
import {
  consumePersistedScrollTop,
  persistRecordScrollTop,
} from '@/lib/crm/record-section-persistence';
import {
  nextHeaderCompact,
  reanchorScrollAfterHeaderResize,
} from '@/lib/crm/record-header-compact';
import { dedupeNotesForDisplay } from '@/lib/crm/note-dedupe';
import {
  scrollRecordFieldIntoView,
  scrollRecordTargetIntoView,
} from '@/lib/crm/record-section-scroll';
import { CRM_SECTION_NAV_EVENT } from './section-utils';
import { useRecordHotkeys } from '@/hooks/useRecordHotkeys';
import { useRecordPresence } from '@/hooks/useRecordPresence';
import { useRecentlyViewedTracker } from '@/hooks/useRecentlyViewedTracker';
import { useLiveRecord, type LiveRecordEvent } from '@/hooks/useLiveRecord';
import { useClientAuth } from '@/hooks/useClientAuth';
import { isLeadRecordConverted, getConvertedContactId } from '@/lib/crm/lead-conversion-result';
import { resolveEffectiveStartDate } from '@/lib/crm/resolve-effective-start-date';
import {
  buildRecordFieldSearchHits,
  buildRecordSearchableRows,
} from '@/lib/crm/record-field-search';
import { setRecordCommandContext } from '@/lib/crm/record-command-context';

/**
 * Related-list chips shown when the user has never customised the strip.
 * The other panels (Campaigns, Cadences, Products, Visits, Social, Invited
 * Meetings, Support) stay in the Customize dialog's "Available" column — on
 * PIFH they are backed by empty tables, so a chip would only ever read "0".
 */
const DEFAULT_VISIBLE_RELATED_LIST_IDS = [
  'details',
  'notes',
  'emails',
  'activities',
  'attachments',
  'related',
] as const;

// `sanitizeReturnTo` (only `/crm...` paths are honoured as a back target — no
// open redirects) now lives in lib/crm/status-lanes next to `withReturnTo`,
// so the list rows / dashboard that WRITE `?returnTo=` and this reader agree.

export interface RecordDetailShellV2Props {
  record: CrmRecord;
  module: CrmModule;
  fields: CrmField[];
  stages?: CrmDealStage[];
  noteCount?: number;
  notes?: CrmNoteWithAuthor[];
  orgId?: string;
  /**
   * Server-computed insights: live related-list counts and "best time to"
   * suggestions. Refreshable via GET /api/crm/records/[id]/insights. Missing
   * insights (undefined) render empty slots with the "No best time for the
   * day" copy, matching Zoho's empty state.
   */
  insights?: RecordInsights;
  children: {
    overview: React.ReactNode;
    related: React.ReactNode;
    timeline: React.ReactNode;
    notes?: React.ReactNode;
    attachments?: React.ReactNode;
    communications?: React.ReactNode;
  };
  onEdit?: () => void;
  onAddTask?: () => void;
  onAddNote?: () => void;
  onUploadFile?: () => void;
  onRefresh?: () => void;
  className?: string;
}

type TopTab = 'overview' | 'timeline' | 'privacy';

/** Identifies the sub-view shown inside the Overview tab. */
type OverviewPane =
  | 'details'
  | 'notes'
  | 'emails'
  | 'activities'
  | 'closed_activities'
  | 'attachments'
  | 'related'
  | 'cadences'
  | 'products'
  | 'campaigns'
  | 'visits'
  | 'social'
  | 'surveys'
  | 'desk'
  | 'meetings';

function recordMarketTypeForConvert(record: CrmRecord): string | undefined {
  return (record as { market_type?: string | null }).market_type ?? undefined;
}

function HeaderCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3 text-slate-400" />
      )}
    </button>
  );
}

function StageIndicator({
  currentStage,
  stages,
}: {
  currentStage: string | null;
  stages: CrmDealStage[];
}) {
  if (!stages.length || !currentStage) return null;
  const currentIndex = stages.findIndex((s) => s.key === currentStage);
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        let bg = 'bg-slate-700';
        if (isActive) {
          bg = stage.is_won ? 'bg-green-500' : stage.is_lost ? 'bg-red-500' : 'bg-teal-500';
        } else if (isPast) {
          bg = 'bg-teal-500/50';
        }
        return <div key={stage.id} className={cn('h-2 flex-1 rounded-full transition-colors', bg)} title={stage.name} />;
      })}
    </div>
  );
}

export const RecordDetailShellV2 = memo(function RecordDetailShellV2({
  record,
  module,
  fields: _fields,
  stages = [],
  noteCount,
  notes: notesProp = [],
  orgId: _orgId,
  insights: insightsProp,
  children,
  onEdit,
  onAddTask,
  onAddNote,
  onUploadFile,
  onRefresh,
  className,
}: RecordDetailShellV2Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [topTab, setTopTab] = useState<TopTab>('overview');
  const [overviewPane, setOverviewPane] = useState<OverviewPane>('details');
  const [activitiesMode, setActivitiesMode] = useState<'open' | 'closed'>('open');

  // Refresh this tab when a sibling tab on the same device drains a
  // mutation tied to this record. Scoped by recordId so unrelated
  // deal edits don't cause pointless refreshes. Replays are skipped
  // by default — the remote already had the write.
  useSyncBroadcast(
    () => {
      if (onRefresh) onRefresh();
      else router.refresh();
    },
    { recordId: record.id },
  );

  // Listen for cross-cutting tab-switch events from child components.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'notes' || detail === 'attachments' || detail === 'communications' || detail === 'related') {
        setTopTab('overview');
        if (detail === 'communications') setOverviewPane('emails');
        else if (detail === 'attachments') setOverviewPane('attachments');
        else if (detail === 'related') setOverviewPane('related');
        else setOverviewPane('notes');
      } else if (detail === 'timeline') {
        setTopTab('timeline');
      } else if (detail === 'overview') {
        setTopTab('overview');
        setOverviewPane('details');
      }
    };
    window.addEventListener('crm:switch-tab', handler);
    return () => window.removeEventListener('crm:switch-tab', handler);
  }, []);

  // Deep link: `?pane=notes|emails|attachments|related|timeline` and
  // `?pane=notes&compose=1` (dashboard command desk). Applied once on mount
  // so a later in-page pane switch is never overridden by the stale URL.
  const [notesComposeNonce, setNotesComposeNonce] = useState(0);
  const requestNoteCompose = useCallback(() => {
    setNotesComposeNonce((n) => n + 1);
  }, []);
  const paneParam = searchParams?.get('pane') ?? null;
  useEffect(() => {
    const parsed = parseRecordComposeParams({
      get: (name) => searchParams?.get(name) ?? null,
    });
    if (!parsed.pane && !paneParam) return;
    if (parsed.pane === 'timeline' || paneParam === 'timeline') {
      setTopTab('timeline');
      return;
    }
    if (parsed.pane) {
      setTopTab('overview');
      setOverviewPane(parsed.pane);
    }
    if (parsed.compose) requestNoteCompose();
    // Mount-only: do not re-apply when the user clears the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal state (identical to V1 so existing flows keep working)
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [showLinksEditor, setShowLinksEditor] = useState(false);
  const [localLinksOverride, setLocalLinksOverride] = useState<RecordRelatedListLink[] | null>(
    null,
  );
  const [aiEmailDraft, setAiEmailDraft] = useState<AiFollowUpEmailDraft | null>(
    null,
  );
  const [aiEmailLoading, setAiEmailLoading] = useState(false);
  // Guard so the palette-driven `?ai=email` trigger only fires once per visit.
  const aiEmailAutoTriggeredRef = useRef(false);
  /** Scroll container for scrolling `[data-field]` / notes pane into view after find */
  const recordMainScrollRef = useRef<HTMLElement | null>(null);
  const fieldSavePendingRef = useRef(0);
  const recordStickyHeaderRef = useRef<HTMLDivElement | null>(null);
  /** Last measured sticky-header height — used to re-anchor scroll when compact toggles. */
  const prevStickyHeaderHeightRef = useRef<number | null>(null);
  /**
   * Compact toggle direction for the next sticky-height sync. Re-anchor
   * parks above ENTER while compacting so a header settle cannot drop
   * through EXIT and snap the notes list back to the top.
   */
  const compactTransitionRef = useRef<'none' | 'compacting' | 'expanding'>('none');
  const [headerCompact, setHeaderCompact] = useState(false);

  // When the Command Palette lands here with `?ai=email`, request a fresh AI
  // follow-up draft and open SendEmailDialog pre-filled, then scrub the query
  // param so reloads don't re-fire.
  useEffect(() => {
    if (aiEmailAutoTriggeredRef.current) return;
    if (searchParams?.get('ai') !== 'email') return;
    aiEmailAutoTriggeredRef.current = true;
    // Scrub only `ai` — `returnTo` / `pane` must survive so Back still works.
    const stripAiParam = () => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('ai');
      const qs = params.toString();
      return `${pathname ?? `/crm/r/${record.id}`}${qs ? `?${qs}` : ''}`;
    };

    if (!record.email) {
      toast.warning('No email on file', {
        description: 'Add an email address before drafting a follow-up.',
      });
      router.replace(stripAiParam());
      return;
    }

    setAiEmailLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/crm/ai/email-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ recordId: record.id, tone: 'friendly' }),
        });
        if (!res.ok) {
          let code: string | undefined;
          let message = `AI request failed (${res.status})`;
          try {
            const body = await res.json();
            if (body?.error) message = body.error as string;
            if (body?.code) code = body.code as string;
          } catch {
            /* ignore */
          }
          if (code === 'AI_NOT_CONFIGURED') {
            toast.warning('AI assistant not configured', {
              description: 'Set OPENAI_API_KEY on the server to enable drafts.',
            });
          } else {
            toast.error(message);
          }
          return;
        }
        const body = (await res.json()) as { subject?: string; body?: string };
        setAiEmailDraft({
          subject: (body.subject ?? '').trim(),
          body: (body.body ?? '').trim(),
        });
        setShowSendEmailDialog(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error('AI request failed', { description: message });
      } finally {
        setAiEmailLoading(false);
        router.replace(stripAiParam());
      }
    })();
  }, [searchParams, record.id, record.email, router, pathname]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpRefreshKey, setFollowUpRefreshKey] = useState(0);

  // Right rail can be collapsed when the screen is tight or the user wants
  // the main panel to take the full width.
  // Default the right insights rail collapsed so the coverage snapshot + fields
  // get the full main-column width (the approved redesign has no right gutter).
  // Users can re-open it via the vertical "Insights" tab.
  const [insightsCollapsed, setInsightsCollapsed] = useState(true);
  // Mobile-only: insights panel opens in a bottom sheet from the action bar.
  const [insightsSheetOpen, setInsightsSheetOpen] = useState(false);

  // Per-user layout preferences (for pinned / ordered related lists).
  const { preferences: uiPrefs } = useUiPreferences();
  const customOrder = uiPrefs.related_list_order?.[module.key];
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  // Timestamp of the last committed status change. Used to ignore stale
  // server props that arrive via router.refresh() before the RSC cache
  // has propagated the revalidation.
  const statusCommittedAtRef = useRef<number>(0);
  const displayStatus = optimisticStatus || record.status;

  const sortedNotes = useMemo(
    () =>
      dedupeNotesForDisplay(
        [...notesProp].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      ),
    [notesProp],
  );

  useEffect(() => {
    if (!optimisticStatus) return;
    // Server prop now matches — clear optimistic.
    if (record.status === optimisticStatus) {
      setOptimisticStatus(null);
      return;
    }
    // If a status change was committed recently, the server prop is
    // probably stale RSC cache — keep optimistic a bit longer.
    const msSinceCommit = Date.now() - statusCommittedAtRef.current;
    if (msSinceCommit < 3000) return;
    // After the grace period, if the server *still* disagrees it means
    // the change genuinely didn't persist — revert.
    setOptimisticStatus(null);
  }, [record.status, optimisticStatus]);

  // Live insights — seed with SSR value, refresh on demand (after modals
  // close) without a full route transition.
  const [insights, setInsights] = useState<RecordInsights | undefined>(insightsProp);
  useEffect(() => {
    setInsights(insightsProp);
  }, [insightsProp]);

  // crm_notes + legacy notes_history — keep drawer/rail badges aligned with the Notes tab.
  const noteTotal = insights?.counts?.notes ?? noteCount ?? notesProp.length;

  // Remember this record in the offline index so it appears as a
  // clickable entry on /offline.html if the user lands there after
  // losing connectivity. Best-effort — IDB failures are swallowed.
  useEffect(() => {
    void trackRecentRecord({
      id: record.id,
      moduleKey: module.key,
      title: getRecordDisplayName(record),
      subtitle: record.status ?? record.stage ?? undefined,
    });
  }, [record.id, record.title, record.status, record.stage, module.key]);

  const refreshInsights = useCallback(async () => {
    try {
      // SWR-style: resolve immediately from cache (if any) so the
      // panel paints, then update again when the fresh response
      // lands. Offline users see the last-known insights instead of
      // an empty panel.
      const result = await cachedFetch<RecordInsights>({
        key: `record:${record.id}:insights`,
        url: `/api/crm/records/${record.id}/insights`,
        // 5 min soft TTL — insights change frequently enough that we
        // want revalidation on most repeat visits, but not so often
        // that we thrash the API on every tab click.
        ttlMs: 1000 * 60 * 5,
        onFresh: (next) => setInsights(next),
      });
      setInsights(result.value);
    } catch {
      // Swallow — insights are best-effort.
    }
  }, [record.id]);

  // Inline field saves update the DB immediately. Avoid full RSC refresh on
  // every blur — it reset scroll position and collapsed the Family section
  // (layout default). Optimistic overlays in InlineEditableRecordForm keep
  // the UI current; refresh insights only.
  const recordRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRecordRefresh = useCallback(() => {
    if (recordRefreshTimerRef.current) {
      clearTimeout(recordRefreshTimerRef.current);
    }
    recordRefreshTimerRef.current = setTimeout(() => {
      recordRefreshTimerRef.current = null;
      void refreshInsights();
    }, 900);
  }, [refreshInsights]);

  // Restore scroll if something upstream still triggered a route refresh.
  useEffect(() => {
    const scrollTop = consumePersistedScrollTop(record.id);
    if (scrollTop == null) return;
    const el = recordMainScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = scrollTop;
    });
  }, [record.id, record.updated_at]);

  useEffect(() => {
    return () => {
      if (recordRefreshTimerRef.current) {
        clearTimeout(recordRefreshTimerRef.current);
      }
    };
  }, []);

  const isLeads = module.key === 'leads';
  const isContacts = module.key === 'contacts';
  const isDeals = module.key === 'deals';
  const isAlreadyConverted = isLeadRecordConverted(record);
  const linkedEnrollmentMemberId = (() => {
    const data = (record.data ?? {}) as Record<string, unknown>;
    for (const key of ['converted_member_id', 'linked_member_id'] as const) {
      const v = data[key];
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
  })();
  const canConvertToContact = isLeads && !isAlreadyConverted;
  // Enrollment convert is available from Leads and Contacts (not after contact/member link).
  // A contact whose status is already in the ACTIVE lane ("Active HS Member",
  // "Enrolled - 2025", …) is already a member — offering "Convert to Member" on
  // 3,952 of 3,972 active contacts was the single most misleading header action.
  const statusIsActiveLane =
    statusLane(displayStatus) === 'active' || isActiveCoverageStatus(displayStatus);
  const canConvertToMember =
    (isLeads || isContacts) &&
    !isAlreadyConverted &&
    !linkedEnrollmentMemberId &&
    !(isContacts && statusIsActiveLane);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const enrollNoun = getMemberNoun(recordMarketTypeForConvert(record));
  const enrollLabel = getEnrollActionLabel(recordMarketTypeForConvert(record));

  // Back target keeps list state: validated `?returnTo=` (written by the list
  // rows / dashboard links, see withReturnTo) → plain module list. No
  // document.referrer heuristic — it never updates on client-side navigation,
  // so it pointed at the wrong list after the first record.
  // `?returnTo=/crm` also adds a Dashboard crumb.
  const moduleListUrl = `/crm/modules/${module.key}`;
  const returnTo = sanitizeReturnTo(searchParams?.get('returnTo'));
  const backUrl = returnTo ?? moduleListUrl;
  const cameFromDashboard = returnTo === '/crm' || returnTo?.startsWith('/crm?') === true;
  /** Record-page URL (`/crm/r/<id>` or `/edit`) with the back target carried along. */
  const keepReturnTo = useCallback((href: string) => withReturnTo(href, returnTo), [returnTo]);

  const handleNavigateToMatch = useCallback((args: NavigateToMatchArgs) => {
    setTopTab('overview');
    if (args.type === 'notes') {
      setOverviewPane('notes');
      window.setTimeout(() => {
        const el = recordMainScrollRef.current?.querySelector(
          '[data-record-notes-pane]',
        );
        scrollRecordTargetIntoView(el, {
          scrollRoot: recordMainScrollRef.current,
          block: 'center',
        });
      }, 150);
      return;
    }

    setOverviewPane('details');
    // Expand the field's section first so collapsed coverage cards have height.
    const fieldSection = _fields.find((f) => f.key === args.fieldKey)?.section;
    if (fieldSection) {
      window.dispatchEvent(
        new CustomEvent(CRM_SECTION_NAV_EVENT, {
          bubbles: true,
          detail: { key: fieldSection },
        }),
      );
    }
    scrollRecordFieldIntoView(args.fieldKey, {
      scrollRoot: recordMainScrollRef.current,
      block: 'center',
    });
  }, [_fields]);

  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of _fields) map[f.key] = f.label;
    return map;
  }, [_fields]);

  const noteBodiesForSearch = useMemo(
    () => notesProp.map((n) => n.body),
    [notesProp],
  );

  const searchableRows = useMemo(
    () => buildRecordSearchableRows(record, _fields, module.key),
    [record, _fields, module.key],
  );

  // Expose "jump to field" targets to the global CommandPalette (⌘K).
  useEffect(() => {
    setRecordCommandContext({
      recordId: record.id,
      recordTitle: getRecordDisplayName(record),
      searchFields: (q) =>
        buildRecordFieldSearchHits(searchableRows, noteBodiesForSearch.join('\n'), q, 12),
      jumpTo: handleNavigateToMatch,
    });
    return () => setRecordCommandContext(null);
  }, [
    record,
    searchableRows,
    noteBodiesForSearch,
    handleNavigateToMatch,
  ]);

  // Collapse the hero header once the user scrolls — keeps title + key fields pinned.
  useEffect(() => {
    const root = recordMainScrollRef.current;
    if (!root) return;

    const onScroll = () => {
      const y = root.scrollTop;
      setHeaderCompact((prev) => {
        const next = nextHeaderCompact(prev, y);
        if (next.transition !== 'none') {
          compactTransitionRef.current = next.transition;
        }
        return next.compact;
      });
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [record.id]);

  // Don't compensate against the previous record's header height on navigation.
  useLayoutEffect(() => {
    prevStickyHeaderHeightRef.current = null;
    compactTransitionRef.current = 'none';
    setHeaderCompact(false);
  }, [record.id]);

  // When the sticky header height changes (compact toggle, tab strip, chips),
  // Chromium/Brave leave scrollTop alone while the in-flow header shrinks —
  // content skips under the fold. Re-anchor before paint (same idea as
  // RecordTable density re-anchor) and keep --record-sticky-offset in sync.
  useLayoutEffect(() => {
    const root = recordMainScrollRef.current;
    const header = recordStickyHeaderRef.current;
    if (!root || !header) return;

    const syncOffsetAndAnchor = () => {
      const nextH = header.getBoundingClientRect().height;
      const prevH = prevStickyHeaderHeightRef.current;
      prevStickyHeaderHeightRef.current = nextH;
      root.style.setProperty('--record-sticky-offset', `${Math.ceil(nextH + 12)}px`);

      if (prevH == null) return;
      const delta = nextH - prevH;
      // Keep compactTransitionRef until a real height delta arrives — the first
      // measure after setState can still match prevH before layout settles.
      if (Math.abs(delta) < 1) return;

      const transition = compactTransitionRef.current;
      compactTransitionRef.current = 'none';
      root.scrollTop = reanchorScrollAfterHeaderResize({
        scrollTop: root.scrollTop,
        delta,
        transition,
        headerCompact,
      });
    };

    syncOffsetAndAnchor();
    const ro = new ResizeObserver(syncOffsetAndAnchor);
    ro.observe(header);
    return () => ro.disconnect();
  }, [record.id, headerCompact, topTab]);

  // -------------------------------------------------------------------------
  // Action handlers (preserve V1 behaviour)
  // -------------------------------------------------------------------------
  const handleEditRecord = useCallback(() => {
    if (onEdit) onEdit();
    else router.push(keepReturnTo(`/crm/r/${record.id}/edit`));
  }, [onEdit, router, record.id, keepReturnTo]);

  const handleAddTask = useCallback(() => {
    if (onAddTask) onAddTask();
    else setShowTaskModal(true);
  }, [onAddTask]);

  const persistMainScroll = useCallback(() => {
    const el = recordMainScrollRef.current;
    if (el) persistRecordScrollTop(record.id, el.scrollTop);
  }, [record.id]);

  const handleAddNote = useCallback(() => {
    if (onAddNote) {
      onAddNote();
      return;
    }
    setTopTab('overview');
    setOverviewPane('notes');
    requestNoteCompose();
  }, [onAddNote, requestNoteCompose]);

  const handleUploadFile = useCallback(() => {
    if (onUploadFile) onUploadFile();
    else setShowUploadModal(true);
  }, [onUploadFile]);

  const submitTask = useCallback(async () => {
    if (!taskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    setIsSubmitting(true);
    const result = await queuedSend({
      method: 'POST',
      url: '/api/crm/tasks',
      body: {
        record_id: record.id,
        title: taskTitle,
        description: taskDescription,
        due_at: taskDueDate || null,
        priority: 'medium',
        activity_type: 'task',
      },
      queue: {
        label: `New task: ${taskTitle.slice(0, 48)}`,
        recordId: record.id,
      },
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success(toastCopy.added('Task'));
    } else if (result.queued) {
      toast.info('Task saved offline — will sync when reconnected');
    } else {
      toast.error(toastCopy.failed('create the task', result.error, 'Try again'));
      return;
    }
    setShowTaskModal(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    // No router.refresh() on queued — there's nothing new on the
    // server yet. We refresh on replay success via the queue.
    if (result.ok) {
      persistMainScroll();
      router.refresh();
      void refreshInsights();
    }
  }, [record.id, router, taskTitle, taskDescription, taskDueDate, refreshInsights, persistMainScroll]);

  const submitNote = useCallback(async () => {
    if (!noteContent.trim()) {
      toast.error('Please enter note content');
      return;
    }
    setIsSubmitting(true);
    const result = await queuedSend({
      method: 'POST',
      url: '/api/crm/notes',
      body: { record_id: record.id, body: noteContent },
      queue: {
        label: `New note (${noteContent.trim().slice(0, 48)}${noteContent.length > 48 ? '…' : ''})`,
        recordId: record.id,
      },
    });
    setIsSubmitting(false);

    if (result.ok) {
      toast.success(toastCopy.added('Note'));
    } else if (result.queued) {
      toast.info('Note saved offline — will sync when reconnected');
    } else {
      toast.error(toastCopy.failed('add the note', result.error, 'Try again'));
      return;
    }
    setShowNoteModal(false);
    setNoteContent('');
    if (children.notes) setOverviewPane('notes');
    if (result.ok) {
      persistMainScroll();
      router.refresh();
      void refreshInsights();
    }
  }, [record.id, router, noteContent, children.notes, refreshInsights, persistMainScroll]);

  const submitFile = useCallback(async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('recordId', record.id);
      const response = await fetch('/api/crm/attachments', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Failed to upload file');
      toast.success(toastCopy.added('File'));
      setShowUploadModal(false);
      setSelectedFile(null);
      if (children.attachments) setOverviewPane('attachments');
      persistMainScroll();
      router.refresh();
      void refreshInsights();
    } catch (err) {
      console.error(err);
      toast.error(toastCopy.failed('upload the file', err, 'Try again'));
    } finally {
      setIsSubmitting(false);
    }
  }, [record.id, router, selectedFile, children.attachments, persistMainScroll]);

  const handleSendEmail = useCallback(() => {
    if (!record.email) {
      toast.error('This record has no email address');
      return;
    }
    setShowSendEmailDialog(true);
  }, [record.email]);

  /**
   * Called by NoteTemplatePicker after a user picks a template. Pre-fills
   * the existing note modal's textarea with the rendered body so the user
   * can edit before saving — the save path is unchanged.
   */
  const handleApplyNoteTemplate = useCallback(
    (body: string) => {
      setNoteContent(body);
      setShowNoteModal(true);
    },
    [],
  );

  // Owner label used when rendering templates (falls back gracefully).
  const ownerLabel = useMemo(() => {
    const rec = record as unknown as Record<string, unknown>;
    const candidates = [
      rec.owner_name,
      rec.assigned_to_name,
      (rec.owner as Record<string, unknown> | undefined)?.full_name,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c;
    }
    return null;
  }, [record]);

  // Keyboard shortcuts (Zoho-parity). Inert when an input is focused —
  // see `useRecordHotkeys` for the full ignore rules.
  useRecordHotkeys(
    {
      edit: handleEditRecord,
      note: handleAddNote,
      task: handleAddTask,
      email: handleSendEmail,
      upload: handleUploadFile,
      search: () => {
        // Focus the inline "find in this record" header input (not global CRM search).
        const el = document.querySelector<HTMLInputElement>(
          'input[data-inline-record-search]',
        );
        el?.focus();
      },
      help: () => setShowShortcutsDialog(true),
      call: () => {
        // If there's a phone number, let the OS handle dialling; otherwise
        // open the task modal in "call" mode so the user can still log one.
        if (record.phone) {
          window.location.href = `tel:${record.phone}`;
        } else {
          setShowTaskModal(true);
        }
      },
    },
    !showSendEmailDialog &&
      !showTemplatePicker &&
      !showCustomizeDialog &&
      !showShortcutsDialog &&
      !showConvertDialog &&
      !showEnrollDialog &&
      !showNoteModal &&
      !showTaskModal &&
      !showUploadModal &&
      !showNotesDrawer,
  );

  // Collaborative signals: who else is on this record right now, and
  // live-refresh when someone else edits the record or adds a note /
  // task / attachment. Toasts intentionally only fire for events from
  // *other* users, via `useLiveRecord`'s `isSelf` flag.
  const { user: clientUser, profile: clientProfile } = useClientAuth();
  const viewerCanNormalize =
    clientProfile?.crm_role === 'crm_admin' || clientProfile?.crm_role === 'crm_manager';
  const {
    participants: presenceParticipants,
    setIntent: setPresenceIntent,
    fieldLocks,
    acquireFieldLock,
    releaseFieldLock,
  } = useRecordPresence(record.id);

  useRecentlyViewedTracker(record.id, module?.key);

  const handleLiveEvent = useCallback(
    (event: LiveRecordEvent) => {
      if (event.isSelf) return;

      // Record-level edits: revalidate the RSC so updated fields render.
      if (event.table === 'crm_records' && event.type === 'UPDATE') {
        const actor = (event.new?.updated_by as string | undefined) ?? null;
        if (fieldSavePendingRef.current > 0) {
          toast.info('A teammate updated this record.', {
            description: 'Your unsaved edits were kept. Reload when you are ready.',
            duration: 4000,
          });
          return;
        }
        toast.info('This record was just updated by a teammate.', {
          description: actor
            ? 'Their changes are loading now.'
            : 'Refreshing to pick up their changes.',
          duration: 3000,
        });
        persistMainScroll();
        router.refresh();
        void refreshInsights();
        return;
      }

      // Dependent-table inserts/updates: just nudge insights + toast.
      const label: Record<string, string> = {
        crm_notes: 'Someone else added a note',
        crm_tasks: 'Someone else updated activities',
        crm_attachments: 'Someone else uploaded a file',
        crm_stage_history: 'Stage was updated',
        crm_audit_logs: 'Someone else updated this record',
      };
      const text = label[event.table] ?? 'Someone else updated this record';
      toast.info(text, { duration: 2500 });
      void refreshInsights();
    },
    // `router` and `refreshInsights` are stable across renders. Including
    // them here keeps lint happy without triggering subscription churn.
    [router, refreshInsights, persistMainScroll],
  );

  useLiveRecord({
    recordId: record.id,
    currentUserId: clientUser?.id ?? clientProfile?.user_id ?? null,
    onEvent: handleLiveEvent,
  });

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setOptimisticStatus(newStatus);
      try {
        const res = await fetch(`/api/crm/records/${record.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, reason: 'Manual CRM status change' }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed');
        }
        toast.success(toastCopy.updated('Status'), { description: `Now ${newStatus}` });
        // Mark the commit timestamp so the optimistic-clear effect
        // ignores stale server props that arrive before the RSC cache
        // has propagated the revalidation.
        statusCommittedAtRef.current = Date.now();
        // Small delay lets revalidatePath propagate before the RSC
        // re-fetch, reducing the chance of receiving stale data.
        await new Promise((r) => setTimeout(r, 150));
        router.refresh();
      } catch (err) {
        setOptimisticStatus(null);
        toast.error(toastCopy.failed('update the status', err, 'Try again'));
      }
    },
    [record.id, router],
  );

  // -------------------------------------------------------------------------
  // Nav items (counts come from whatever data the page has already fetched).
  // Panels without data yet surface a "Soon" chip; nothing ever errors.
  // -------------------------------------------------------------------------
  // Full default set (order matters — this is the "factory" layout).
  const defaultNavItems: RelatedListNavItem[] = useMemo(() => {
    const counts = insights?.counts;
    return [
      // NOTE: id must match the `OverviewPane` value rendered by
      // `renderOverviewPane()` ('details'). It was historically 'overview',
      // which collided with the top-tab name and rendered an empty pane.
      { id: 'details', label: 'Details', count: null, available: true },
      { id: 'notes', label: 'Notes', count: noteTotal, available: !!children.notes },
      {
        id: 'emails',
        label: 'Emails',
        count: counts?.emails ?? null,
        available: !!children.communications,
      },
      {
        // Open + Closed merged into one chip; the pane has an Open/Closed toggle.
        id: 'activities',
        label: 'Activities',
        count:
          counts && (counts.open_activities != null || counts.closed_activities != null)
            ? (counts.open_activities ?? 0) + (counts.closed_activities ?? 0)
            : null,
        available: true,
      },
      {
        id: 'attachments',
        label: 'Attachments',
        count: counts?.attachments ?? null,
        available: !!children.attachments,
      },
      {
        id: 'related',
        label: 'Connected Records',
        count: counts?.related ?? null,
        available: !!children.related,
      },
      {
        id: 'campaigns',
        label: 'Campaigns',
        count: counts?.campaigns ?? null,
        available: true,
      },
      {
        id: 'cadences',
        label: 'Cadences',
        count: counts?.cadences ?? null,
        available: true,
      },
      {
        id: 'products',
        label: 'Products',
        count: counts?.products ?? null,
        available: true,
      },
      {
        id: 'visits',
        label: 'Visits',
        count: counts?.visits ?? null,
        available: true,
      },
      {
        id: 'social',
        label: 'Social',
        count: counts?.social ?? null,
        available: true,
      },
      {
        id: 'meetings',
        label: 'Invited Meetings',
        count: counts?.meetings ?? null,
        available: true,
      },
    ];
  }, [children, noteTotal, insights]);

  /**
   * Visible nav items = user's saved order (if any) ∩ default set. Unknown
   * IDs in the saved order are dropped silently — forward-compatible with
   * future panels. "details" is always pinned to the top so users can't
   * accidentally hide the Details pane.
   */
  const navItems: RelatedListNavItem[] = useMemo(() => {
    const byId = new Map(defaultNavItems.map((item) => [item.id, item]));
    // No saved order → the lean default strip (Details · Notes · Emails ·
    // Activities · Attachments · Connected Records). Everything else stays one
    // click away in Customize.
    const source: readonly string[] =
      !customOrder || customOrder.length === 0
        ? DEFAULT_VISIBLE_RELATED_LIST_IDS
        : customOrder;
    // Back-compat: the Details pane id used to be persisted as 'overview',
    // and Open/Closed Activities were two chips (now one).
    const normalized = source.map((id) =>
      id === 'overview'
        ? 'details'
        : id === 'open_activities' || id === 'closed_activities'
          ? 'activities'
          : id,
    );
    const ordered: RelatedListNavItem[] = [];
    const seen = new Set<string>();
    // Details is always pinned to the top regardless of saved order.
    if (byId.has('details')) {
      ordered.push(byId.get('details')!);
      seen.add('details');
    }
    for (const id of normalized) {
      if (seen.has(id)) continue;
      const it = byId.get(id);
      if (it) {
        ordered.push(it);
        seen.add(id);
      }
    }
    return ordered;
  }, [defaultNavItems, customOrder]);

  /**
   * Open Customize. The dialog seeds its working copy from the SAVED order,
   * falling back to the same lean default strip the chips render
   * (`defaultOrder`), so Pinned/Available mirror what the user sees — without
   * writing anything to ui_preferences until they press "Save layout".
   */
  const openCustomizeDialog = useCallback(() => {
    setShowCustomizeDialog(true);
  }, []);

  // Catalog used by the customize dialog (full superset, even hidden items).
  const customizeCatalog: CustomizeRelatedListsItem[] = useMemo(
    () =>
      defaultNavItems.map((item) => ({
        id: item.id,
        label: item.label,
        available: item.available,
        comingSoonHint: item.comingSoonHint,
      })),
    [defaultNavItems],
  );

  // Shape insights.bestTime for the panel props (it expects label + optional hint).
  const bestTimeSlots = useMemo(() => {
    const base = [
      { channel: 'call' as const, label: 'Call' },
      { channel: 'email' as const, label: 'Email' },
    ];
    return base.map((slot) => {
      const found = insights?.bestTime.find((b) => b.channel === slot.channel);
      return {
        channel: slot.channel,
        label: slot.label,
        value: found?.value ?? null,
        hint: found?.hint,
      };
    });
  }, [insights]);

  // -------------------------------------------------------------------------
  // External links (from record.data.links) — editable via future dialog.
  // -------------------------------------------------------------------------
  const links: RecordRelatedListLink[] = useMemo(() => {
    if (localLinksOverride) return localLinksOverride;
    const raw = (record.data as Record<string, unknown> | undefined)?.links;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry, idx): RecordRelatedListLink | null => {
        if (typeof entry === 'string') {
          return { id: `link-${idx}`, label: entry, href: entry, external: true };
        }
        if (entry && typeof entry === 'object') {
          const obj = entry as Record<string, unknown>;
          const href = typeof obj.href === 'string' ? obj.href : typeof obj.url === 'string' ? (obj.url as string) : null;
          if (!href) return null;
          const label = typeof obj.label === 'string' ? obj.label : href;
          return { id: `link-${idx}`, label, href, external: true };
        }
        return null;
      })
      .filter((x): x is RecordRelatedListLink => !!x);
  }, [record.data, localLinksOverride]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const recordMarketType = (record as any).market_type as string | undefined;
  const recordEffectiveStartDate = resolveEffectiveStartDate({
    current_year_start_date: (record as any).current_year_start_date,
    original_start_date: (record as any).original_start_date,
    data: (record.data as Record<string, unknown> | null) ?? null,
  });
  const showChangeHistory =
    recordMarketType === 'healthshare' || recordMarketType === 'traditional_insurance';
  const linkedMemberId = (record.data as Record<string, unknown> | null)?.linked_member_id as
    | string
    | undefined;
  const membershipChangeCount = (() => {
    const raw = (record.data as Record<string, unknown> | null)?.membership_changes;
    return Array.isArray(raw) ? raw.length : 0;
  })();

  /**
   * Screen-one context strip: plan/dependent history + the last few notes.
   * Rendered INSIDE the field stack (DynamicRecordForm `beforeSections`, via
   * RecordOverviewSlotsProvider) so the details pane reads: section jump bar →
   * Coverage Snapshot → histories → recent notes → section cards. Each history
   * block is a native <details> so it is keyboard-toggleable and collapses to a
   * one-line summary. Memoised so unrelated shell state (scroll compaction,
   * menus) does not re-render the whole field stack through the slot context.
   */
  const hasNotesPane = Boolean(children.notes);
  const detailsBeforeSections: React.ReactNode = useMemo(
    () => (
    <>
      {(showChangeHistory || linkedMemberId) && (
        <div className="space-y-2">
          {showChangeHistory && (
            <CompactContextBlock
              icon={ClipboardList}
              title="Plan changes"
              summary={
                membershipChangeCount > 0
                  ? `${membershipChangeCount} change${membershipChangeCount === 1 ? '' : 's'}`
                  : 'No plan changes recorded'
              }
              defaultOpen={membershipChangeCount > 0}
            >
              <MembershipChangeHistory
                data={(record.data ?? null) as Record<string, unknown> | null}
                recordId={record.id}
                recordTitle={getRecordDisplayName(record)}
                syncedToMms={
                  (record.system as Record<string, unknown> | null)?.synced === true ||
                  (record.system as Record<string, unknown> | null)?.synced === 'true' ||
                  Boolean(linkedMemberId)
                }
              />
            </CompactContextBlock>
          )}
          {linkedMemberId && (
            <>
              <CompactContextBlock
                icon={Users}
                title="Dependents"
                summary="Who is covered, and since when"
                defaultOpen
              >
                <DependentCoverageHistory memberId={linkedMemberId} />
              </CompactContextBlock>
              <CompactContextBlock
                icon={LifeBuoy}
                title="Support tickets"
                summary="Member support history"
                defaultOpen={false}
              >
                <MemberSupportTickets memberId={linkedMemberId} />
              </CompactContextBlock>
            </>
          )}
        </div>
      )}

      <RecentNotesStrip
        notes={sortedNotes}
        total={noteTotal}
        onAddNote={handleAddNote}
        onViewAll={() => {
          if (hasNotesPane) setOverviewPane('notes');
          else setShowNotesDrawer(true);
        }}
      />
    </>
    ),
    [
      showChangeHistory,
      linkedMemberId,
      membershipChangeCount,
      record,
      sortedNotes,
      noteTotal,
      handleAddNote,
      hasNotesPane,
    ],
  );

  const renderOverviewPane = (): React.ReactNode => {
    switch (overviewPane) {
      case 'details':
        // Section jump bar + Coverage Snapshot + [beforeSections] + field
        // sections. The page builds `children.overview` (RecordOverviewPanel),
        // so the shell-owned blocks reach the form through the slot context.
        return (
          <RecordOverviewSlotsProvider beforeSections={detailsBeforeSections}>
            {children.overview}
          </RecordOverviewSlotsProvider>
        );
      case 'notes':
        return (
          <div data-record-notes-pane>
            {children.notes ?? <ComingSoon label="Notes" hint="Notes are available in the classic view." />}
          </div>
        );
      case 'emails':
        return children.communications ?? <ComingSoon label="Emails" hint="Email history is not enabled for this record." />;
      case 'activities':
      case 'closed_activities':
        return (
          <div>
            <div
              role="tablist"
              aria-label="Activity state"
              className="mb-3 inline-flex rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-0.5 text-xs font-medium"
            >
              {(
                [
                  ['open', 'Open', insights?.counts?.open_activities],
                  ['closed', 'Closed', insights?.counts?.closed_activities],
                ] as const
              ).map(([mode, label, count]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={activitiesMode === mode}
                  onClick={() => setActivitiesMode(mode)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    activitiesMode === mode
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                  )}
                >
                  {label}
                  {typeof count === 'number' && count > 0 && (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 px-1 text-[10px] font-semibold text-slate-600 dark:text-slate-200">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <RecordTasksPanel recordId={record.id} mode={activitiesMode} />
          </div>
        );
      case 'attachments':
        return children.attachments ?? <ComingSoon label="Attachments" hint="No attachments panel is wired for this module." />;
      case 'related':
        return children.related ?? <ComingSoon label="Connected Records" hint="Relationship browser is empty." />;
      case 'campaigns':
        return <RecordCampaignsPanel recordId={record.id} />;
      case 'cadences':
        return <RecordCadencesPanel recordId={record.id} />;
      case 'products':
        return <RecordProductsPanel recordId={record.id} />;
      case 'visits':
        return <RecordVisitsPanel recordId={record.id} />;
      case 'social':
        return <RecordSocialPanel recordId={record.id} />;
      case 'meetings':
        return <RecordMeetingsPanel recordId={record.id} recordEmail={record.email} />;
      default:
        return <ComingSoon label={labelFromPane(overviewPane)} hint="This related list ships in a later PR." />;
    }
  };

  return (
    <RecordFieldSaveProvider
      recordId={record.id}
      initialUpdatedAt={record.updated_at ?? null}
      fieldLabels={fieldLabelMap}
      onSaved={() => {
        persistMainScroll();
        scheduleRecordRefresh();
      }}
      onConflict={({ field }) => {
        toast.error('This record was updated by someone else', {
          description: `Your change to "${field}" wasn't saved. Reload to see the latest.`,
          action: {
            label: 'Reload',
            onClick: () => router.refresh(),
          },
        });
      }}
    >
    <NoteComposeProvider composeNonce={notesComposeNonce} requestCompose={requestNoteCompose}>
    <FieldSavePendingBridge pendingRef={fieldSavePendingRef} />
    <RecordFieldLocksProvider
      fieldLocks={fieldLocks}
      acquireFieldLock={acquireFieldLock}
      releaseFieldLock={releaseFieldLock}
    >
    <RecordAiContextProvider recordId={record.id} enabled>
    <div className={cn('flex h-full min-h-0', className)}>
      <main
        ref={recordMainScrollRef}
        className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] [overflow-anchor:none]"
        data-record-find-root
      >
        {/* Sticky header — compacts on scroll so title + key fields stay visible */}
        <div
          ref={recordStickyHeaderRef}
          className={cn(
            // Opaque sticky paint (no backdrop-blur / alpha): translucent sticky
            // layers composite content underneath and read as top-half flicker
            // in Chromium/Brave. No padding/height transition either — that
            // fights scroll anchoring and looks like shake/skip.
            // Stack inside [data-record-find-root]: content 0, SectionNav 15,
            // this header 20, open inline dropdown 30. Idle field z-20 used
            // to paint labels through this bar on scroll.
            'sticky top-0 z-20 isolate bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-white/5 transition-shadow duration-200 [overflow-anchor:none]',
            headerCompact && 'shadow-md shadow-slate-200/50 dark:shadow-black/20',
          )}
        >
          <div className={cn('w-full px-4 xl:px-6', headerCompact ? 'py-2' : 'py-2.5')}>
            {/* Breadcrumb + search */}
            {!headerCompact && (
            <div className="flex items-center justify-between gap-4 mb-2">
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0">
                {cameFromDashboard ? (
                  <>
                    <Link
                      href={backUrl}
                      className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden />
                      <LayoutDashboard className="w-3.5 h-3.5" aria-hidden />
                      Dashboard
                    </Link>
                    <span className="text-slate-300 dark:text-slate-600 shrink-0" aria-hidden>/</span>
                    <Link
                      href={moduleListUrl}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                    >
                      {module.name_plural || module.name}
                    </Link>
                  </>
                ) : (
                  <Link
                    href={backUrl}
                    title={backUrl !== moduleListUrl ? 'Back to your list (filters kept)' : undefined}
                    className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden />
                    {module.name_plural || module.name}
                  </Link>
                )}
                <span className="text-slate-300 dark:text-slate-600 shrink-0" aria-hidden>/</span>
                <span
                  className="text-sm text-slate-900 dark:text-white truncate max-w-xs"
                  title={getRecordDisplayName(record)}
                  aria-current="page"
                >
                  {getRecordDisplayName(record)}
                </span>
              </nav>
              <div className="hidden md:flex items-center gap-3">
                <RecordToolbarGlobalSearch currentRecordId={record.id} />
                <InlineRecordSearch
                  record={record}
                  fields={_fields}
                  moduleKey={module.key}
                  noteBodies={notesProp.map((n) => n.body)}
                  onNavigateToMatch={handleNavigateToMatch}
                />
              </div>
            </div>
            )}

            {/* Title row — IdentityActionsHeader owns overflow-safe flex. */}
            <IdentityActionsHeader
              breakpoint="xl"
              align={headerCompact ? 'center' : 'start'}
              className={cn(headerCompact && 'gap-2')}
              actionsClassName={cn(
                'min-w-0 xl:max-w-[min(100%,36rem)]',
                headerCompact && 'gap-1',
              )}
              leading={
                <RecordAvatarTile
                  name={getRecordDisplayName(record)}
                  moduleKey={module.key}
                  size={headerCompact ? 'sm' : 'lg'}
                />
              }
              identity={
                <>
                  <h1
                    className={cn(
                      'font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-x-2 gap-y-0 min-w-0',
                      headerCompact ? 'text-base' : 'text-2xl',
                    )}
                  >
                    <InlineFieldEditor
                      field="title"
                      value={record.title || ''}
                      placeholder="Untitled"
                      ariaLabel="Record title"
                      onEditStart={() => void setPresenceIntent('editing')}
                      onEditEnd={() => void setPresenceIntent('viewing')}
                      validate={(v) =>
                        v.trim().length === 0 ? 'Title cannot be empty' : null
                      }
                      className="min-w-0 max-w-full"
                      inputClassName={headerCompact ? 'text-base font-bold' : 'text-2xl font-bold'}
                    />
                    {!headerCompact && (
                    <UnsavedChangesPill
                      className="font-normal text-[11px]"
                      recordId={record.id}
                    />
                    )}
                  </h1>
                  {!headerCompact && (
                  <RecordTagsRow
                    recordId={record.id}
                    recordData={record.data as Record<string, unknown> | undefined}
                    readOnly={isAlreadyConverted && isLeads}
                    className="mt-1.5"
                  />
                  )}
                  {/* Meta row: email, phone, status, badges — always visible when sticky */}
                  <div className={cn('flex items-center gap-x-3 gap-y-1.5 flex-wrap', headerCompact ? 'mt-0.5' : 'mt-2')}>
                    <span className="group inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 min-w-0 max-w-full">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <InlineFieldEditor
                        field="email"
                        value={record.email || ''}
                        type="email"
                        placeholder="Add email"
                        ariaLabel="Record email"
                        onEditStart={() => void setPresenceIntent('editing')}
                        onEditEnd={() => void setPresenceIntent('viewing')}
                        validate={(v) => {
                          if (!v) return null;
                          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
                            ? null
                            : 'Invalid email';
                        }}
                        className="min-w-0"
                        display={(v) =>
                          v ? (
                            <a
                              href={`mailto:${v}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors break-all"
                            >
                              {v}
                            </a>
                          ) : null
                        }
                      />
                      {record.email && <HeaderCopyButton value={record.email} />}
                    </span>
                    <span className="group inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <InlineFieldEditor
                        field="phone"
                        value={record.phone || ''}
                        type="tel"
                        placeholder="Add phone"
                        ariaLabel="Record phone"
                        onEditStart={() => void setPresenceIntent('editing')}
                        onEditEnd={() => void setPresenceIntent('viewing')}
                        className="whitespace-nowrap"
                        display={(v) =>
                          v ? (
                            <a
                              href={`tel:${v}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors whitespace-nowrap"
                            >
                              {v}
                            </a>
                          ) : null
                        }
                      />
                      {record.phone && <HeaderCopyButton value={record.phone} />}
                    </span>
                    {displayStatus && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 cursor-pointer hover:ring-2 hover:ring-teal-500/30 rounded-full transition-all">
                            {/* ONE status colour system: lane tone (lib/crm/status-lanes)
                                — the same tone RecordTable / ListView / the dashboard use. */}
                            <StatusBadge
                              status={displayStatus}
                              tone={statusToneForValue(displayStatus)}
                              label={relabelStatusForMarket(displayStatus, recordMarketType)}
                              className="transition-colors"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 min-w-[200px] max-h-80 overflow-y-auto"
                        >
                          {[
                            { label: 'Status', items: getCoreStatusPickerItems(recordMarketType) },
                            { label: 'Enrollment', items: ['Enrolled - 2025', 'Enrolled - 2026', 'Enrolled Member', 'Approved Pending'] },
                            { label: 'Close', items: ['Cancelled', 'Cancellation Pending', 'Terminated', 'Suspended', 'Archived', 'Converted'] },
                          ].map((group) => (
                            <div key={group.label}>
                              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {group.label}
                              </DropdownMenuLabel>
                              {group.items.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  disabled={s === displayStatus}
                                  className={cn(
                                    'text-sm',
                                    s === displayStatus && 'opacity-50',
                                    (s.startsWith('Active') || s.startsWith('Enrolled')) && 'text-emerald-600 dark:text-emerald-400',
                                    (s === 'Inactive' || s === 'In-Active' || s === 'Terminated' || s === 'Cancelled' || s === 'Suspended') &&
                                      'text-red-600 dark:text-red-400',
                                  )}
                                  onSelect={() => handleStatusChange(s)}
                                >
                                  {relabelStatusForMarket(s, recordMarketType)}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!isLeads && !headerCompact && <MarketTypeBadge marketType={(record as any).market_type} showIcon size="sm" />}
                    {!isLeads && !headerCompact && <NormalizationBadge status={(record as any).normalization_status} size="sm" />}
                    {!headerCompact && (() => {
                      const data = record.data as Record<string, unknown> | undefined;
                      const capacities: string[] = [];
                      if (data?.product_type && typeof data.product_type === 'string') capacities.push(data.product_type);
                      else if (Array.isArray(data?.capacities)) capacities.push(...(data.capacities as string[]));
                      return capacities.length > 0 ? <CapacityBadges capacities={capacities} size="sm" /> : null;
                    })()}
                    {isLeads && isAlreadyConverted && getConvertedContactId(record.data as Record<string, unknown>) && (
                      <Link
                        href={keepReturnTo(`/crm/r/${String(getConvertedContactId(record.data as Record<string, unknown>))}`)}
                        className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        View Contact
                      </Link>
                    )}
                  </div>
                </>
              }
              actions={
                <>
                {!headerCompact && (
                <PresenceStack
                  participants={presenceParticipants}
                  moduleKey={module.key}
                  className="mr-1"
                />
                )}
                {/* ONE Convert… control for leads (contacts get "Enroll" under ⋯). */}
                {!headerCompact && isLeads && (canConvertToContact || canConvertToMember) && (
                  <ConvertLeadMenu
                    canAddContact={canConvertToContact}
                    canEnroll={canConvertToMember}
                    enrollLabel={enrollLabel}
                    enrollNoun={enrollNoun}
                    effectiveStartDate={recordEffectiveStartDate}
                    onAddContact={() => setShowConvertDialog(true)}
                    onEnroll={() => setShowEnrollDialog(true)}
                    size="sm"
                  />
                )}

                {/* Outline so Add Note is the one filled primary in the header. */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!record.email}
                  title={
                    record.email ? 'Compose email to this record' : 'Add an email on this record to enable send'
                  }
                  onClick={() => void handleSendEmail()}
                  className="inline-flex shrink-0 font-medium lg:hidden"
                >
                  <Mail className="w-4 h-4 shrink-0 sm:mr-1.5" />
                  <span className="text-xs font-medium sm:text-sm">
                    <span className="sm:hidden">Email</span>
                    <span className="hidden sm:inline">Send Email</span>
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0 lg:hidden"
                  onClick={handleEditRecord}
                >
                  <Edit className="w-4 h-4 min-[380px]:mr-1.5" />
                  <span className="hidden min-[380px]:inline">Edit</span>
                </Button>

                {/* Add Note is THE note action (also the `n` hotkey). It stays
                    visible in the compact sticky header — notes are the
                    highest-frequency action on a record. The chevron holds the
                    template picker as a secondary path. */}
                <div className="flex items-stretch shrink-0" role="group" aria-label="Add note">
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleAddNote}
                    title="Add a note (n)"
                    className="rounded-r-none shadow-sm"
                  >
                    <StickyNote className="w-4 h-4 sm:mr-1.5" aria-hidden />
                    <span className="hidden sm:inline">Add Note</span>
                    <span className="inline sm:hidden text-xs font-medium">Note</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="rounded-l-none border-l border-white/30 px-1.5 shadow-sm"
                        aria-label="Add note from a template"
                        title="Note templates"
                      >
                        <ChevronDown className="w-4 h-4" aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 w-56"
                    >
                      <DropdownMenuLabel className="text-xs text-slate-500">
                        Note templates
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={handleAddNote}>
                        Blank note
                        <kbd className="ml-auto inline-flex h-5 items-center justify-center rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1.5 text-[10px] font-medium text-slate-500">
                          n
                        </kbd>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                      {(
                        [
                          ['discovery-call', 'Discovery call'],
                          ['voicemail-left', 'Voicemail left'],
                          ['follow-up-required', 'Follow-up required'],
                        ] as const
                      ).map(([templateId, label]) => (
                        <DropdownMenuItem
                          key={templateId}
                          onClick={() => {
                            import('@/lib/crm/note-templates').then(
                              ({ DEFAULT_NOTE_TEMPLATES, renderNoteTemplate }) => {
                                const tmpl = DEFAULT_NOTE_TEMPLATES.find((t) => t.id === templateId);
                                if (tmpl) {
                                  handleApplyNoteTemplate(
                                    renderNoteTemplate(tmpl, {
                                      name: record.title,
                                      email: record.email,
                                      phone: record.phone,
                                      owner: ownerLabel,
                                    }),
                                  );
                                }
                              },
                            );
                          }}
                        >
                          {label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                      <DropdownMenuItem onClick={() => setShowTemplatePicker(true)}>
                        Browse all templates…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="More actions"
                      title="More actions"
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      <MoreHorizontal className="w-5 h-5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
                  >
                    <DropdownMenuItem
                      className="hidden lg:flex"
                      onClick={handleEditRecord}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!record.email}
                      onClick={() => void handleSendEmail()}
                      title={!record.email ? 'Add an email address on this record first' : undefined}
                    >
                      <Mail className="w-4 h-4 mr-2 text-rose-600" />
                      Send email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openCustomizeDialog}>
                      Customize related lists
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowTemplatePicker(true)}>
                      <StickyNote className="w-4 h-4 mr-2" />
                      Note templates…
                    </DropdownMenuItem>
                    {/* Set Reminder lives here (not in the header row) so the
                        header reads Email · Edit · Add Note · ⋯ */}
                    <DropdownMenuItem
                      onClick={() => setShowFollowUpDialog(true)}
                      title="Set a follow-up reminder for this record"
                    >
                      <Bell className="w-4 h-4 mr-2" aria-hidden />
                      Set reminder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}/clone`, { method: 'POST' });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Clone failed');
                          toast.success(toastCopy.added(`Copy of this ${module.name.toLowerCase()}`));
                          router.push(keepReturnTo(`/crm/r/${data.id}`));
                        } catch (err) {
                          toast.error(toastCopy.failed('clone the record', err, 'Try again'));
                        }
                      }}
                    >
                      Clone Record
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                      Merge Duplicate…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => window.print()}>Print</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowShortcutsDialog(true)}>
                      Keyboard shortcuts
                      <kbd className="ml-auto inline-flex h-5 items-center justify-center rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-1.5 text-[10px] font-medium text-slate-500">
                        ?
                      </kbd>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={() => setTopTab('privacy')}
                      aria-current={topTab === 'privacy' ? 'page' : undefined}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Data Privacy
                    </DropdownMenuItem>
                    {/* Convert paths stay reachable when the header is compact
                        (the Convert… menu hides on scroll) and for contacts. */}
                    {(canConvertToContact || canConvertToMember) &&
                      (headerCompact || !isLeads) && (
                        <>
                          <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                          {canConvertToContact && (
                            <DropdownMenuItem
                              className="text-sky-700 dark:text-sky-400"
                              onClick={() => setShowConvertDialog(true)}
                            >
                              <UserPlus className="w-4 h-4 mr-2" aria-hidden />
                              Add as Contact
                            </DropdownMenuItem>
                          )}
                          {canConvertToMember && (
                            <DropdownMenuItem
                              className="text-emerald-600 dark:text-emerald-400"
                              onClick={() => setShowEnrollDialog(true)}
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" aria-hidden />
                              {enrollLabel}
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-500/10"
                      onClick={async () => {
                        if (!(await confirmDialog({ title: `Delete this ${module.name.toLowerCase()}?`, description: 'This action cannot be undone.', confirmLabel: 'Delete', destructive: true })))
                          return;
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error || 'Delete failed');
                          }
                          toast.success(toastCopy.deleted(module.name));
                          router.push(backUrl);
                        } catch (err) {
                          toast.error(toastCopy.failed('delete the record', err, 'Try again'));
                        }
                      }}
                    >
                      Delete Record
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
              }
            />

            {/* Top tabs: Overview / Timeline / Data Privacy */}
            <div className={cn('-mb-px', headerCompact ? 'mt-2' : 'mt-3')}>
              <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
                <TabsList className="bg-transparent border-b border-slate-200 dark:border-white/5 w-full justify-start gap-0 h-auto p-0">
                  <TabsTrigger
                    value="overview"
                    onClick={() => setOverviewPane('details')}
                    className={cn(
                      'px-4 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors',
                      headerCompact ? 'py-2' : 'py-3',
                    )}
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="timeline"
                    className={cn(
                      'px-4 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors',
                      headerCompact ? 'py-2' : 'py-3',
                    )}
                  >
                    <ClockIcon className="w-4 h-4 mr-1.5" />
                    Timeline
                  </TabsTrigger>
                  {topTab === 'privacy' && (
                  <TabsTrigger
                    value="privacy"
                    className={cn(
                      'px-4 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors',
                      headerCompact ? 'py-2' : 'py-3',
                    )}
                  >
                    <Shield className="w-4 h-4 mr-1.5" />
                    Data Privacy
                  </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Related-list + Links cockpit strip — replaces the wide left rail.
              Lives inside the measured sticky header so --record-sticky-offset
              accounts for it and the section jump bar pins directly beneath. */}
          {topTab === 'overview' && overviewPane !== 'details' && (
            <div className="flex items-stretch border-t border-slate-200 dark:border-white/5 bg-white dark:bg-slate-950">
              <RecordRelatedListChips
                items={navItems}
                activeId={overviewPane}
                onSelect={(id) => setOverviewPane(id as OverviewPane)}
                onMore={openCustomizeDialog}
                className="flex-1 border-b-0 bg-transparent dark:bg-transparent"
              />
              <div className="flex items-center border-l border-slate-200 dark:border-white/5 px-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-teal-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-teal-400 transition-colors"
                      aria-label="Record links"
                      title="Links"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Links</span>
                      {links.length > 0 && (
                        <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {links.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 w-60"
                  >
                    <DropdownMenuLabel className="text-xs text-slate-500">Links</DropdownMenuLabel>
                    {links.length > 0 ? (
                      links.map((link) => (
                        <DropdownMenuItem key={link.id} asChild>
                          <a href={link.href} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{link.label}</span>
                          </a>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>No links yet</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem onClick={() => setShowLinksEditor(true)}>
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Manage links…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>

        {/* Context banners scroll away so the compact header stays lean */}
        <div className="px-4 xl:px-6">
            {/* Deal stage progress */}
            {isDeals && stages.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Pipeline Progress</span>
                  <StageSelector
                    recordId={record.id}
                    currentStage={record.stage}
                    currentStageLabel={stages.find((s) => s.key === record.stage)?.name}
                    currentStageColor={stages.find((s) => s.key === record.stage)?.color}
                    moduleId={record.module_id}
                  />
                </div>
                <StageIndicator currentStage={record.stage} stages={stages} />
              </div>
            )}

            {/* "Needs Review" is an admin/manager action — reps can't act on
                it, so it only competes with the record for their attention. */}
            {!isLeads && viewerCanNormalize && (
              <NormalizationBanner
                status={(record as any).normalization_status}
                notes={(record as any).normalization_notes}
                className="mt-4"
              />
            )}

            {/* Follow-up reminder banner */}
            <FollowUpBanner
              recordId={record.id}
              refreshKey={followUpRefreshKey}
              className="mt-4"
            />
        </div>

        {/* Body -------------------------------------------------------------- */}
        <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
          <TabsContent value="overview" className="mt-0">
            <div
              className="flex py-3 pb-24 lg:pb-4"
              style={{
                paddingInline: 'var(--crm-gutter, 20px)',
                columnGap: 'var(--crm-section-gap, 24px)',
              }}
            >
              {/* Fields dominate the full viewport — the related-list switcher
                  now lives in the sticky header strip, not a wide left rail. */}
              <div className="flex-1 min-w-0">{renderOverviewPane()}</div>

              {/* Right insights rail — collapsible via the chevron tab so the
                  user can reclaim the full middle column without losing the
                  affordance to bring it back. */}
              {insightsCollapsed ? (
                <button
                  type="button"
                  onClick={() => setInsightsCollapsed(false)}
                  className="hidden xl:flex sticky self-start items-center gap-1 px-1 py-3 rounded-l-lg border border-r-0 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-teal-600 transition-colors"
                  style={{ top: 'var(--record-sticky-offset, 11rem)' }}
                  aria-label="Expand insights panel"
                  title="Show insights"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-wider font-semibold">
                    Insights
                  </span>
                </button>
              ) : (
              <div
                className="hidden xl:flex xl:flex-col gap-1.5 sticky self-start"
                style={{ top: 'var(--record-sticky-offset, 11rem)' }}
              >
              {/* Always-visible collapse control at the top of the rail so it can
                  be closed without hunting for the small link at the bottom. */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInsightsCollapsed(true)}
                  aria-label="Collapse insights panel"
                  title="Hide insights"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-colors"
                >
                  Hide insights
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>
              </div>
              <RecordInsightsPanel
                className="flex"
                lastUpdatedAt={insights?.lastInteractionAt ?? record.updated_at}
                bestTime={bestTimeSlots}
                quickActions={
                  <div className="space-y-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      onClick={handleEditRecord}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Record
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      onClick={handleAddTask}
                    >
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      onClick={handleAddNote}
                    >
                      <StickyNote className="w-4 h-4 mr-2" />
                      Add Note
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                      onClick={handleUploadFile}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload File
                    </Button>
                    {noteTotal > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-primary hover:bg-primary/10"
                        onClick={() => {
                          if (notesProp.length > 0) {
                            setShowNotesDrawer(true);
                          } else {
                            window.dispatchEvent(
                              new CustomEvent('crm:switch-tab', { detail: 'notes' }),
                            );
                          }
                        }}
                      >
                        <StickyNote className="w-4 h-4 mr-2" />
                        View all notes ({noteTotal})
                      </Button>
                    )}
                  </div>
                }
                infoRows={[
                  {
                    label: 'Market',
                    value: <MarketTypeBadge marketType={(record as any).market_type} size="sm" />,
                  },
                  {
                    label: getOwnerLabel((record as any).market_type),
                    value: <OwnershipDisplay record={record as any} size="sm" showLabel={false} />,
                  },
                  {
                    label: 'Created',
                    value: (
                      <span suppressHydrationWarning>
                        {new Date(record.created_at).toLocaleDateString()}
                      </span>
                    ),
                  },
                  {
                    label: 'Updated',
                    value: (
                      <span suppressHydrationWarning>
                        {new Date(record.updated_at).toLocaleDateString()}
                      </span>
                    ),
                  },
                  ...((record as any).import_source && (record as any).import_source !== 'manual'
                    ? [
                        {
                          label: 'Source',
                          value: (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">
                              {(record as any).import_source === 'zoho_csv'
                                ? 'Zoho Import'
                                : (record as any).import_source}
                            </span>
                          ),
                        },
                      ]
                    : []),
                ]}
                extras={
                  <>
                    <RecordBriefingCard
                      recordId={record.id}
                      onCall={() => {
                        window.dispatchEvent(
                          new CustomEvent('crm:quick-action', { detail: 'call' }),
                        );
                      }}
                      onEmail={(goal) => {
                        if (!record.email) return;
                        if (goal) {
                          setAiEmailDraft({
                            subject: '',
                            body: `[Next move] ${goal}\n\n`,
                          });
                        }
                        setShowSendEmailDialog(true);
                      }}
                      onTask={handleAddTask}
                      onFillField={(fieldKey) => {
                        handleNavigateToMatch({ type: 'field', fieldKey });
                      }}
                      onReviewCoverage={() => {
                        handleNavigateToMatch({
                          type: 'field',
                          fieldKey: 'sharing_entity',
                        });
                      }}
                    />
                    <HabitNextBestActions
                      moduleKey={module?.key}
                      stage={
                        typeof (record as { status?: string }).status === 'string'
                          ? (record as { status?: string }).status
                          : null
                      }
                      onEmail={() => {
                        if (record.email) {
                          setShowSendEmailDialog(true);
                        }
                      }}
                      onTask={handleAddTask}
                      onCall={() => {
                        // Composer / call log entry points live on the shell action bus.
                        window.dispatchEvent(
                          new CustomEvent('crm:quick-action', { detail: 'call' }),
                        );
                      }}
                    />
                    <AiFollowUpEmailButton
                      recordId={record.id}
                      hasRecipient={Boolean(record.email)}
                      onDraft={(draft) => {
                        setAiEmailDraft(draft);
                        setShowSendEmailDialog(true);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setInsightsCollapsed(true)}
                      className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-slate-400 hover:text-teal-600 transition-colors"
                      aria-label="Collapse insights panel"
                    >
                      <ChevronDown className="w-3 h-3 -rotate-90" />
                      Hide insights
                    </button>
                  </>
                }
              />
              </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-0">
            <div className="w-full px-4 xl:px-6 py-4 pb-24 lg:pb-4 space-y-4">
              <ComposerBar
                recordId={record.id}
                onNoteCreated={() => {
                  onRefresh?.();
                  void refreshInsights();
                }}
                onTaskCreated={() => {
                  onRefresh?.();
                  void refreshInsights();
                }}
                onCallLogged={() => {
                  onRefresh?.();
                  void refreshInsights();
                }}
              />
              <FilterableTimeline recordId={record.id} />
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="mt-0">
            <div className="w-full px-4 xl:px-6 py-6 pb-24 lg:pb-6">
              <DataPrivacyPanel
                record={record}
                onUpdated={() => router.refresh()}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals and drawers (shared with V1) ----------------------------------- */}
      <Sheet open={showNotesDrawer} onOpenChange={setShowNotesDrawer}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <StickyNote className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Notes
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                {noteTotal}
              </span>
            </SheetTitle>
            <SheetDescription className="text-slate-500 dark:text-slate-400">
              All notes for {record.title || 'this record'}, most recent first.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {sortedNotes.length > 0 ? (
              sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {getNoteAuthorDisplay(note, { showHistorical: true })}
                    </span>
                    <span
                      className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0"
                      title={formatNoteRelative(note.created_at)}
                      suppressHydrationWarning
                    >
                      {formatNoteTimestamp(note.created_at)}
                    </span>
                  </div>
                  {/<[a-z][\s\S]*>/i.test(note.body) ? (
                    <div
                      className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed prose prose-sm max-w-none dark:prose-invert [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md"
                      dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.body) }}
                    />
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {note.body}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <StickyNote className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {noteTotal > 0
                    ? 'Imported notes history is on the Notes tab.'
                    : 'No notes yet.'}
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Task Title *
              </label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Description
              </label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Enter task description..."
                rows={3}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Due Date
              </label>
              <Input
                type="datetime-local"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowTaskModal(false)}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </Button>
              <Button onClick={submitTask} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Add Note</DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You can paste formatted text, tables, and images directly. The date and time are
              stamped automatically when the note is saved.
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <NoteRichArea
              value={noteContent}
              onChange={setNoteContent}
              placeholder="Write a note… Paste formatted enrollment details, tables, etc."
              className="min-h-[320px]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowNoteModal(false)}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </Button>
              <Button onClick={submitNote} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Note'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Upload File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-lg p-6 text-center">
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload-v2"
              />
              <label htmlFor="file-upload-v2" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedFile ? selectedFile.name : 'Click to select a file'}
                </span>
                {selectedFile && (
                  <span className="text-xs text-slate-500 mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={submitFile}
                disabled={isSubmitting || !selectedFile}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload File'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {canConvertToContact && (
        <ConvertToContactDialog
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          recordId={record.id}
          recordTitle={getRecordDisplayName(record)}
          recordData={(record.data || {}) as Record<string, unknown>}
          marketType={recordMarketType}
        />
      )}

      {/* Enrollment confirm dialog — opened from the Convert… menu / ⋯ menu.
          Same component + API path as before; only the trigger moved. */}
      {canConvertToMember && (
        <ConvertLeadButton
          hideTrigger
          open={showEnrollDialog}
          onOpenChange={setShowEnrollDialog}
          recordId={record.id}
          recordTitle={getRecordDisplayName(record)}
          marketType={recordMarketType}
          effectiveStartDate={recordEffectiveStartDate}
          showContactAlternative={isLeads}
        />
      )}

      <MergeRecordDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        moduleKey={module.key}
        moduleName={module.name}
        keeper={{
          id: record.id,
          title: record.title,
          email: record.email,
          phone: record.phone,
          status: record.status,
          owner_id: (record as { owner_id?: string | null }).owner_id ?? null,
          created_at: record.created_at,
        }}
      />

      <SendEmailDialog
        open={showSendEmailDialog}
        onOpenChange={(open) => {
          setShowSendEmailDialog(open);
          // Drop the AI draft once the dialog closes so the next manual
          // open starts clean.
          if (!open) setAiEmailDraft(null);
        }}
        record={{ id: record.id, email: record.email, title: record.title }}
        initialSubject={aiEmailDraft?.subject}
        initialBody={aiEmailDraft?.body}
        onSent={() => {
          router.refresh();
          void refreshInsights();
          if (children.communications) setOverviewPane('emails');
          setAiEmailDraft(null);
        }}
      />

      <NoteTemplatePicker
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        context={{
          name: record.title,
          email: record.email,
          phone: record.phone,
          owner: ownerLabel,
        }}
        onApply={(body) => handleApplyNoteTemplate(body)}
      />

      <CustomizeRelatedListsDialog
        open={showCustomizeDialog}
        onOpenChange={setShowCustomizeDialog}
        moduleKey={module.key}
        catalog={customizeCatalog}
        lockedIds={['details']}
        defaultOrder={DEFAULT_VISIBLE_RELATED_LIST_IDS}
      />

      <RecordLinksEditorDialog
        open={showLinksEditor}
        onOpenChange={setShowLinksEditor}
        recordId={record.id}
        links={links}
        updatedAt={record.updated_at ?? null}
        onSaved={(saved) => {
          setLocalLinksOverride(saved);
          scheduleRecordRefresh();
        }}
      />

      <KeyboardShortcutsDialog
        open={showShortcutsDialog}
        onOpenChange={setShowShortcutsDialog}
      />

      <FollowUpReminderDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        recordId={record.id}
        recordTitle={getRecordDisplayName(record)}
        onCreated={() => setFollowUpRefreshKey((k) => k + 1)}
      />

      {/* Mobile bottom action bar — lg:hidden, renders only on narrow
          viewports. Call / Email / Note / Insights. The Insights slot
          opens the right-rail panel in a bottom Sheet since the rail
          itself is hidden below xl. */}
      <MobileActionBar
        hasPhone={Boolean(record.phone)}
        hasEmail={Boolean(record.email)}
        onCall={() => {
          if (record.phone) {
            window.location.href = `tel:${record.phone}`;
          } else {
            setShowTaskModal(true);
          }
        }}
        onEmail={handleSendEmail}
        onNote={handleAddNote}
        onMore={() => setInsightsSheetOpen(true)}
      />

      {/* Insights sheet (mobile/tablet) — mirrors the right rail content
          so reps can still see "Best time to call", quick actions, and
          record info without a desktop viewport. */}
      <Sheet open={insightsSheetOpen} onOpenChange={setInsightsSheetOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 max-h-[85vh] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-slate-900 dark:text-white">Insights</SheetTitle>
            <SheetDescription className="text-slate-500 dark:text-slate-400">
              Best time to reach out, quick actions, and record info.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <RecordInsightsPanel
              className="w-full"
              lastUpdatedAt={insights?.lastInteractionAt ?? record.updated_at}
              bestTime={bestTimeSlots}
              quickActions={
                <div className="space-y-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => {
                      setInsightsSheetOpen(false);
                      handleEditRecord();
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Record
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => {
                      setInsightsSheetOpen(false);
                      handleAddTask();
                    }}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                    onClick={() => {
                      setInsightsSheetOpen(false);
                      handleUploadFile();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                  {canConvertToContact && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10"
                      onClick={() => {
                        setInsightsSheetOpen(false);
                        setShowConvertDialog(true);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" aria-hidden />
                      Add as Contact
                    </Button>
                  )}
                  {canConvertToMember && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      onClick={() => {
                        setInsightsSheetOpen(false);
                        setShowEnrollDialog(true);
                      }}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" aria-hidden />
                      {enrollLabel}
                    </Button>
                  )}
                </div>
              }
              infoRows={[
                {
                  label: 'Market',
                  value: <MarketTypeBadge marketType={(record as any).market_type} size="sm" />,
                },
                {
                  label: getOwnerLabel((record as any).market_type),
                  value: <OwnershipDisplay record={record as any} size="sm" showLabel={false} />,
                },
                {
                  label: 'Created',
                  value: (
                    <span suppressHydrationWarning>
                      {new Date(record.created_at).toLocaleDateString()}
                    </span>
                  ),
                },
                {
                  label: 'Updated',
                  value: (
                    <span suppressHydrationWarning>
                      {new Date(record.updated_at).toLocaleDateString()}
                    </span>
                  ),
                },
              ]}
              extras={
                <>
                <RecordBriefingCard
                  recordId={record.id}
                  onCall={() => {
                    window.dispatchEvent(
                      new CustomEvent('crm:quick-action', { detail: 'call' }),
                    );
                  }}
                  onEmail={(goal) => {
                    if (!record.email) return;
                    if (goal) {
                      setAiEmailDraft({
                        subject: '',
                        body: `[Next move] ${goal}\n\n`,
                      });
                    }
                    setShowSendEmailDialog(true);
                  }}
                  onTask={handleAddTask}
                  onFillField={(fieldKey) => {
                    handleNavigateToMatch({ type: 'field', fieldKey });
                  }}
                  onReviewCoverage={() => {
                    handleNavigateToMatch({
                      type: 'field',
                      fieldKey: 'sharing_entity',
                    });
                  }}
                />
                <AiFollowUpEmailButton
                  recordId={record.id}
                  hasRecipient={Boolean(record.email)}
                  onDraft={(draft) => {
                    setAiEmailDraft(draft);
                    setInsightsSheetOpen(false);
                    setShowSendEmailDialog(true);
                  }}
                />
                </>
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </RecordAiContextProvider>
    </RecordFieldLocksProvider>
    </NoteComposeProvider>
    </RecordFieldSaveProvider>
  );
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * One-line collapsible wrapper for the screen-one context blocks. Native
 * <details>/<summary> — keyboard-toggleable, no JS state, and it collapses to
 * a single summary line so empty histories stop pushing fields off the fold.
 */
function CompactContextBlock({
  icon: Icon,
  title,
  summary,
  defaultOpen,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 open:pb-2"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform -rotate-90 group-open:rotate-0" aria-hidden />
        <Icon className="h-4 w-4 shrink-0 text-teal-500" />
        <span className="font-medium">{title}</span>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">· {summary}</span>
      </summary>
      <div className="px-2 [&>div]:border-0 [&>div]:shadow-none">{children}</div>
    </details>
  );
}

const RECENT_NOTES_LIMIT = 3;

/**
 * "Recent notes (3) + Add note" strip for the details pane. Read-only preview
 * of the newest notes (same aggregated `notes` the Notes pane renders);
 * editing/searching lives in the Notes pane, one click away.
 */
function RecentNotesStrip({
  notes,
  total,
  onAddNote,
  onViewAll,
  className,
}: {
  notes: CrmNoteWithAuthor[];
  total: number;
  onAddNote: () => void;
  onViewAll: () => void;
  className?: string;
}) {
  const recent = notes.slice(0, RECENT_NOTES_LIMIT);
  return (
    <section
      aria-label="Recent notes"
      className={cn(
        'rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/5',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <StickyNote className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">
          Recent notes
          {total > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
              {total}
            </span>
          )}
        </h3>
        <div className="ml-auto flex items-center gap-1">
          {total > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="h-7 text-xs text-slate-600 dark:text-slate-300"
            >
              View all
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onAddNote}
            className="h-7 text-xs border-amber-300/70 dark:border-amber-500/30 bg-white dark:bg-slate-900"
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add note
          </Button>
        </div>
      </div>
      {recent.length > 0 ? (
        <ul className="divide-y divide-amber-200/50 dark:divide-amber-500/10 border-t border-amber-200/50 dark:border-amber-500/10">
          {recent.map((note) => {
            const plain = stripLegacyAuthorAttribution(
              note.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            );
            return (
              <li key={note.id} className="flex items-baseline gap-2 px-3 py-1.5 text-sm">
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                  {formatNoteRelative(note.created_at)}
                </span>
                <span className="shrink-0 truncate max-w-[9rem] text-xs font-medium text-slate-600 dark:text-slate-300">
                  {getNoteAuthorDisplay(note, { showHistorical: true })}
                </span>
                <span className="min-w-0 truncate text-slate-700 dark:text-slate-200" title={plain}>
                  {plain || '(formatted note)'}
                </span>
              </li>
            );
          })}
        </ul>
      ) : total > 0 ? (
        <p className="border-t border-amber-200/50 dark:border-amber-500/10 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          Imported notes history is on the Notes tab.
        </p>
      ) : (
        <p className="border-t border-amber-200/50 dark:border-amber-500/10 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          No notes yet — the last conversation, next step, and anything the member told you go here.
        </p>
      )}
    </section>
  );
}

function FieldSavePendingBridge({
  pendingRef,
}: {
  pendingRef: React.MutableRefObject<number>;
}) {
  const ctx = useRecordFieldSaveOptional();
  pendingRef.current = ctx?.pendingCount ?? 0;
  return null;
}

function ComingSoon({
  label,
  hint,
  icon,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30 py-12 px-6 flex flex-col items-center justify-center text-center">
      <div className="mb-3">{icon ?? <Shield className="w-8 h-8 text-slate-300 dark:text-slate-600" />}</div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</h3>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

function labelFromPane(pane: OverviewPane): string {
  const map: Record<OverviewPane, string> = {
    details: 'Details',
    notes: 'Notes',
    emails: 'Emails',
    activities: 'Open Activities',
    closed_activities: 'Closed Activities',
    attachments: 'Attachments',
    related: 'Connected Records',
    cadences: 'Cadences',
    products: 'Products',
    campaigns: 'Campaigns',
    visits: 'Visits',
    social: 'Social',
    surveys: 'Surveys',
    desk: 'Zoho Desk',
    meetings: 'Invited Meetings',
  };
  return map[pane] ?? 'Related list';
}

// Ensure the `supabase` client import is not tree-shaken in case bundlers strip
// side-effect-free imports — `void supabase` is a deliberate no-op at runtime.
void supabase;
