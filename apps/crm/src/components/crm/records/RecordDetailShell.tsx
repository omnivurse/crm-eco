'use client';

import { useState, useEffect, useRef, memo, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bell,
  Edit,
  UserPlus,
  CheckSquare,
  StickyNote,
  Upload,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  Users,
  DollarSign,
  UserCircle,
  Clock,
  Link2,
  MessageSquare,
  X,
  Loader2,
  UserCheck,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
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
import { RecordToolbarGlobalSearch } from '@/components/crm/records/RecordToolbarGlobalSearch';
import { ActionRail } from '@/components/layout/ActionRail';
import { cn } from '@crm-eco/ui/lib/utils';
import { StageSelector } from '@/components/crm/blueprints';
import { ComposerBar } from '@/components/zoho/ComposerBar';
import { toast } from 'sonner';
import { formatNoteTimestamp, formatNoteRelative } from '@/lib/crm/note-timestamp';
import type { CrmRecord, CrmModule, CrmField, CrmDealStage, CrmNoteWithAuthor } from '@/lib/crm/types';
import { MarketTypeBadge, NormalizationBadge, NormalizationBanner, OwnershipDisplay, getOwnerLabel } from '@/components/shared/crm-lane-badges';
import { ConvertToContactDialog } from '@/components/crm/records/ConvertToContactDialog';
import { isLeadRecordConverted, getConvertedContactId } from '@/lib/crm/lead-conversion-result';
import {
  getCoreStatusPickerItems,
  isActiveCoverageStatus,
  relabelStatusForMarket,
} from '@/lib/crm/member-terminology';
import { MergeRecordDialog } from '@/components/crm/records/MergeRecordDialog';
import { CapacityBadges } from '@/components/shared/capacity-badge';
import { getRecordDisplayName } from '@/lib/crm/display-name';
import { getNoteAuthorDisplay } from '@/lib/crm/note-sanitize';
import { FollowUpReminderDialog } from './FollowUpReminderDialog';
import { FollowUpBanner } from './FollowUpBanner';

interface RecordDetailShellProps {
  record: CrmRecord;
  module: CrmModule;
  fields: CrmField[];
  stages?: CrmDealStage[];
  noteCount?: number;
  notes?: CrmNoteWithAuthor[];
  orgId?: string;
  /**
   * Live insights (counts / best-time suggestions). V1 ignores these — they
   * exist on the prop contract so callers can pass the same props to either
   * shell while the layout-v2 feature flag rolls out.
   */
  insights?: unknown;
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

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-5 h-5" />,
  leads: <UserPlus className="w-5 h-5" />,
  deals: <DollarSign className="w-5 h-5" />,
  accounts: <Building2 className="w-5 h-5" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

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
  stages 
}: { 
  currentStage: string | null; 
  stages: CrmDealStage[] 
}) {
  if (!stages.length || !currentStage) return null;

  const currentIndex = stages.findIndex(s => s.key === currentStage);
  const current = stages[currentIndex];

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const isWon = stage.is_won;
        const isLost = stage.is_lost;

        let bgColor = 'bg-slate-700';
        if (isActive) {
          bgColor = isWon ? 'bg-green-500' : isLost ? 'bg-red-500' : 'bg-teal-500';
        } else if (isPast) {
          bgColor = 'bg-teal-500/50';
        }

        return (
          <div
            key={stage.id}
            className={cn(
              'h-2 flex-1 rounded-full transition-colors',
              bgColor
            )}
            title={stage.name}
          />
        );
      })}
    </div>
  );
}

export const RecordDetailShell = memo(function RecordDetailShell({
  record,
  module,
  fields,
  stages = [],
  noteCount,
  notes: notesProp = [],
  orgId,
  children,
  onEdit,
  onAddTask,
  onAddNote,
  onUploadFile,
  onRefresh,
  className,
}: RecordDetailShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  // Listen for tab switch events from child components (e.g., NotesOverviewCard "View All")
  useEffect(() => {
    const handler = (e: Event) => setActiveTab((e as CustomEvent).detail);
    window.addEventListener('crm:switch-tab', handler);
    return () => window.removeEventListener('crm:switch-tab', handler);
  }, []);

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
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [followUpRefreshKey, setFollowUpRefreshKey] = useState(0);
  const displayStatus = optimisticStatus || record.status;

  // Sort notes: most recent first
  const sortedNotes = [...notesProp].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const recentNotes = sortedNotes.slice(0, 3);

  // Clear optimistic status once server data catches up
  useEffect(() => {
    if (optimisticStatus && record.status === optimisticStatus) {
      setOptimisticStatus(null);
    }
  }, [record.status, optimisticStatus]);

  // Lead-to-Contact conversion flags
  const isLeads = module.key === 'leads';
  const isAlreadyConverted = isLeadRecordConverted(record);
  const canConvertToContact = isLeads && !isAlreadyConverted;

  // Check if we should show ComposerBar on timeline tab
  const showComposer = activeTab === 'timeline';

  const icon = MODULE_ICONS[module.key] || <UserCircle className="w-5 h-5" />;
  const colors = MODULE_COLORS[module.key] || MODULE_COLORS.contacts;

  const backUrl = `/crm/modules/${module.key}`;
  const isDeals = module.key === 'deals';

  // Handle Edit Record - navigate to edit mode
  const handleEditRecord = () => {
    if (onEdit) {
      onEdit();
    } else {
      router.push(`/crm/r/${record.id}/edit`);
    }
  };

  // Handle Add Task
  const handleAddTask = async () => {
    if (onAddTask) {
      onAddTask();
      return;
    }
    setShowTaskModal(true);
  };

  const submitTask = async () => {
    if (!taskTitle.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: record.id,
          title: taskTitle,
          description: taskDescription,
          due_at: taskDueDate || null,
          priority: 'medium',
          activity_type: 'task',
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      toast.success('Task created successfully');
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      router.refresh();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Note
  const handleAddNote = async () => {
    if (onAddNote) {
      onAddNote();
      return;
    }
    setShowNoteModal(true);
  };

  const submitNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Please enter note content');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: record.id,
          body: noteContent,
        }),
      });

      if (!response.ok) throw new Error('Failed to create note');

      toast.success('Note added successfully');
      setShowNoteModal(false);
      setNoteContent('');
      // Switch to notes tab if it exists
      if (children.notes) {
        setActiveTab('notes');
      }
      router.refresh();
    } catch (error) {
      console.error('Error creating note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Upload File
  const handleUploadFile = async () => {
    if (onUploadFile) {
      onUploadFile();
      return;
    }
    setShowUploadModal(true);
  };

  const submitFile = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('recordId', record.id);

      const response = await fetch('/api/crm/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload file');

      toast.success('File uploaded successfully');
      setShowUploadModal(false);
      setSelectedFile(null);
      // Switch to files tab if it exists
      if (children.attachments) {
        setActiveTab('attachments');
      }
      router.refresh();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex h-full', className)}>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
          <div className="w-full px-3 sm:px-4 xl:px-5 py-3">
            {/* Breadcrumb + Search */}
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={backUrl}
                  className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {module.name_plural || module.name}
                </Link>
                <span className="text-slate-300 dark:text-slate-600 shrink-0">/</span>
                <span
                  className="text-sm text-slate-900 dark:text-white truncate max-w-xs"
                  title={getRecordDisplayName(record)}
                >
                  {getRecordDisplayName(record)}
                </span>
              </div>
              <RecordToolbarGlobalSearch currentRecordId={record.id} />
            </div>

            {/* Title Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', colors.bg, colors.text)}>
                  {icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {getRecordDisplayName(record)}
                  </h1>
                  <div className="flex items-center gap-3 mt-1">
                    {record.email && (
                      <span className="group flex items-center gap-1">
                        <a 
                          href={`mailto:${record.email}`}
                          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          {record.email}
                        </a>
                        <HeaderCopyButton value={record.email} />
                      </span>
                    )}
                    {record.phone && (
                      <span className="group flex items-center gap-1">
                        <a 
                          href={`tel:${record.phone}`}
                          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {record.phone}
                        </a>
                        <HeaderCopyButton value={record.phone} />
                      </span>
                    )}
                    {displayStatus && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 cursor-pointer hover:ring-2 hover:ring-teal-500/30 rounded-full transition-all">
                            <Badge
                              variant="outline"
                              className={cn(
                                'border text-xs font-medium transition-colors',
                                isActiveCoverageStatus(displayStatus)
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                  : displayStatus === 'Inactive' || displayStatus === 'Terminated' || displayStatus === 'Cancelled'
                                  ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
                                  : 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                              )}
                            >
                              {relabelStatusForMarket(displayStatus, (record as any).market_type)}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 min-w-[200px] max-h-80 overflow-y-auto">
                          {[
                            { label: 'Status', items: getCoreStatusPickerItems((record as any).market_type) },
                            { label: 'Enrollment', items: ['Enrolled - 2025', 'Enrolled - 2026', 'Enrolled Member', 'Approved Pending'] },
                            { label: 'Close', items: ['Cancelled', 'Cancellation Pending', 'Terminated', 'Suspended', 'Archived', 'Converted'] },
                          ].map((group) => (
                            <div key={group.label}>
                              <div className="px-2 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group.label}</div>
                              {group.items.map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  disabled={s === displayStatus}
                                  className={cn(
                                    'text-sm',
                                    s === displayStatus && 'opacity-50',
                                    (s.startsWith('Active') || s.startsWith('Enrolled')) && 'text-emerald-600 dark:text-emerald-400',
                                    (s === 'Inactive' || s === 'In-Active' || s === 'Terminated' || s === 'Cancelled' || s === 'Suspended') && 'text-red-600 dark:text-red-400',
                                  )}
                                  onSelect={async () => {
                                    setOptimisticStatus(s);
                                    try {
                                      const res = await fetch(`/api/crm/records/${record.id}/status`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: s, reason: 'Manual CRM status change' }),
                                      });
                                      if (!res.ok) {
                                        const err = await res.json();
                                        throw new Error(err.error || 'Failed');
                                      }
                                      toast.success(
                                        `Status changed to ${relabelStatusForMarket(s, (record as any).market_type)}`,
                                      );
                                      router.refresh();
                                    } catch (err) {
                                      setOptimisticStatus(null);
                                      toast.error(err instanceof Error ? err.message : 'Failed to update status');
                                    }
                                  }}
                                >
                                  {relabelStatusForMarket(s, (record as any).market_type)}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {/* Market type + normalization badges */}
                    {!isLeads && <MarketTypeBadge marketType={(record as any).market_type} showIcon size="sm" />}
                    {!isLeads && <NormalizationBadge status={(record as any).normalization_status} size="sm" />}
                    {/* Capacity badges from record data */}
                    {(() => {
                      const data = record.data as Record<string, unknown> | undefined;
                      const capacities: string[] = [];
                      if (data?.product_type && typeof data.product_type === 'string') {
                        capacities.push(data.product_type);
                      } else if (Array.isArray(data?.capacities)) {
                        capacities.push(...(data.capacities as string[]));
                      }
                      return capacities.length > 0 ? <CapacityBadges capacities={capacities} size="sm" /> : null;
                    })()}
                    {isLeads && isAlreadyConverted && getConvertedContactId(record.data as Record<string, unknown>) && (
                      <Link
                        href={`/crm/r/${String(getConvertedContactId(record.data as Record<string, unknown>))}`}
                        className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        View Contact
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
                {canConvertToContact && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    aria-label="Convert lead to contact"
                    className="border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 shrink-0"
                    onClick={() => setShowConvertDialog(true)}
                  >
                    <UserCheck className="w-4 h-4 shrink-0 sm:mr-1.5" />
                    <span className="text-xs font-medium sm:text-sm">Convert to Contact</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shrink-0"
                  onClick={handleEditRecord}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title="Set a follow-up reminder"
                  onClick={() => setShowFollowUpDialog(true)}
                  className="border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 shrink-0"
                >
                  <Bell className="w-4 h-4 mr-1" />
                  Remind
                </Button>
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
                  <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                    <DropdownMenuItem
                      className="text-slate-700 dark:text-slate-300 focus:text-slate-900 dark:focus:text-white focus:bg-slate-100 dark:focus:bg-white/10"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}/clone`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                          });
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
                    <DropdownMenuItem
                      className="text-slate-700 dark:text-slate-300 focus:text-slate-900 dark:focus:text-white focus:bg-slate-100 dark:focus:bg-white/10"
                      onClick={() => setShowMergeDialog(true)}
                    >
                      Merge Duplicate…
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-slate-700 dark:text-slate-300 focus:text-slate-900 dark:focus:text-white focus:bg-slate-100 dark:focus:bg-white/10"
                      onClick={() => window.print()}
                    >
                      Print
                    </DropdownMenuItem>
                    {canConvertToContact && (
                      <>
                        <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                        <DropdownMenuItem
                          className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 dark:focus:text-emerald-300 focus:bg-emerald-50 dark:focus:bg-emerald-500/10"
                          onClick={() => setShowConvertDialog(true)}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Convert to Contact
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
                    <DropdownMenuItem
                      className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-500/10"
                      onClick={async () => {
                        if (!(await confirmDialog({ title: `Delete this ${module.name.toLowerCase()}?`, description: 'This action cannot be undone.', confirmLabel: 'Delete', destructive: true }))) return;
                        try {
                          const res = await fetch(`/api/crm/records/${record.id}`, {
                            method: 'DELETE',
                          });
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

            {/* Stage Progress (for Deals) */}
            {isDeals && stages.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Pipeline Progress</span>
                  <StageSelector
                    recordId={record.id}
                    currentStage={record.stage}
                    currentStageLabel={stages.find(s => s.key === record.stage)?.name}
                    currentStageColor={stages.find(s => s.key === record.stage)?.color}
                    moduleId={record.module_id}
                  />
                </div>
                <StageIndicator currentStage={record.stage} stages={stages} />
              </div>
            )}

            {/* Normalization review banner — hidden on Leads to reduce noise */}
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

            {/* Tabs */}
            <div className="mt-6 -mb-px">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-transparent border-b border-slate-200 dark:border-white/5 w-full justify-start gap-0 h-auto p-0">
                  <TabsTrigger 
                    value="overview"
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="related"
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Link2 className="w-4 h-4 mr-1.5" />
                    Related
                  </TabsTrigger>
                  <TabsTrigger 
                    value="timeline"
                    className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Timeline
                  </TabsTrigger>
                  {children.notes && (
                    <TabsTrigger 
                      value="notes"
                      className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <StickyNote className="w-4 h-4 mr-1.5" />
                      Notes
                      {noteCount != null && noteCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {noteCount}
                        </span>
                      )}
                    </TabsTrigger>
                  )}
                  {children.communications && (
                    <TabsTrigger 
                      value="communications"
                      className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 mr-1.5" />
                      Communications
                    </TabsTrigger>
                  )}
                  {children.attachments && (
                    <TabsTrigger 
                      value="attachments"
                      className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-teal-500 rounded-none bg-transparent data-[state=active]:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      Files
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Composer Bar - shown on Timeline tab */}
        {showComposer && (
          <div className="w-full px-3 sm:px-4 xl:px-5 pt-3">
            <ComposerBar
              recordId={record.id}
              onNoteCreated={onRefresh}
              onTaskCreated={onRefresh}
              onCallLogged={onRefresh}
            />
          </div>
        )}

        {/* Tab Content */}
        <div className="w-full px-3 sm:px-4 xl:px-5 py-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="overview" className="mt-0">
              {children.overview}
            </TabsContent>
            <TabsContent value="related" className="mt-0">
              {children.related}
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              {children.timeline}
            </TabsContent>
            {children.notes && (
              <TabsContent value="notes" className="mt-0">
                {children.notes}
              </TabsContent>
            )}
            {children.communications && (
              <TabsContent value="communications" className="mt-0">
                {children.communications}
              </TabsContent>
            )}
            {children.attachments && (
              <TabsContent value="attachments" className="mt-0">
                {children.attachments}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Action Rail */}
      <ActionRail title="Quick Actions" width="sm" defaultCollapsed={true}>
        <div className="space-y-3">
          {/* Notes Preview — above quick actions */}
          <div className="pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Notes
                </h4>
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {notesProp.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddNote}
                className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
              >
                + Add
              </button>
            </div>
            {recentNotes.length > 0 ? (
              <div className="space-y-1.5">
                {recentNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setShowNotesDrawer(true)}
                    className="w-full text-left p-2 rounded-md bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-colors"
                  >
                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {note.body}
                    </p>
                    <span
                      className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block"
                      title={formatNoteRelative(note.created_at)}
                      suppressHydrationWarning
                    >
                      {formatNoteTimestamp(note.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2 text-center">
                No notes yet
              </p>
            )}
            {notesProp.length > 0 && (
              <button
                type="button"
                onClick={() => setShowNotesDrawer(true)}
                className="mt-2 w-full text-center text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                View all {notesProp.length} notes &rarr;
              </button>
            )}
          </div>

          {/* Quick Action buttons */}
          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            onClick={handleEditRecord}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Record
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            onClick={handleAddTask}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Add Task
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            onClick={handleAddNote}
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Add Note
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
            onClick={handleUploadFile}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>

          {canConvertToContact && (
            <Button
              variant="outline"
              className="w-full justify-start border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/5"
              onClick={() => setShowConvertDialog(true)}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Convert to Contact
            </Button>
          )}

          <div className="border-t border-slate-200 dark:border-white/10 pt-3 mt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Record Info
            </h4>
            <div className="space-y-2 text-sm">
              {/* Market Type */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Market</span>
                <MarketTypeBadge marketType={(record as any).market_type} size="sm" />
              </div>
              {/* Lane-appropriate owner */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{getOwnerLabel((record as any).market_type)}</span>
                <OwnershipDisplay record={record as any} size="sm" showLabel={false} />
              </div>
              {/* Data quality */}
              {(record as any).normalization_status && (record as any).normalization_status !== 'normalized' && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Data Quality</span>
                  <NormalizationBadge status={(record as any).normalization_status} size="sm" />
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-700 dark:text-slate-300" suppressHydrationWarning>
                  {new Date(record.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Updated</span>
                <span className="text-slate-700 dark:text-slate-300" suppressHydrationWarning>
                  {new Date(record.updated_at).toLocaleDateString()}
                </span>
              </div>
              {/* Import source (secondary metadata) */}
              {(record as any).import_source && (record as any).import_source !== 'manual' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Source</span>
                  <span className="text-slate-400 dark:text-slate-500 text-xs">
                    {(record as any).import_source === 'zoho_csv' ? 'Zoho Import' : (record as any).import_source}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </ActionRail>

      {/* Notes Drawer — slides from right */}
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
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-4 h-4 text-slate-400" />
                    </div>
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
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {note.body}
                  </p>
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

      {/* Add Task Modal */}
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
              <Button
                onClick={submitTask}
                disabled={isSubmitting}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
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

      {/* Add Note Modal */}
      <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Note Content *
              </label>
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter your note..."
                rows={12}
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[240px] resize-y"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowNoteModal(false)}
                className="border-slate-200 dark:border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={submitNote}
                disabled={isSubmitting}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
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

      {/* Upload File Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Upload File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                Select File *
              </label>
              <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-lg p-6 text-center">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
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

      {/* Convert Lead to Contact Dialog */}
      {canConvertToContact && (
        <ConvertToContactDialog
          open={showConvertDialog}
          onOpenChange={setShowConvertDialog}
          recordId={record.id}
          recordTitle={getRecordDisplayName(record)}
          recordData={(record.data || {}) as Record<string, unknown>}
          marketType={(record as any).market_type}
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

      <FollowUpReminderDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        recordId={record.id}
        recordTitle={getRecordDisplayName(record)}
        onCreated={() => setFollowUpRefreshKey((k) => k + 1)}
      />
    </div>
  );
});
