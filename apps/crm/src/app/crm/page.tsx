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
  Sparkles,
  Activity,
  Target,
  Zap,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleStats, getUpcomingTasks, getRecentActivity } from '@/lib/crm/queries';
import type { ModuleStats, CrmTask, CrmAuditLog } from '@/lib/crm/types';

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-6 h-6" />,
  leads: <UserPlus className="w-6 h-6" />,
  deals: <DollarSign className="w-6 h-6" />,
  accounts: <Building2 className="w-6 h-6" />,
};

const MODULE_GRADIENTS: Record<string, string> = {
  contacts: 'from-teal-500/20 to-cyan-500/10',
  leads: 'from-violet-500/20 to-purple-500/10',
  deals: 'from-emerald-500/20 to-green-500/10',
  accounts: 'from-amber-500/20 to-orange-500/10',
};

const MODULE_COLORS: Record<string, string> = {
  contacts: 'text-teal-600 dark:text-teal-400',
  leads: 'text-violet-600 dark:text-violet-400',
  deals: 'text-emerald-600 dark:text-emerald-400',
  accounts: 'text-amber-600 dark:text-amber-400',
};

const MODULE_BORDER_COLORS: Record<string, string> = {
  contacts: 'border-teal-500/30 hover:border-teal-500/50',
  leads: 'border-violet-500/30 hover:border-violet-500/50',
  deals: 'border-emerald-500/30 hover:border-emerald-500/50',
  accounts: 'border-amber-500/30 hover:border-amber-500/50',
};

function ModuleCard({ stat, index }: { stat: ModuleStats; index: number }) {
  const icon = MODULE_ICONS[stat.moduleKey] || <Users className="w-6 h-6" />;
  const gradient = MODULE_GRADIENTS[stat.moduleKey] || 'from-teal-500/20 to-cyan-500/10';
  const color = MODULE_COLORS[stat.moduleKey] || 'text-teal-600 dark:text-teal-400';
  const borderColor = MODULE_BORDER_COLORS[stat.moduleKey] || 'border-teal-500/30';
  
  return (
    <Link
      href={`/crm/modules/${stat.moduleKey}`}
      className={`
        group relative overflow-hidden rounded-2xl p-6 
        bg-gradient-to-br ${gradient} glass-card
        border ${borderColor}
        transition-all duration-300 hover:scale-[1.02]
      `}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 animate-shimmer" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-white/50 dark:bg-slate-900/50 ${color}`}>
            {icon}
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
        </div>
        
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{stat.moduleName}</h3>
        
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {stat.totalRecords.toLocaleString()}
          </span>
          {stat.createdThisWeek > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" />
              +{stat.createdThisWeek}
            </span>
          )}
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Total records</p>
      </div>
    </Link>
  );
}

function QuickActionCard({ 
  icon: Icon, 
  title, 
  description, 
  href, 
  gradient 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  href: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl glass-card border border-slate-200 dark:border-white/5 hover:border-teal-500/30 transition-all duration-300"
    >
      <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1">
        <h3 className="text-slate-900 dark:text-white font-medium group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{title}</h3>
        <p className="text-slate-500 text-sm">{description}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
    </Link>
  );
}

function TaskItem({ task }: { task: CrmTask }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();
  const isDueSoon = task.due_at && !isOverdue && 
    new Date(task.due_at) < new Date(Date.now() + 24 * 60 * 60 * 1000);

  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    overdue: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    soon: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    normal: { icon: Clock, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/10' },
  };

  const status = task.status === 'completed' ? 'completed' 
    : isOverdue ? 'overdue' 
    : isDueSoon ? 'soon' 
    : 'normal';

  const { icon: StatusIcon, color, bg } = statusConfig[status];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-900/30 hover:bg-slate-200 dark:hover:bg-slate-900/50 border border-slate-200 dark:border-white/5 transition-all duration-200 group">
      <div className={`p-2 rounded-lg ${bg}`}>
        <StatusIcon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 dark:text-white text-sm font-medium truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {task.title}
        </p>
        {task.due_at && (
          <p className={`text-xs ${color}`}>
            Due {new Date(task.due_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: CrmAuditLog }) {
  const actionConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
    create: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', icon: Sparkles },
    update: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', icon: Activity },
    delete: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
    import: { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10', icon: Upload },
  };

  const config = actionConfig[activity.action] || { color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/10', icon: Activity };
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-3 border-b border-slate-200 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
      <div className={`p-2 rounded-lg ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          <span className={`font-medium ${config.color}`}>{activity.action}</span>
          {' '}
          <span className="text-slate-900 dark:text-white">{activity.entity}</span>
        </p>
        <p className="text-slate-500 text-xs mt-0.5">
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

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-teal-600 dark:text-teal-400 text-sm font-medium">Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {profile.full_name.split(' ')[0]} <span className="wave">👋</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Here&apos;s what&apos;s happening with your CRM today.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/20"
            asChild
          >
            <Link href="/crm/reports">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Reports
            </Link>
          </Button>
          <Button 
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-sm hover:shadow-md transition-all"
            asChild
          >
            <Link href="/crm/import">
              <Upload className="w-4 h-4 mr-2" />
              Import Data
            </Link>
          </Button>
        </div>
      </div>

      {/* Module Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.length > 0 ? (
          stats.map((stat, index) => (
            <ModuleCard key={stat.moduleKey} stat={stat} index={index} />
          ))
        ) : (
          // Show loading state while auto-seed runs
          <>
            {[
              { icon: Users, name: 'Contacts', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' },
              { icon: UserPlus, name: 'Leads', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
              { icon: DollarSign, name: 'Deals', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
              { icon: Building2, name: 'Accounts', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
            ].map((module, index) => (
              <div key={module.name} className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-white/10 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${module.bg} ${module.color}`}>
                    <module.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-semibold">{module.name}</h3>
                    <p className="text-slate-500 text-sm">Initializing...</p>
                  </div>
                </div>
                <div className="h-10 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-white/10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={UserPlus}
            title="New Lead"
            description="Add a potential customer"
            href="/crm/modules/leads/new"
            gradient="from-violet-500 to-purple-600"
          />
          <QuickActionCard
            icon={Users}
            title="New Contact"
            description="Add a contact record"
            href="/crm/modules/contacts/new"
            gradient="from-teal-500 to-cyan-600"
          />
          <QuickActionCard
            icon={DollarSign}
            title="New Deal"
            description="Create a sales opportunity"
            href="/crm/modules/deals/new"
            gradient="from-emerald-500 to-green-600"
          />
          <QuickActionCard
            icon={Upload}
            title="Import Data"
            description="Bulk import from CSV"
            href="/crm/import"
            gradient="from-amber-500 to-orange-600"
          />
        </div>
      </div>

      {/* Tasks & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Tasks</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-2.5 py-1 rounded-full">
              {tasks.length} pending
            </span>
          </div>
          <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900/50 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
                </div>
                <p className="text-slate-900 dark:text-white font-medium">All caught up!</p>
                <p className="text-slate-500 text-sm mt-1">
                  No upcoming tasks for the next 7 days.
                </p>
              </div>
            ) : (
              tasks.slice(0, 5).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))
            )}
          </div>
          {tasks.length > 5 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-white/5">
              <Link href="/crm/tasks" className="text-teal-600 dark:text-teal-400 text-sm hover:text-teal-500 dark:hover:text-teal-300 transition-colors">
                View all {tasks.length} tasks →
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
            </div>
            <Link href="/crm/activity" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              View all
            </Link>
          </div>
          <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900/50 mb-4">
                  <Activity className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-900 dark:text-white font-medium">No activity yet</p>
                <p className="text-slate-500 text-sm mt-1">
                  Activity will appear here as you use the CRM.
                </p>
              </div>
            ) : (
              activity.slice(0, 8).map((item) => (
                <ActivityItem key={item.id} activity={item} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Performance Overview</h2>
          </div>
          <select className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Leads Created</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">-</p>
            <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Import data to see metrics
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">-</p>
            <p className="text-slate-500 text-xs mt-1">Lead to Contact</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Deals Closed</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">-</p>
            <p className="text-slate-500 text-xs mt-1">This period</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Revenue</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">$-</p>
            <p className="text-slate-500 text-xs mt-1">This period</p>
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
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-8 w-64 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
        ))}
      </div>
      
      {/* Quick actions skeleton */}
      <div className="h-32 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
      
      {/* Tasks & Activity skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
        <div className="h-96 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
      </div>
    </div>
  );
}
