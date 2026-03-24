'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
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
  Search,
  ArrowRight,
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
import { supabase } from '@/lib/supabase-client';
import { ActionRail } from '@/components/layout/ActionRail';
import { cn } from '@crm-eco/ui/lib/utils';
import { StageSelector } from '@/components/crm/blueprints';
import { ComposerBar } from '@/components/zoho/ComposerBar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { CrmRecord, CrmModule, CrmField, CrmDealStage, CrmNoteWithAuthor } from '@/lib/crm/types';
import { MarketTypeBadge, NormalizationBadge, NormalizationBanner, OwnershipDisplay, getOwnerLabel } from '@/components/shared/crm-lane-badges';
import { ConvertToContactDialog } from '@/components/crm/records/ConvertToContactDialog';
import { CapacityBadges } from '@/components/shared/capacity-badge';

interface RecordDetailShellProps {
  record: CrmRecord;
  module: CrmModule;
  fields: CrmField[];
  stages?: CrmDealStage[];
  noteCount?: number;
  notes?: CrmNoteWithAuthor[];
  orgId?: string;
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

// --- Inline Record Search (persistent search while viewing a record) ---
const SEARCH_MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-3.5 h-3.5" />,
  leads: <UserPlus className="w-3.5 h-3.5" />,
  deals: <DollarSign className="w-3.5 h-3.5" />,
  accounts: <Building2 className="w-3.5 h-3.5" />,
};

const SEARCH_MODULE_COLORS: Record<string, string> = {
  contacts: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
  leads: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
  deals: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  accounts: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
};

interface InlineSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  module: string;
  moduleName: string;
}

function InlineRecordSearch({ currentRecordId }: { currentRecordId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InlineSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data: records } = await supabase
        .from('crm_records')
        .select('id, title, email, phone, module_id, data, crm_modules!inner(key, name)')
        .or(`title.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .neq('id', currentRecordId)
        .limit(12);

      setResults((records || []).map((r: any) => ({
        id: r.id,
        title: r.title || [r.data?.first_name, r.data?.last_name].filter(Boolean).join(' ') || 'Untitled',
        subtitle: r.email || r.phone || undefined,
        module: r.crm_modules?.key || 'unknown',
        moduleName: r.crm_modules?.name || 'Record',
      })));
      setSelectedIndex(0);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [currentRecordId]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateTo(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const navigateTo = (result: InlineSearchResult) => {
    router.push(`/crm/r/${result.id}`);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  // Group by module
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {} as Record<string, InlineSearchResult[]>);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 rounded-lg px-2.5 py-1.5 border border-transparent focus-within:border-teal-500/50 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all w-56 focus-within:w-72">
        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search records..."
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
        {query && !loading && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 mt-1.5 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No records found
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {Object.entries(grouped).map(([mod, modResults]) => (
                <div key={mod}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {modResults[0]?.moduleName || mod}
                  </div>
                  {modResults.map((result) => {
                    const gi = results.indexOf(result);
                    return (
                      <button
                        key={result.id}
                        onClick={() => navigateTo(result)}
                        onMouseEnter={() => setSelectedIndex(gi)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          gi === selectedIndex
                            ? 'bg-slate-100 dark:bg-white/5'
                            : 'hover:bg-slate-50 dark:hover:bg-white/5'
                        )}
                      >
                        <div className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-md shrink-0',
                          SEARCH_MODULE_COLORS[mod] || SEARCH_MODULE_COLORS.contacts
                        )}>
                          {SEARCH_MODULE_ICONS[mod] || <Users className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {gi === selectedIndex && (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-slate-100 dark:border-white/5 px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↵</kbd> open</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
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
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  // Sort notes: most recent first
  const sortedNotes = [...notesProp].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const recentNotes = sortedNotes.slice(0, 3);

  // Lead-to-Contact conversion flags
  const isLeads = module.key === 'leads';
  const isAlreadyConverted = record.status === 'Converted' || (record.data as Record<string, unknown>)?.is_converted === true;
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
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 xl:px-8 py-4">
            {/* Breadcrumb + Search */}
            <div className="flex items-center justify-between gap-4 mb-4">
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
                  {record.title || 'Untitled'}
                </span>
              </div>
              <InlineRecordSearch currentRecordId={record.id} />
            </div>

            {/* Title Row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', colors.bg, colors.text)}>
                  {icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {record.title || 'Untitled'}
                  </h1>
                  <div className="flex items-center gap-3 mt-1">
                    {record.email && (
                      <a 
                        href={`mailto:${record.email}`}
                        className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {record.email}
                      </a>
                    )}
                    {record.phone && (
                      <a 
                        href={`tel:${record.phone}`}
                        className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {record.phone}
                      </a>
                    )}
                    {record.status && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center gap-1 cursor-pointer hover:ring-2 hover:ring-teal-500/30 rounded-full transition-all">
                            <Badge
                              variant="outline"
                              className={cn(
                                'border text-xs font-medium',
                                record.status === 'Active'
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                  : record.status === 'Inactive' || record.status === 'Terminated' || record.status === 'Cancelled'
                                  ? 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
                                  : 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                              )}
                            >
                              {record.status}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 min-w-[160px]">
                          {['Active', 'Inactive', 'Pending', 'Cancelled', 'Terminated', 'Hold', 'Archived'].map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={s === record.status}
                              className={cn(
                                'text-sm',
                                s === record.status && 'opacity-50',
                                s === 'Active' && 'text-emerald-600 dark:text-emerald-400',
                                (s === 'Inactive' || s === 'Terminated' || s === 'Cancelled') && 'text-red-600 dark:text-red-400',
                              )}
                              onClick={async () => {
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
                                  toast.success(`Status changed to ${s}`);
                                  router.refresh();
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed to update status');
                                }
                              }}
                            >
                              {s}
                            </DropdownMenuItem>
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

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  onClick={handleEditRecord}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
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
                        if (!confirm(`Are you sure you want to delete this ${module.name.toLowerCase()}? This action cannot be undone.`)) return;
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
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 xl:px-8 pt-4">
            <ComposerBar
              recordId={record.id}
              onNoteCreated={onRefresh}
              onTaskCreated={onRefresh}
              onCallLogged={onRefresh}
            />
          </div>
        )}

        {/* Tab Content */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 xl:px-8 py-6">
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
      <ActionRail title="Quick Actions" width="sm" defaultCollapsed={false}>
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
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block" suppressHydrationWarning>
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
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
                      {note.author?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0" suppressHydrationWarning>
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
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
          recordTitle={record.title || 'Untitled'}
          recordData={(record.data || {}) as Record<string, unknown>}
        />
      )}
    </div>
  );
});
