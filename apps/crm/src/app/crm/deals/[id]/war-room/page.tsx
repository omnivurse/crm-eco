'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Target,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  User,
  Plus,
  Send,
  BookOpen,
  X,
  Loader2,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { resolveNoteSourceRecordIdsWithClient } from '@/lib/crm/note-aggregate';
import { getNoteAuthorDisplay } from '@/lib/crm/note-sanitize';

// ============================================================================
// Types
// ============================================================================

interface DealRecord {
  id: string;
  title: string;
  stage: string | null;
  status: string | null;
  data: Record<string, unknown>;
  owner_profile: { full_name: string } | null;
}

interface Note {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  author: { full_name: string } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  activity_type: string | null;
  completed_at: string | null;
  created_at: string;
  assignee: { full_name: string } | null;
}

interface StageChange {
  id: string;
  from_stage: string | null;
  to_stage: string | null;
  reason: string | null;
  created_at: string;
  changed_by_profile: { full_name: string } | null;
}

interface TimelineEvent {
  id: string;
  type: 'note' | 'task' | 'stage_change' | 'call' | 'meeting' | 'email';
  title: string;
  description: string;
  timestamp: string;
  user: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatCurrency(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value || '0'));
  if (isNaN(num)) return '$0';
  return `$${num.toLocaleString()}`;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return date.toLocaleDateString();
}

// ============================================================================
// Main Component
// ============================================================================

export default function DealWarRoomPage() {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<DealRecord | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stageHistory, setStageHistory] = useState<StageChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [showAddBlocker, setShowAddBlocker] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [blockerTitle, setBlockerTitle] = useState('');

  // --------------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const [dealRes, tasksRes, stageRes] = await Promise.all([
        supabase
          .from('crm_records')
          .select('id, title, stage, status, data, owner_profile:profiles!crm_records_owner_id_fkey(full_name)')
          .eq('id', id)
          .single(),
        supabase
          .from('crm_tasks')
          .select('id, title, description, due_at, priority, status, activity_type, completed_at, created_at, assignee:profiles!crm_tasks_assigned_to_fkey(full_name)')
          .eq('record_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('crm_deal_stage_history')
          .select('id, from_stage, to_stage, reason, created_at, changed_by_profile:profiles!crm_deal_stage_history_changed_by_fkey(full_name)')
          .eq('record_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (dealRes.error) {
        setError(dealRes.error.message);
        setLoading(false);
        return;
      }

      const dealRow = dealRes.data as DealRecord;
      const noteSourceIds = await resolveNoteSourceRecordIdsWithClient(
        supabase,
        {
          id: dealRow.id,
          data: (dealRow.data || {}) as Record<string, unknown>,
        },
        'deals',
      );

      const notesRes = await supabase
        .from('crm_notes')
        .select('id, body, is_pinned, created_at, author:profiles!crm_notes_created_by_fkey(full_name)')
        .in('record_id', noteSourceIds)
        .order('created_at', { ascending: false })
        .limit(50);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDeal(dealRow as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNotes((notesRes.data as any) || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTasks((tasksRes.data as any) || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setStageHistory((stageRes.data as any) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    setSubmittingNote(true);
    try {
      const res = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: id, body: newNote.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add note');
      }
      toast.success('Note added');
      setNewNote('');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleAddTask = async (title: string, priority: string) => {
    try {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: id,
          title,
          priority,
          activity_type: 'task',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      if (task.status !== 'completed') {
        const res = await fetch(`/api/crm/tasks/${task.id}/complete`, { method: 'POST' });
        const result = await res.json();
        if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to complete task');
        toast.success(`"${task.title}" completed`);
      } else {
        // Reopen task
        const { error: updateError } = await supabase
          .from('crm_tasks')
          .update({ status: 'open', completed_at: null })
          .eq('id', task.id);
        if (updateError) throw updateError;
        toast.success(`"${task.title}" reopened`);
      }
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------

  // Actions = tasks with low/normal priority that aren't completed
  const actions = tasks.filter(
    (t) => ['low', 'normal'].includes(t.priority) && t.status !== 'completed'
  );

  // Blockers = tasks with high/urgent priority that aren't completed
  const blockers = tasks.filter(
    (t) => ['high', 'urgent'].includes(t.priority) && t.status !== 'completed'
  );

  // Build unified timeline from notes + stage changes + completed tasks
  const timeline: TimelineEvent[] = [
    ...notes.map((n) => ({
      id: `note_${n.id}`,
      type: 'note' as const,
      title: 'Note added',
      description: n.body.length > 120 ? n.body.substring(0, 120) + '...' : n.body,
      timestamp: n.created_at,
      user: getNoteAuthorDisplay(n as any, { showHistorical: true }),
    })),
    ...stageHistory.map((s) => ({
      id: `stage_${s.id}`,
      type: 'stage_change' as const,
      title: `Stage: ${s.from_stage || '(none)'} → ${s.to_stage || '(none)'}`,
      description: s.reason || 'Stage changed',
      timestamp: s.created_at,
      user: s.changed_by_profile?.full_name || 'System',
    })),
    ...tasks
      .filter((t) => ['call', 'meeting', 'email'].includes(t.activity_type || ''))
      .map((t) => ({
        id: `task_${t.id}`,
        type: (t.activity_type || 'task') as TimelineEvent['type'],
        title: t.title,
        description: t.description || '',
        timestamp: t.created_at,
        user: t.assignee?.full_name || 'Unknown',
      })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Deal data helpers
  const dealAmount = deal?.data?.amount || deal?.data?.deal_amount || deal?.data?.value || 0;
  const dealProbability = (deal?.data?.probability || deal?.data?.win_probability) as number | undefined;
  const dealCloseDate = (deal?.data?.close_date || deal?.data?.expected_close_date) as string | undefined;

  // --------------------------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------------------------

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'meeting': return <User className="w-4 h-4" />;
      case 'stage_change': return <ArrowRightLeft className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400';
      case 'normal': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };

  // --------------------------------------------------------------------------
  // Loading / Error states
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="space-y-4 py-12 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {error || 'Deal not found'}
        </h2>
        <Link
          href={`/crm/deals/${id}`}
          className="text-teal-600 hover:text-teal-700 text-sm"
        >
          Back to Deal
        </Link>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/deals/${id}`}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            Deal War Room
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{deal.title}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(dealAmount)}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {deal.stage && <span className="capitalize">{deal.stage.replace(/_/g, ' ')}</span>}
            {dealProbability != null && <span> &middot; {String(dealProbability)}%</span>}
            {dealCloseDate && <span> &middot; Close {new Date(String(dealCloseDate)).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Timeline */}
        <div className="space-y-4">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Activity Timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                No activity yet. Add a note below to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {timeline.slice(0, 15).map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg h-fit">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white">{event.title}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 truncate">{event.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(event.timestamp)}
                        <span>&middot;</span>
                        {event.user}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Blockers */}
        <div className="space-y-4">
          {/* Next Best Actions */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Next Best Actions</h2>
              {showAddAction ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder="Action title..."
                    className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && actionTitle.trim()) {
                        handleAddTask(actionTitle.trim(), 'normal');
                        setActionTitle('');
                        setShowAddAction(false);
                        toast.success('Action added');
                      }
                      if (e.key === 'Escape') setShowAddAction(false);
                    }}
                  />
                  <button onClick={() => setShowAddAction(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddAction(true)}
                  className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
            </div>
            <div className="space-y-3">
              {actions.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                  No actions yet. Click &quot;Add&quot; to create one.
                </p>
              )}
              {actions.map((action) => (
                <div key={action.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <button
                    onClick={() => handleToggleTask(action)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${action.status === 'completed' ? 'text-green-500' : 'text-slate-300'}`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{action.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDueDate(action.due_at)}
                      {action.assignee && <span> &middot; {action.assignee.full_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blockers */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Blockers
              </h2>
              {showAddBlocker ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={blockerTitle}
                    onChange={(e) => setBlockerTitle(e.target.value)}
                    placeholder="Blocker description..."
                    className="px-2 py-1 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && blockerTitle.trim()) {
                        handleAddTask(blockerTitle.trim(), 'urgent');
                        setBlockerTitle('');
                        setShowAddBlocker(false);
                        toast.success('Blocker added');
                      }
                      if (e.key === 'Escape') setShowAddBlocker(false);
                    }}
                  />
                  <button onClick={() => setShowAddBlocker(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddBlocker(true)}
                  className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
            </div>
            <div className="space-y-3">
              {blockers.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                  No blockers. Looking good!
                </p>
              )}
              {blockers.map((blocker) => (
                <div key={blocker.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(blocker)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded mt-0.5"
                        title="Mark as resolved"
                      >
                        <CheckCircle2 className="w-5 h-5 text-slate-300" />
                      </button>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{blocker.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {blocker.assignee ? `Owner: ${blocker.assignee.full_name}` : 'Unassigned'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${getPriorityColor(blocker.priority)}`}>
                      {blocker.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Playbook */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" />
                Playbook
              </h2>
            </div>
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              <p className="text-sm">No playbook attached</p>
              <button
                onClick={async () => {
                  const steps = [
                    'Send personalized proposal',
                    'Schedule executive alignment call',
                    'Send ROI analysis document',
                  ];
                  for (const step of steps) {
                    await handleAddTask(step, 'normal');
                  }
                  toast.success('Playbook applied — action items created');
                }}
                className="text-sm text-teal-600 hover:text-teal-700 mt-2"
              >
                Attach Playbook
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Compose */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a quick note or update..."
            className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newNote.trim()) handleAddNote();
            }}
          />
          <Link
            href={`/crm/communications/new?deal_id=${id}&channel=sms`}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Log Call"
          >
            <Phone className="w-5 h-5 text-slate-500" />
          </Link>
          <Link
            href={`/crm/communications/new?deal_id=${id}&channel=email`}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Send Email"
          >
            <Mail className="w-5 h-5 text-slate-500" />
          </Link>
          <button
            onClick={handleAddNote}
            disabled={submittingNote || !newNote.trim()}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submittingNote ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
