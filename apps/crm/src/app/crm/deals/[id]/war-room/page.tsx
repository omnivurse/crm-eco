'use client';

import { useState, use } from 'react';
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
  Flag,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface TimelineEvent {
  id: string;
  type: 'email' | 'call' | 'note' | 'meeting' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  user: string;
}

interface Blocker {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved';
  owner: string;
}

interface NextAction {
  id: string;
  title: string;
  due: string;
  assignee: string;
  completed: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export default function DealWarRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [newNote, setNewNote] = useState('');
  
  // Mock data
  const deal = {
    name: 'Enterprise Deal - Acme Corp',
    amount: 250000,
    stage: 'Proposal',
    probability: 60,
    closeDate: '2026-02-28',
    owner: 'John Smith',
  };
  
  const timeline: TimelineEvent[] = [
    {
      id: '1',
      type: 'email',
      title: 'Proposal sent',
      description: 'Sent pricing proposal to decision makers',
      timestamp: '2 hours ago',
      user: 'John Smith',
    },
    {
      id: '2',
      type: 'meeting',
      title: 'Demo call completed',
      description: 'Product demo with technical team',
      timestamp: '1 day ago',
      user: 'John Smith',
    },
    {
      id: '3',
      type: 'stage_change',
      title: 'Stage changed to Proposal',
      description: 'Moved from Demo to Proposal',
      timestamp: '2 days ago',
      user: 'System',
    },
  ];
  
  const blockers: Blocker[] = [
    {
      id: '1',
      title: 'Legal review pending',
      severity: 'high',
      status: 'in_progress',
      owner: 'Legal Team',
    },
    {
      id: '2',
      title: 'Budget approval needed',
      severity: 'medium',
      status: 'open',
      owner: 'CFO',
    },
  ];
  
  const nextActions: NextAction[] = [
    {
      id: '1',
      title: 'Follow up on proposal',
      due: 'Tomorrow',
      assignee: 'John Smith',
      completed: false,
    },
    {
      id: '2',
      title: 'Schedule executive sponsor call',
      due: 'This week',
      assignee: 'John Smith',
      completed: false,
    },
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'call': return <Phone className="w-4 h-4" />;
      case 'meeting': return <User className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400';
      case 'high': return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400';
      case 'medium': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };

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
          <p className="text-sm text-slate-500 dark:text-slate-400">{deal.name}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ${deal.amount.toLocaleString()}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {deal.probability}% • Close {deal.closeDate}
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Timeline */}
        <div className="space-y-4">
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Activity Timeline</h2>
            <div className="space-y-4">
              {timeline.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg h-fit">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{event.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{event.description}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {event.timestamp}
                      <span>•</span>
                      {event.user}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions & Blockers */}
        <div className="space-y-4">
          {/* Next Best Actions */}
          <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">Next Best Actions</h2>
              <button
                onClick={() => toast.info('Add action functionality coming soon')}
                className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {nextActions.map((action) => (
                <div key={action.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <button
                    onClick={() => toast.success(`Action "${action.title}" marked as complete`)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                  >
                    <CheckCircle2 className={`w-5 h-5 ${action.completed ? 'text-green-500' : 'text-slate-300'}`} />
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{action.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {action.due} • {action.assignee}
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
              <button
                onClick={() => toast.info('Add blocker functionality coming soon')}
                className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {blockers.map((blocker) => (
                <div key={blocker.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{blocker.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Owner: {blocker.owner}</div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(blocker.severity)}`}>
                      {blocker.severity}
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
                onClick={() => toast.info('Attach playbook functionality coming soon')}
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
          />
          <button
            onClick={() => toast.info('Log call functionality coming soon')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Log Call"
          >
            <Phone className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => toast.info('Send email functionality coming soon')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Send Email"
          >
            <Mail className="w-5 h-5 text-slate-500" />
          </button>
          <button
            onClick={() => {
              if (newNote.trim()) {
                toast.success('Note added');
                setNewNote('');
              } else {
                toast.error('Please enter a note');
              }
            }}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
