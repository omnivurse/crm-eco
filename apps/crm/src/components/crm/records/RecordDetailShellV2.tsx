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
 *   │ Avatar · Title + meta · Tags · [Send Email][Convert][Edit][…][⋯] │
 *   │ Stage bar (deals) · Normalization banner                          │
 *   │ Tabs: Overview · Timeline · Data Privacy                          │
 *   ├────────────┬──────────────────────────────┬──────────────────────┤
 *   │ Related    │ Main panel                   │ Insights             │
 *   │ rail       │ (Details / Notes / Emails /  │ · Best time to       │
 *   │ + Links    │  Attachments / Related / …)  │ · Quick actions      │
 *   │ + Add      │                              │ · Record info        │
 *   └────────────┴──────────────────────────────┴──────────────────────┘
 */

import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
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
  UserCheck,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  ChevronDown,
  Shield,
  Clock as ClockIcon,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@crm-eco/ui/components/tabs';
import { Badge } from '@crm-eco/ui/components/badge';
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
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@crm-eco/ui/lib/utils';
import { supabase } from '@/lib/supabase-client';
import { sanitizeNoteHtml, getNoteAuthorDisplay } from '@/lib/crm/note-sanitize';
import { NoteRichArea } from '@/components/crm/notes/NoteRichArea';
import { RecordToolbarGlobalSearch } from './RecordToolbarGlobalSearch';
import { StageSelector } from '@/components/crm/blueprints';
import { ComposerBar } from '@/components/zoho/ComposerBar';
import { ConvertToContactDialog } from '@/components/crm/records/ConvertToContactDialog';
import { ConvertLeadButton } from '@/components/crm/records/ConvertLeadButton';
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
  RecordRelatedListNav,
  type RelatedListNavItem,
  type RecordRelatedListLink,
} from './v2/RecordRelatedListNav';
import { RecordRelatedListChips } from './v2/RecordRelatedListChips';
import { MobileActionBar } from './v2/MobileActionBar';
import { RecordInsightsPanel } from './v2/RecordInsightsPanel';
import { CollapsibleSection } from './v2/CollapsibleSection';
import { InlineRecordSearch, type NavigateToMatchArgs } from './v2/InlineRecordSearch';
import { SendEmailDialog } from './v2/SendEmailDialog';
import {
  AiFollowUpEmailButton,
  type AiFollowUpEmailDraft,
} from './v2/AiFollowUpEmailButton';
import { NoteTemplatePicker } from './v2/NoteTemplatePicker';
import { CustomizeRelatedListsDialog, type CustomizeRelatedListsItem } from './v2/CustomizeRelatedListsDialog';
import { DataPrivacyPanel } from './v2/DataPrivacyPanel';
import { FilterableTimeline } from './v2/FilterableTimeline';
import { KeyboardShortcutsDialog } from './v2/KeyboardShortcutsDialog';
import { PresenceStack } from './v2/PresenceStack';
import { InlineFieldEditor } from './v2/InlineFieldEditor';
import { UnsavedChangesPill } from './v2/UnsavedChangesPill';
import { MembershipChangeHistory } from './v2/MembershipChangeHistory';
import { DependentCoverageHistory } from './v2/DependentCoverageHistory';
import { FollowUpReminderDialog } from './FollowUpReminderDialog';
import { FollowUpBanner } from './FollowUpBanner';
import { useSyncBroadcast } from '@/hooks/useSyncBroadcast';
import { RecordFieldSaveProvider } from '@/hooks/useRecordFieldSave';
import { RecordFieldLocksProvider } from '@/hooks/useRecordFieldLocks';
import { RecordAiContextProvider } from './v2/RecordAiContext';
import { useUiPreferences } from '@/hooks/useUiPreferences';
import { useRecordHotkeys } from '@/hooks/useRecordHotkeys';
import { useRecordPresence } from '@/hooks/useRecordPresence';
import { useRecentlyViewedTracker } from '@/hooks/useRecentlyViewedTracker';
import { useLiveRecord, type LiveRecordEvent } from '@/hooks/useLiveRecord';
import { useClientAuth } from '@/hooks/useClientAuth';

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
  const [aiEmailDraft, setAiEmailDraft] = useState<AiFollowUpEmailDraft | null>(
    null,
  );
  const [aiEmailLoading, setAiEmailLoading] = useState(false);
  // Guard so the palette-driven `?ai=email` trigger only fires once per visit.
  const aiEmailAutoTriggeredRef = useRef(false);
  /** Scroll container for scrolling `[data-field]` / notes pane into view after find */
  const recordMainScrollRef = useRef<HTMLElement | null>(null);

  // When the Command Palette lands here with `?ai=email`, request a fresh AI
  // follow-up draft and open SendEmailDialog pre-filled, then scrub the query
  // param so reloads don't re-fire.
  useEffect(() => {
    if (aiEmailAutoTriggeredRef.current) return;
    if (searchParams?.get('ai') !== 'email') return;
    aiEmailAutoTriggeredRef.current = true;

    if (!record.email) {
      toast.warning('No email on file', {
        description: 'Add an email address before drafting a follow-up.',
      });
      router.replace(pathname ?? `/crm/r/${record.id}`);
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
        router.replace(pathname ?? `/crm/r/${record.id}`);
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
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
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
      [...notesProp].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
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

  // Inline field saves update the DB immediately; debounce RSC refresh so
  // rapid edits across Health Sharing fields do not race and flash stale values.
  const recordRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRecordRefresh = useCallback(() => {
    if (recordRefreshTimerRef.current) {
      clearTimeout(recordRefreshTimerRef.current);
    }
    recordRefreshTimerRef.current = setTimeout(() => {
      recordRefreshTimerRef.current = null;
      router.refresh();
      void refreshInsights();
    }, 900);
  }, [router, refreshInsights]);

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
  const isAlreadyConverted =
    record.status === 'Converted' || (record.data as Record<string, unknown>)?.is_converted === true;
  const canConvertToContact = isLeads && !isAlreadyConverted;
  // "Convert to Member" is available from both Leads and Contacts
  const canConvertToMember = (isLeads || isContacts) && !isAlreadyConverted;

  const backUrl = `/crm/modules/${module.key}`;

  const handleNavigateToMatch = useCallback((args: NavigateToMatchArgs) => {
    setTopTab('overview');
    if (args.type === 'notes') {
      setOverviewPane('notes');
      window.setTimeout(() => {
        recordMainScrollRef.current
          ?.querySelector('[data-record-notes-pane]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return;
    }

    setOverviewPane('details');
    window.setTimeout(() => {
      const fk =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(args.fieldKey)
          : args.fieldKey.replace(/"/g, '\\"');
      const selector = `[data-field="${fk}"]`;
      const el =
        recordMainScrollRef.current?.querySelector(selector) ??
        document.querySelector(selector);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, []);

  // -------------------------------------------------------------------------
  // Action handlers (preserve V1 behaviour)
  // -------------------------------------------------------------------------
  const handleEditRecord = useCallback(() => {
    if (onEdit) onEdit();
    else router.push(`/crm/r/${record.id}/edit`);
  }, [onEdit, router, record.id]);

  const handleAddTask = useCallback(() => {
    if (onAddTask) onAddTask();
    else setShowTaskModal(true);
  }, [onAddTask]);

  const handleAddNote = useCallback(() => {
    if (onAddNote) onAddNote();
    else setShowNoteModal(true);
  }, [onAddNote]);

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
      toast.success('Task created successfully');
    } else if (result.queued) {
      toast.info('Task saved offline — will sync when reconnected');
    } else {
      toast.error(result.error || 'Failed to create task');
      return;
    }
    setShowTaskModal(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskDueDate('');
    // No router.refresh() on queued — there's nothing new on the
    // server yet. We refresh on replay success via the queue.
    if (result.ok) {
      router.refresh();
      void refreshInsights();
    }
  }, [record.id, router, taskTitle, taskDescription, taskDueDate, refreshInsights]);

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
      toast.success('Note added successfully');
    } else if (result.queued) {
      toast.info('Note saved offline — will sync when reconnected');
    } else {
      toast.error(result.error || 'Failed to add note');
      return;
    }
    setShowNoteModal(false);
    setNoteContent('');
    if (children.notes) setOverviewPane('notes');
    if (result.ok) {
      router.refresh();
      void refreshInsights();
    }
  }, [record.id, router, noteContent, children.notes, refreshInsights]);

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
      toast.success('File uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      if (children.attachments) setOverviewPane('attachments');
      router.refresh();
      void refreshInsights();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload file');
    } finally {
      setIsSubmitting(false);
    }
  }, [record.id, router, selectedFile, children.attachments]);

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
  const {
    participants: presenceParticipants,
    setIntent: setPresenceIntent,
    fieldLocks,
    acquireFieldLock,
    releaseFieldLock,
  } = useRecordPresence(record.id);

  useRecentlyViewedTracker(record.id);

  const handleLiveEvent = useCallback(
    (event: LiveRecordEvent) => {
      if (event.isSelf) return;

      // Record-level edits: revalidate the RSC so updated fields render.
      if (event.table === 'crm_records' && event.type === 'UPDATE') {
        const actor = (event.new?.updated_by as string | undefined) ?? null;
        toast.info('This record was just updated by a teammate.', {
          description: actor
            ? 'Their changes are loading now.'
            : 'Refreshing to pick up their changes.',
          duration: 3000,
        });
        router.refresh();
        void refreshInsights();
        return;
      }

      // Dependent-table inserts/updates: just nudge insights + toast.
      const label: Record<string, string> = {
        crm_notes: 'A new note was added',
        crm_tasks: 'Activity list updated',
        crm_attachments: 'A new attachment was uploaded',
        crm_stage_history: 'Stage was updated',
        crm_audit_logs: 'Audit log entry added',
      };
      const text = label[event.table] ?? 'This record was updated';
      toast.info(text, { duration: 2500 });
      void refreshInsights();
    },
    // `router` and `refreshInsights` are stable across renders. Including
    // them here keeps lint happy without triggering subscription churn.
    [router, refreshInsights],
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
        toast.success(`Status changed to ${newStatus}`);
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
        toast.error(err instanceof Error ? err.message : 'Failed to update status');
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
    const noteTotal = counts?.notes ?? noteCount ?? notesProp.length;
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
        id: 'activities',
        label: 'Open Activities',
        count: counts?.open_activities ?? null,
        available: (counts?.open_activities ?? 0) > 0,
        comingSoonHint:
          (counts?.open_activities ?? 0) === 0 ? 'No open activities yet' : undefined,
      },
      {
        id: 'closed_activities',
        label: 'Closed Activities',
        count: counts?.closed_activities ?? null,
        available: (counts?.closed_activities ?? 0) > 0,
        comingSoonHint:
          (counts?.closed_activities ?? 0) === 0 ? 'No completed activities yet' : undefined,
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
      { id: 'cadences', label: 'Cadences', count: null, available: false, comingSoonHint: 'Cadences panel ships in PR 5' },
      { id: 'products', label: 'Products', count: null, available: false, comingSoonHint: 'Products panel ships in PR 5' },
      { id: 'campaigns', label: 'Campaigns', count: null, available: false, comingSoonHint: 'Campaigns panel ships in PR 5' },
      { id: 'visits', label: 'Visits', count: null, available: false, comingSoonHint: 'SalesIQ integration ships in PR 5' },
      { id: 'social', label: 'Social', count: null, available: false, comingSoonHint: 'Social integration ships in PR 5' },
      { id: 'surveys', label: 'Surveys', count: null, available: false, comingSoonHint: 'Surveys integration ships in PR 5' },
      { id: 'desk', label: 'Zoho Desk', count: null, available: false, comingSoonHint: 'Desk integration ships in PR 5' },
      { id: 'meetings', label: 'Invited Meetings', count: null, available: false, comingSoonHint: 'Meetings integration ships in PR 5' },
    ];
  }, [children, noteCount, notesProp.length, insights]);

  /**
   * Visible nav items = user's saved order (if any) ∩ default set. Unknown
   * IDs in the saved order are dropped silently — forward-compatible with
   * future panels. "details" is always pinned to the top so users can't
   * accidentally hide the Details pane.
   */
  const navItems: RelatedListNavItem[] = useMemo(() => {
    const byId = new Map(defaultNavItems.map((item) => [item.id, item]));
    if (!customOrder || customOrder.length === 0) return defaultNavItems;
    // Back-compat: the Details pane id used to be persisted as 'overview'.
    // Normalize legacy saved orders so the Details pane still resolves.
    const normalized = customOrder.map((id) => (id === 'overview' ? 'details' : id));
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
  }, [record.data]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const recordMarketType = (record as any).market_type as string | undefined;
  const showChangeHistory =
    recordMarketType === 'healthshare' || recordMarketType === 'traditional_insurance';
  const linkedMemberId = (record.data as Record<string, unknown> | null)?.linked_member_id as
    | string
    | undefined;

  const renderOverviewPane = (): React.ReactNode => {
    switch (overviewPane) {
      case 'details':
        return (
          <>
            <CollapsibleSection
              title={<span>Lead Information</span>}
              persistKey={`record.${record.id}.details`}
              action={null}
            >
              {children.overview}
            </CollapsibleSection>

            {showChangeHistory && (
              <MembershipChangeHistory
                data={(record.data ?? null) as Record<string, unknown> | null}
                className="mt-4"
              />
            )}

            {linkedMemberId && (
              <DependentCoverageHistory memberId={linkedMemberId} className="mt-4" />
            )}
          </>
        );
      case 'notes':
        return (
          <div data-record-notes-pane>
            {children.notes ?? <ComingSoon label="Notes" hint="Notes are available in the classic view." />}
          </div>
        );
      case 'emails':
        return children.communications ?? <ComingSoon label="Emails" hint="Email history is not enabled for this record." />;
      case 'attachments':
        return children.attachments ?? <ComingSoon label="Attachments" hint="No attachments panel is wired for this module." />;
      case 'related':
        return children.related ?? <ComingSoon label="Connected Records" hint="Relationship browser is empty." />;
      default:
        return <ComingSoon label={labelFromPane(overviewPane)} hint="This related list ships in a later PR." />;
    }
  };

  return (
    <RecordFieldSaveProvider
      recordId={record.id}
      initialUpdatedAt={record.updated_at ?? null}
      onSaved={() => {
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
    <RecordFieldLocksProvider
      fieldLocks={fieldLocks}
      acquireFieldLock={acquireFieldLock}
      releaseFieldLock={releaseFieldLock}
    >
    <RecordAiContextProvider recordId={record.id} enabled>
    <div className={cn('flex h-full', className)}>
      <main ref={recordMainScrollRef} className="flex-1 overflow-y-auto" data-record-find-root>
        {/* Sticky header ---------------------------------------------------- */}
        <div className="sticky top-0 z-10 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
          <div className="w-full px-4 xl:px-6 py-3">
            {/* Breadcrumb + search */}
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={backUrl}
                  className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {module.name_plural || module.name}
                </Link>
                <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                <span className="text-sm text-slate-900 dark:text-white truncate max-w-xs">
                  {getRecordDisplayName(record)}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <RecordToolbarGlobalSearch currentRecordId={record.id} />
                <InlineRecordSearch
                  record={record}
                  fields={_fields}
                  noteBodies={notesProp.map((n) => n.body)}
                  onNavigateToMatch={handleNavigateToMatch}
                />
              </div>
            </div>

            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <RecordAvatarTile name={getRecordDisplayName(record)} moduleKey={module.key} size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate flex items-center gap-2">
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
                      inputClassName="text-2xl font-bold"
                    />
                    <UnsavedChangesPill
                      className="font-normal text-[11px]"
                      recordId={record.id}
                    />
                  </h1>
                  <RecordTagsRow
                    recordId={record.id}
                    recordData={record.data as Record<string, unknown> | undefined}
                    readOnly={isAlreadyConverted && isLeads}
                    className="mt-1.5"
                  />
                  {/* Meta row: email, phone, status, badges */}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="group flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
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
                        display={(v) =>
                          v ? (
                            <a
                              href={`mailto:${v}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                            >
                              {v}
                            </a>
                          ) : null
                        }
                      />
                      {record.email && <HeaderCopyButton value={record.email} />}
                    </span>
                    <span className="group flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <Phone className="w-3.5 h-3.5" />
                      <InlineFieldEditor
                        field="phone"
                        value={record.phone || ''}
                        type="tel"
                        placeholder="Add phone"
                        ariaLabel="Record phone"
                        onEditStart={() => void setPresenceIntent('editing')}
                        onEditEnd={() => void setPresenceIntent('viewing')}
                        display={(v) =>
                          v ? (
                            <a
                              href={`tel:${v}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
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
                            <Badge
                              variant="outline"
                              className={cn(
                                'border text-xs font-medium transition-colors',
                                displayStatus === 'Active' || displayStatus === 'Active HS Member' || displayStatus === 'Active Member'
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                  : displayStatus === 'Inactive' ||
                                    displayStatus === 'Terminated' ||
                                    displayStatus === 'Cancelled'
                                    ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
                                    : 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
                              )}
                            >
                              {displayStatus}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 min-w-[200px] max-h-80 overflow-y-auto"
                        >
                          {[
                            { label: 'Status', items: ['Active', 'Active HS Member', 'Active Member', 'Inactive', 'In-Active', 'Pending', 'Hold'] },
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
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {!isLeads && <MarketTypeBadge marketType={(record as any).market_type} showIcon size="sm" />}
                    {!isLeads && <NormalizationBadge status={(record as any).normalization_status} size="sm" />}
                    {(() => {
                      const data = record.data as Record<string, unknown> | undefined;
                      const capacities: string[] = [];
                      if (data?.product_type && typeof data.product_type === 'string') capacities.push(data.product_type);
                      else if (Array.isArray(data?.capacities)) capacities.push(...(data.capacities as string[]));
                      return capacities.length > 0 ? <CapacityBadges capacities={capacities} size="sm" /> : null;
                    })()}
                    {isLeads && isAlreadyConverted && !!(record.data as Record<string, unknown>)?.converted_contact_id && (
                      <Link
                        href={`/crm/r/${String((record.data as Record<string, unknown>).converted_contact_id)}`}
                        className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        View Contact
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions: Convert (leads only) | Send Email | Edit | Note Template ⌄ | ⋯ */}
              <div className="flex flex-wrap items-center gap-2 justify-end shrink-0 min-w-0">
                <PresenceStack
                  participants={presenceParticipants}
                  moduleKey={module.key}
                  className="mr-1"
                />
                {canConvertToContact && (
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    aria-label="Convert lead to contact"
                    onClick={() => setShowConvertDialog(true)}
                    className="inline-flex shrink-0 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-medium"
                  >
                    <UserCheck className="w-4 h-4 shrink-0 sm:mr-1.5" />
                    <span className="text-xs sm:text-sm">Convert to Contact</span>
                  </Button>
                )}
                {canConvertToMember && (
                  <ConvertLeadButton
                    recordId={record.id}
                    recordTitle={getRecordDisplayName(record)}
                  />
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={!record.email}
                  title={
                    record.email ? 'Compose email to this record' : 'Add an email on this record to enable send'
                  }
                  onClick={() => void handleSendEmail()}
                  className="inline-flex shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-40"
                >
                  <Mail className="w-4 h-4 shrink-0 sm:mr-1.5" />
                  <span className="text-xs font-medium sm:text-sm">
                    <span className="sm:hidden">Email</span>
                    <span className="hidden sm:inline">Send Email</span>
                  </span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  title="Set a follow-up reminder for this record"
                  onClick={() => setShowFollowUpDialog(true)}
                  className="inline-flex shrink-0 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 font-medium"
                >
                  <Bell className="w-4 h-4 shrink-0 sm:mr-1.5" />
                  <span className="text-xs font-medium sm:text-sm">
                    <span className="sm:hidden">Remind</span>
                    <span className="hidden sm:inline">Set Reminder</span>
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0"
                  onClick={handleEditRecord}
                >
                  <Edit className="w-4 h-4 min-[380px]:mr-1.5" />
                  <span className="hidden min-[380px]:inline">Edit</span>
                </Button>

                {/* Note templates — visible on narrow viewports; overflow row wraps via flex-wrap above. */}
                <div className="flex items-stretch shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="rounded-r-none border-r-0 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                  >
                    <StickyNote className="w-4 h-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Note Template</span>
                    <span className="inline sm:hidden text-xs font-medium">Template</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-l-none px-1.5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                        aria-label="Choose note template"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 w-56"
                    >
                      <DropdownMenuLabel className="text-xs text-slate-500">
                        Quick templates
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={handleAddNote}>
                        Blank note
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                      <DropdownMenuItem
                        onClick={() => {
                          import('@/lib/crm/note-templates').then(
                            ({ DEFAULT_NOTE_TEMPLATES, renderNoteTemplate }) => {
                              const tmpl = DEFAULT_NOTE_TEMPLATES.find((t) => t.id === 'discovery-call');
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
                        Discovery call
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          import('@/lib/crm/note-templates').then(
                            ({ DEFAULT_NOTE_TEMPLATES, renderNoteTemplate }) => {
                              const tmpl = DEFAULT_NOTE_TEMPLATES.find((t) => t.id === 'voicemail-left');
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
                        Voicemail left
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          import('@/lib/crm/note-templates').then(
                            ({ DEFAULT_NOTE_TEMPLATES, renderNoteTemplate }) => {
                              const tmpl = DEFAULT_NOTE_TEMPLATES.find((t) => t.id === 'follow-up-required');
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
                        Follow-up required
                      </DropdownMenuItem>
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
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
                  >
                    <DropdownMenuItem
                      disabled={!record.email}
                      onClick={() => void handleSendEmail()}
                      title={!record.email ? 'Add an email address on this record first' : undefined}
                    >
                      <Mail className="w-4 h-4 mr-2 text-rose-600" />
                      Send email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowTemplatePicker(true)}>
                      <StickyNote className="w-4 h-4 mr-2" />
                      Note templates…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}/clone`, { method: 'POST' });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Clone failed');
                          toast.success('Record cloned successfully');
                          router.push(`/crm/modules/${module.key}/${data.id}`);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to clone record');
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
                    {canConvertToContact && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                        <DropdownMenuItem
                          className="text-emerald-600 dark:text-emerald-400"
                          onClick={() => setShowConvertDialog(true)}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Convert to Contact
                        </DropdownMenuItem>
                      </>
                    )}
                    {canConvertToMember && !canConvertToContact && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                        <DropdownMenuItem className="text-emerald-600 dark:text-emerald-400 p-0">
                          <ConvertLeadButton
                            recordId={record.id}
                            recordTitle={getRecordDisplayName(record)}
                          />
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-500/10"
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to delete this ${module.name.toLowerCase()}? This action cannot be undone.`))
                          return;
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}`, { method: 'DELETE' });
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error || 'Delete failed');
                          }
                          toast.success(`${module.name} deleted`);
                          router.push(backUrl);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to delete record');
                        }
                      }}
                    >
                      Delete Record
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

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

            {!isLeads && (
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

            {/* Top tabs: Overview / Timeline / Data Privacy */}
            <div className="mt-5 -mb-px">
              <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
                <TabsList className="bg-transparent border-b border-slate-200 dark:border-white/5 w-full justify-start gap-0 h-auto p-0">
                  <TabsTrigger
                    value="overview"
                    onClick={() => setOverviewPane('details')}
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="timeline"
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <ClockIcon className="w-4 h-4 mr-1.5" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger
                    value="privacy"
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Shield className="w-4 h-4 mr-1.5" />
                    Data Privacy
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Mobile-only horizontal related-list chip rail. Sits directly
            under the sticky header and scrolls the active chip into view
            when the pane changes. Hidden at lg where the vertical nav
            takes over. */}
        <RecordRelatedListChips
          items={navItems}
          activeId={overviewPane}
          onSelect={(id) => {
            // The chip rail lives outside the top <Tabs>, so a section tap
            // must also return to the Overview tab — otherwise the pane
            // changes invisibly while Timeline/Privacy stays on screen.
            setTopTab('overview');
            setOverviewPane(id as OverviewPane);
          }}
          onMore={() => setShowCustomizeDialog(true)}
          className="lg:hidden sticky top-[64px] z-[5]"
        />

        {/* Body -------------------------------------------------------------- */}
        <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
          <TabsContent value="overview" className="mt-0">
            <div className="flex gap-4 xl:gap-6 px-4 xl:px-6 py-4 pb-24 lg:pb-4">
              <RecordRelatedListNav
                items={navItems}
                links={links}
                activeId={overviewPane}
                onSelect={(id) => setOverviewPane(id as OverviewPane)}
                onAddRelatedList={() => setShowCustomizeDialog(true)}
                onAddLink={() =>
                  toast.info('Record links editor ships in PR 5', { duration: 4000 })
                }
                className="sticky top-[220px] self-start hidden lg:flex"
              />

              <div className="flex-1 min-w-0">{renderOverviewPane()}</div>

              {/* Right insights rail — collapsible via the chevron tab so the
                  user can reclaim the full middle column without losing the
                  affordance to bring it back. */}
              {insightsCollapsed ? (
                <button
                  type="button"
                  onClick={() => setInsightsCollapsed(false)}
                  className="hidden xl:flex sticky top-[220px] self-start items-center gap-1 px-1 py-3 rounded-l-lg border border-r-0 border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 text-slate-500 hover:text-teal-600 transition-colors"
                  aria-label="Expand insights panel"
                  title="Show insights"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-wider font-semibold">
                    Insights
                  </span>
                </button>
              ) : (
              <RecordInsightsPanel
                className="hidden xl:flex sticky top-[220px] self-start"
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
                    {notesProp.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
                        onClick={() => setShowNotesDrawer(true)}
                      >
                        <StickyNote className="w-4 h-4 mr-2" />
                        View all notes ({notesProp.length})
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
                {notesProp.length}
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
                      className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0"
                      suppressHydrationWarning
                    >
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
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
                <p className="text-sm text-slate-500 dark:text-slate-400">No notes yet.</p>
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
              <Button onClick={submitTask} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
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
              You can paste formatted text, tables, and images directly.
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
              <Button onClick={submitNote} disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
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
                className="bg-teal-500 hover:bg-teal-600 text-white"
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
                      className="w-full justify-start text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                      onClick={() => {
                        setInsightsSheetOpen(false);
                        setShowConvertDialog(true);
                      }}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Convert to Contact
                    </Button>
                  )}
                  {canConvertToMember && (
                    <div className="w-full">
                      <ConvertLeadButton
                        recordId={record.id}
                        recordTitle={getRecordDisplayName(record)}
                      />
                    </div>
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
                <AiFollowUpEmailButton
                  recordId={record.id}
                  hasRecipient={Boolean(record.email)}
                  onDraft={(draft) => {
                    setAiEmailDraft(draft);
                    setInsightsSheetOpen(false);
                    setShowSendEmailDialog(true);
                  }}
                />
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </RecordAiContextProvider>
    </RecordFieldLocksProvider>
    </RecordFieldSaveProvider>
  );
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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
