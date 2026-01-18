import { Suspense } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  DollarSign,
  Building2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Activity,
  Target,
  Calendar,
  BarChart3,
  Sun,
  AlertTriangle,
  ArrowRight,
  Flame,
  Timer,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleStats, getUpcomingTasks, getRecentActivity, getAtRiskDeals, getTodaysTasks, type AtRiskDeal } from '@/lib/crm/queries';
import type { ModuleStats, CrmTask, CrmAuditLog } from '@/lib/crm/types';

// Compact stat card with cleaner design
function StatCard({ stat, index }: { stat: ModuleStats; index: number }) {
  const configs: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
    accounts: {
      icon: Building2,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200/50 dark:border-amber-500/20 hover:border-amber-300 dark:hover:border-amber-500/40'
    },
    contacts: {
      icon: Users,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-500/10',
      borderColor: 'border-teal-200/50 dark:border-teal-500/20 hover:border-teal-300 dark:hover:border-teal-500/40'
    },
    deals: {
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
      borderColor: 'border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/40'
    },
    leads: {
      icon: UserPlus,
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-50 dark:bg-violet-500/10',
      borderColor: 'border-violet-200/50 dark:border-violet-500/20 hover:border-violet-300 dark:hover:border-violet-500/40'
    },
  };

  const config = configs[stat.moduleKey] || configs.contacts;
  const Icon = config.icon;

  return (
    <Link
      href={`/crm/modules/${stat.moduleKey}`}
      className={`group relative flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/60 border ${config.borderColor} transition-all duration-200 hover:shadow-md`}
    >
      <div className={`shrink-0 p-3 rounded-xl ${config.bgColor}`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.moduleName}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {stat.totalRecords.toLocaleString()}
          </span>
          {stat.createdThisWeek > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              +{stat.createdThisWeek}
            </span>
          )}
        </div>
      </div>

      <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors" />
    </Link>
  );
}

// Compact task item
function TaskItem({ task }: { task: CrmTask }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();

  return (
    <Link
      href={`/crm/tasks?id=${task.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {task.title}
        </p>
        {task.due_at && (
          <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
            {isOverdue ? 'Overdue' : new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </Link>
  );
}

// Activity item - even more compact
function ActivityItem({ activity }: { activity: CrmAuditLog }) {
  const actionConfig: Record<string, { color: string; icon: React.ElementType }> = {
    create: { color: 'text-emerald-500', icon: Sparkles },
    update: { color: 'text-blue-500', icon: Activity },
    delete: { color: 'text-red-500', icon: AlertCircle },
  };

  const config = actionConfig[activity.action] || { color: 'text-slate-400', icon: Activity };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-white">{activity.action}</span>
          {' '}{activity.entity}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {new Date(activity.created_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}

// My Day - Cleaner version
function MyDayCard({ tasks }: { tasks: CrmTask[] }) {
  const overdueTasks = tasks.filter(t => t.due_at && new Date(t.due_at) < new Date());
  const upcomingTasks = tasks.filter(t => !overdueTasks.includes(t)).slice(0, 4);
  const totalTasks = tasks.length;

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
              <Sun className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Today</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          {totalTasks > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">All clear!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No tasks for today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Overdue indicator */}
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {overdueTasks.length} overdue
                </span>
              </div>
            )}

            {/* Task list */}
            {[...overdueTasks.slice(0, 2), ...upcomingTasks].slice(0, 5).map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {tasks.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/crm/tasks"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all tasks
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

// At-Risk Deals - Cleaner version
function AtRiskCard({ deals }: { deals: AtRiskDeal[] }) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-400 to-rose-500">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">At-Risk Deals</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Stale for 7+ days</p>
            </div>
          </div>
          {deals.length > 0 && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              {formatCurrency(totalValue)} at risk
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {deals.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Pipeline healthy</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No stale deals detected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.slice(0, 4).map((deal) => (
              <Link
                key={deal.id}
                href={`/crm/r/${deal.id}`}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {deal.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {deal.stage}
                    </span>
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      {deal.daysInStage}d
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 ml-3">
                  {formatCurrency(deal.value)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {deals.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/crm/pipeline"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View pipeline
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Activity Feed - Cleaner version
function ActivityFeed({ activity }: { activity: CrmAuditLog[] }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          </div>
          <Link
            href="/crm/activities"
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
          >
            View all
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 divide-y divide-slate-100 dark:divide-slate-800 max-h-[340px] overflow-y-auto">
        {activity.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 mx-auto mb-2 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No activity yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Actions will appear here</p>
          </div>
        ) : (
          activity.slice(0, 8).map((item) => (
            <ActivityItem key={item.id} activity={item} />
          ))
        )}
      </div>
    </div>
  );
}

// Upcoming Tasks - Compact version
function UpcomingTasksCard({ tasks }: { tasks: CrmTask[] }) {
  return (
    <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Upcoming</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Next 7 days</p>
            </div>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {tasks.length} pending
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[340px] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">All caught up!</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No upcoming tasks</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.slice(0, 6).map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {tasks.length > 6 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
          <Link
            href="/crm/tasks"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View all {tasks.length} tasks
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

async function DashboardContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [stats, tasks, activity, todaysTasks, atRiskDeals] = await Promise.all([
    getModuleStats(profile.organization_id),
    getUpcomingTasks(profile.id, 7),
    getRecentActivity(profile.organization_id, 10),
    getTodaysTasks(profile.id),
    getAtRiskDeals(profile.organization_id, 5),
  ]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-6">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {greeting}, {firstName}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Here&apos;s what&apos;s happening with your CRM today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            asChild
          >
            <Link href="/crm/reports">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Reports
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid - Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.length > 0 ? (
          stats.map((stat, index) => (
            <StatCard key={stat.moduleKey} stat={stat} index={index} />
          ))
        ) : (
          // Loading state
          [
            { key: 'accounts', name: 'Accounts', icon: Building2, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            { key: 'contacts', name: 'Contacts', icon: Users, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10' },
            { key: 'deals', name: 'Deals', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            { key: 'leads', name: 'Leads', icon: UserPlus, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          ].map((module) => (
            <div key={module.key} className="flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 animate-pulse">
              <div className={`p-3 rounded-xl ${module.bg}`}>
                <module.icon className={`w-5 h-5 ${module.color}`} />
              </div>
              <div className="flex-1">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Focus Area */}
        <div className="space-y-4">
          <MyDayCard tasks={todaysTasks} />
          <AtRiskCard deals={atRiskDeals} />
        </div>

        {/* Right Column - Activity & Upcoming */}
        <div className="space-y-4">
          <UpcomingTasksCard tasks={tasks} />
          <ActivityFeed activity={activity} />
        </div>
      </div>
    </div>
  );
}

export default function CrmDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
