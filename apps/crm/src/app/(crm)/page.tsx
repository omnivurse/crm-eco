import { Suspense } from 'react';
import Link from 'next/link';
import { 
  Users, 
  UserPlus, 
  DollarSign, 
  Building2, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { getCurrentProfile, getModuleStats, getUpcomingTasks, getRecentActivity } from '@/lib/crm/queries';
import type { ModuleStats, CrmTask, CrmAuditLog } from '@/lib/crm/types';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-6 h-6" />,
  leads: <UserPlus className="w-6 h-6" />,
  deals: <DollarSign className="w-6 h-6" />,
  accounts: <Building2 className="w-6 h-6" />,
};

function ModuleCard({ stat }: { stat: ModuleStats }) {
  const icon = MODULE_ICONS[stat.moduleKey] || <Users className="w-6 h-6" />;
  
  return (
    <Link
      href={`/crm/modules/${stat.moduleKey}`}
      className="group relative overflow-hidden bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 hover:bg-slate-800 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
          {icon}
        </div>
        <ArrowUpRight className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{stat.moduleName}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">{stat.totalRecords.toLocaleString()}</span>
        {stat.createdThisWeek > 0 && (
          <span className="text-sm text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +{stat.createdThisWeek} this week
          </span>
        )}
      </div>
    </Link>
  );
}

function TaskItem({ task }: { task: CrmTask }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();
  const isDueSoon = task.due_at && !isOverdue && 
    new Date(task.due_at) < new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
      <div className={`p-1 rounded ${
        task.status === 'completed' ? 'text-emerald-400' :
        isOverdue ? 'text-red-400' :
        isDueSoon ? 'text-amber-400' :
        'text-slate-400'
      }`}>
        {task.status === 'completed' ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : isOverdue ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Clock className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{task.title}</p>
        {task.due_at && (
          <p className={`text-xs ${
            isOverdue ? 'text-red-400' : 
            isDueSoon ? 'text-amber-400' : 
            'text-slate-500'
          }`}>
            Due {new Date(task.due_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: CrmAuditLog }) {
  const actionColors: Record<string, string> = {
    create: 'text-emerald-400',
    update: 'text-blue-400',
    delete: 'text-red-400',
    import: 'text-purple-400',
  };

  return (
    <div className="flex items-start gap-3 p-3">
      <div className={`text-xs font-medium uppercase ${actionColors[activity.action] || 'text-slate-400'}`}>
        {activity.action}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-300 text-sm truncate">
          {activity.entity} record
        </p>
        <p className="text-slate-500 text-xs">
          {new Date(activity.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [stats, tasks, activity] = await Promise.all([
    getModuleStats(profile.organization_id),
    getUpcomingTasks(profile.id, 7),
    getRecentActivity(profile.organization_id, 10),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {profile.full_name.split(' ')[0]}
          </h1>
          <p className="text-slate-400 mt-1">
            Here&apos;s what&apos;s happening with your CRM today.
          </p>
        </div>
        <Link
          href="/crm/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import Data
        </Link>
      </div>

      {/* Module Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <ModuleCard key={stat.moduleKey} stat={stat} />
        ))}
      </div>

      {/* Tasks & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Upcoming Tasks</h2>
            <span className="text-sm text-slate-400">{tasks.length} pending</span>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No upcoming tasks. You&apos;re all caught up!
              </p>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-80 overflow-y-auto">
            {activity.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No recent activity.
              </p>
            ) : (
              activity.slice(0, 8).map((item) => (
                <ActivityItem key={item.id} activity={item} />
              ))
            )}
          </div>
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
    <div className="space-y-8 animate-pulse">
      <div className="h-16 bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-slate-800/50 rounded-xl" />
        <div className="h-80 bg-slate-800/50 rounded-xl" />
      </div>
    </div>
  );
}
