'use client';

import Link from 'next/link';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  Download,
  Phone,
  Mail,
  MessageSquare,
  CheckSquare,
  Users,
  Clock,
  Activity,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface TaskData {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ActivityStats {
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
  avgActivitiesPerDay: number;
  overdueActivities: number;
  activitiesThisWeek: number;
}

interface ActivityByType {
  type: string;
  count: number;
  completed: number;
}

interface UserActivity {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
}

interface DailyActivity {
  day: string;
  created: number;
  completed: number;
}

interface ActivityReportClientProps {
  tasks: TaskData[];
  stats: ActivityStats;
  activityTypes: ActivityByType[];
  userActivities: UserActivity[];
  weeklyTrend: DailyActivity[];
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{change >= 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function ActivityTypeChart({ data }: { data: ActivityByType[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
    call: { icon: Phone, color: 'bg-blue-500' },
    email: { icon: Mail, color: 'bg-violet-500' },
    meeting: { icon: Users, color: 'bg-amber-500' },
    task: { icon: CheckSquare, color: 'bg-emerald-500' },
    note: { icon: MessageSquare, color: 'bg-rose-500' },
    other: { icon: Activity, color: 'bg-slate-500' },
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Activities by Type</h3>
          <p className="text-sm text-slate-500">Breakdown of activity categories</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item) => {
          const config = typeConfig[item.type] || typeConfig.other;
          const Icon = config.icon;
          return (
            <div key={item.type} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('p-1.5 rounded', config.color)}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{item.type}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500">{item.count} total</span>
                  <span className="text-emerald-600 font-medium">{item.completed} done</span>
                </div>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', config.color)}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No activity data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamLeaderboard({ users }: { users: UserActivity[] }) {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Team Productivity</h3>
          <p className="text-sm text-slate-500">Activity completion by team member</p>
        </div>
      </div>

      <div className="space-y-3">
        {users.map((user, index) => (
          <div
            key={user.userId}
            className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
              {index + 1}
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
              {user.userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">{user.userName}</p>
              <p className="text-xs text-slate-500">
                {user.completedActivities} / {user.totalActivities} activities
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-sm font-semibold',
                user.completionRate >= 80 ? 'text-emerald-600' :
                user.completionRate >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>
                {user.completionRate}%
              </p>
              <p className="text-xs text-slate-500">completed</p>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No team activity data</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyTrend({ data }: { data: DailyActivity[] }) {
  const maxValue = Math.max(...data.flatMap(d => [d.created, d.completed]), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Activity Trend</h3>
          <p className="text-sm text-slate-500">Daily created vs completed activities</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            Created
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Completed
          </span>
        </div>
      </div>

      <div className="h-48 flex items-end gap-4">
        {data.map((day) => (
          <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1 h-40">
              <div
                className="w-5 bg-blue-500 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (day.created / maxValue) * 100 : 0}%`, minHeight: day.created > 0 ? '4px' : '0' }}
              />
              <div
                className="w-5 bg-emerald-500 rounded-t transition-all"
                style={{ height: `${maxValue > 0 ? (day.completed / maxValue) * 100 : 0}%`, minHeight: day.completed > 0 ? '4px' : '0' }}
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">{day.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverdueActivities({ tasks }: { tasks: TaskData[] }) {
  const now = new Date();
  const overdue = tasks
    .filter(t => {
      if (t.status === 'completed') return false;
      if (!t.due_at) return false;
      return new Date(t.due_at) < now;
    })
    .slice(0, 5);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-rose-500" />
        Overdue Activities
      </h3>

      <div className="space-y-3">
        {overdue.map((task) => {
          const daysOverdue = Math.floor(
            (now.getTime() - new Date(task.due_at!).getTime()) / (1000 * 60 * 60 * 24)
          );
          return (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{task.title}</p>
                <p className="text-sm text-slate-500 capitalize">{task.activity_type || 'Task'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-rose-600">{daysOverdue} days overdue</p>
              </div>
            </div>
          );
        })}
        {overdue.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No overdue activities</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

export function ActivityReportClient({
  tasks,
  stats,
  activityTypes,
  userActivities,
  weeklyTrend,
}: ActivityReportClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/crm/reports">
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Activity Report</h1>
            </div>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
              Team productivity and engagement
            </p>
          </div>
        </div>

        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" />
          <span>Export Report</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Activities" value={stats.totalActivities.toLocaleString()} icon={Activity} color="blue" />
        <StatCard label="Completed" value={stats.completedActivities} icon={CheckSquare} color="emerald" />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} icon={TrendingUp} color="violet" />
        <StatCard label="Avg Per Day" value={stats.avgActivitiesPerDay} icon={Calendar} color="amber" />
        <StatCard label="This Week" value={stats.activitiesThisWeek} icon={Clock} color="teal" />
        <StatCard label="Overdue" value={stats.overdueActivities} icon={Clock} color="rose" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityTypeChart data={activityTypes} />
        <TeamLeaderboard users={userActivities} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklyTrend data={weeklyTrend} />
        <OverdueActivities tasks={tasks} />
      </div>
    </div>
  );
}
