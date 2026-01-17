'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings2,
  Calendar,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  Upload,
  HeartPulse,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Play,
  Zap,
  BarChart3,
  ListTodo,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';

// ============================================================================
// Type Definitions
// ============================================================================

interface OperationsModule {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  stats?: {
    label: string;
    value: number;
    status?: 'success' | 'warning' | 'error';
  };
}

interface TaskSummary {
  overdue: number;
  dueToday: number;
  upcoming: number;
  completed: number;
}

interface ApprovalSummary {
  pending: number;
  approved: number;
  rejected: number;
}

// ============================================================================
// Mock Data (Replace with API calls)
// ============================================================================

const OPERATIONS_MODULES: OperationsModule[] = [
  {
    key: 'scheduling',
    name: 'Scheduling',
    description: 'Manage booking links and availability',
    icon: <Calendar className="w-5 h-5" />,
    href: '/crm/scheduling',
    color: 'blue',
    stats: { label: 'Active Links', value: 5 },
  },
  {
    key: 'playbooks',
    name: 'Playbooks',
    description: 'Sales playbooks and guided selling',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/crm/playbooks',
    color: 'violet',
    stats: { label: 'Active Playbooks', value: 8 },
  },
  {
    key: 'tasks',
    name: 'Tasks',
    description: 'Track and manage all tasks',
    icon: <CheckSquare className="w-5 h-5" />,
    href: '/crm/tasks',
    color: 'amber',
    stats: { label: 'Open Tasks', value: 23, status: 'warning' },
  },
  {
    key: 'approvals',
    name: 'Approvals',
    description: 'Review and approve requests',
    icon: <ClipboardCheck className="w-5 h-5" />,
    href: '/crm/approvals',
    color: 'teal',
    stats: { label: 'Pending', value: 7, status: 'warning' },
  },
  {
    key: 'imports',
    name: 'Data Import',
    description: 'Import data from CSV and other sources',
    icon: <Upload className="w-5 h-5" />,
    href: '/crm/import',
    color: 'emerald',
    stats: { label: 'Recent Imports', value: 3 },
  },
  {
    key: 'needs',
    name: 'Needs Management',
    description: 'Track healthcare needs and requests',
    icon: <HeartPulse className="w-5 h-5" />,
    href: '/crm/needs',
    color: 'rose',
    stats: { label: 'Open Needs', value: 15, status: 'warning' },
  },
];

const TASK_SUMMARY: TaskSummary = {
  overdue: 5,
  dueToday: 8,
  upcoming: 15,
  completed: 42,
};

const APPROVAL_SUMMARY: ApprovalSummary = {
  pending: 7,
  approved: 23,
  rejected: 2,
};

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  href,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
  href?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  };

  const content = (
    <div className={`glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 ${href ? 'hover:border-teal-500/50 transition-all cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ModuleCard({ module }: { module: OperationsModule }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  const statusColors: Record<string, string> = {
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
  };

  return (
    <Link
      href={module.href}
      className="group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-teal-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[module.color]}`}>
          {module.icon}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition-colors" />
      </div>

      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {module.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {module.description}
      </p>

      {module.stats && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">{module.stats.label}</span>
          <span className={`text-sm font-semibold ${module.stats.status ? statusColors[module.stats.status] : 'text-slate-900 dark:text-white'}`}>
            {module.stats.value}
          </span>
        </div>
      )}
    </Link>
  );
}

function TaskOverview({ summary }: { summary: TaskSummary }) {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Task Overview</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {summary.overdue + summary.dueToday} items need attention
          </p>
        </div>
        <Link href="/crm/tasks" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
          View All
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">Overdue</span>
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.overdue}</div>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Due Today</span>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.dueToday}</div>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Upcoming</span>
          </div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.upcoming}</div>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Completed</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.completed}</div>
        </div>
      </div>
    </div>
  );
}

function ApprovalOverview({ summary }: { summary: ApprovalSummary }) {
  const total = summary.pending + summary.approved + summary.rejected;
  const approvalRate = total > 0 ? Math.round((summary.approved / total) * 100) : 0;

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Approvals</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {approvalRate}% approval rate
          </p>
        </div>
        <Link href="/crm/approvals" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
          View All
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Pending</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{summary.pending}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Approved</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{summary.approved}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Rejected</span>
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{summary.rejected}</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500" style={{ width: `${(summary.approved / total) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${(summary.pending / total) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(summary.rejected / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function OperationsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <OperationsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
            <Settings2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Operations Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Manage scheduling, tasks, approvals, and workflows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/crm/settings/automations">
            <Button variant="outline" size="sm">
              <Zap className="w-4 h-4 mr-2" />
              Automations
            </Button>
          </Link>
          <Link href="/crm/tasks">
            <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400">
              <ListTodo className="w-4 h-4 mr-2" />
              View Tasks
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Overdue Tasks"
          value={TASK_SUMMARY.overdue}
          icon={AlertTriangle}
          color="red"
          href="/crm/tasks?filter=overdue"
        />
        <StatCard
          label="Due Today"
          value={TASK_SUMMARY.dueToday}
          icon={Clock}
          color="amber"
          href="/crm/tasks?filter=today"
        />
        <StatCard
          label="Pending Approvals"
          value={APPROVAL_SUMMARY.pending}
          icon={ClipboardCheck}
          color="blue"
          href="/crm/approvals"
        />
        <StatCard
          label="Completed This Week"
          value={TASK_SUMMARY.completed}
          icon={CheckCircle2}
          color="emerald"
          trend={{ value: 12, label: 'vs last week' }}
        />
      </div>

      {/* Task & Approval Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskOverview summary={TASK_SUMMARY} />
        <ApprovalOverview summary={APPROVAL_SUMMARY} />
      </div>

      {/* Operations Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Operations Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OPERATIONS_MODULES.map((module) => (
            <ModuleCard key={module.key} module={module} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/crm/tasks/new"
            className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all"
          >
            <CheckSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Create Task</div>
              <div className="text-xs text-slate-500">Add a new task</div>
            </div>
          </Link>

          <Link
            href="/crm/scheduling/new"
            className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all"
          >
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">New Booking Link</div>
              <div className="text-xs text-slate-500">Create scheduling link</div>
            </div>
          </Link>

          <Link
            href="/crm/playbooks/new"
            className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all"
          >
            <Play className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">New Playbook</div>
              <div className="text-xs text-slate-500">Create sales playbook</div>
            </div>
          </Link>

          <Link
            href="/crm/import"
            className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500/50 transition-all"
          >
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Import Data</div>
              <div className="text-xs text-slate-500">Upload CSV or Excel</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function OperationsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800/50 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800/50 rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
