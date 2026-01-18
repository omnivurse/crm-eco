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
  Clock,
  RefreshCw,
  Shield,
  Zap,
  ChevronRight,
  FileText,
  Settings,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleStats, getUpcomingTasks, getRecentActivity, getAtRiskDeals, getTodaysTasks, type AtRiskDeal } from '@/lib/crm/queries';
import type { ModuleStats, CrmTask, CrmAuditLog } from '@/lib/crm/types';

// Premium stat card component
function PremiumStatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  href,
  change,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  href?: string;
  change?: number;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] transition-all duration-500 hover:-translate-y-1">
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      {/* Glow effect on hover */}
      <div className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl`} />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br')} bg-opacity-10 backdrop-blur-sm`}>
            <div className="text-white">{icon}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
            {change !== undefined && change > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3 h-3" />
                +{change}
              </span>
            )}
          </div>
          {href && (
            <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Task item component
function TaskItem({ task }: { task: CrmTask }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date();

  return (
    <Link
      href={`/crm/tasks?id=${task.id}`}
      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
    >
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-teal-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {task.title}
        </p>
        {task.due_at && (
          <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
            {isOverdue ? 'Overdue' : new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: CrmAuditLog }) {
  const actionConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
    create: { color: 'text-emerald-600', bgColor: 'bg-emerald-500/10', icon: Sparkles },
    update: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', icon: Activity },
    delete: { color: 'text-red-600', bgColor: 'bg-red-500/10', icon: AlertCircle },
  };

  const config = actionConfig[activity.action] || { color: 'text-slate-600', bgColor: 'bg-slate-500/10', icon: Activity };
  const Icon = config.icon;

  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200">
      <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-medium text-slate-900 dark:text-white capitalize">{activity.action}</span>
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
      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize ${config.bgColor} ${config.color}`}>
        {activity.action}
      </span>
    </div>
  );
}

// At-Risk Deal item
function AtRiskDealItem({ deal }: { deal: AtRiskDeal }) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <Link
      href={`/crm/r/${deal.id}`}
      className="group flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {deal.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            {deal.stage}
          </span>
          <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <Timer className="w-3 h-3" />
            {deal.daysInStage}d stale
          </span>
        </div>
      </div>
      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 ml-3">
        {formatCurrency(deal.value)}
      </span>
    </Link>
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
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile.full_name?.split(' ')[0] || 'there';

  const overdueTasks = todaysTasks.filter(t => t.due_at && new Date(t.due_at) < new Date());
  const totalAtRiskValue = atRiskDeals.reduce((sum, d) => sum + d.value, 0);

  // Map stats to card configs
  const statConfigs: Record<string, { gradient: string; icon: React.ReactNode }> = {
    accounts: {
      gradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
      icon: <Building2 className="w-5 h-5" />,
    },
    contacts: {
      gradient: 'bg-gradient-to-r from-[#047474] to-[#069B9A]',
      icon: <Users className="w-5 h-5" />,
    },
    deals: {
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      icon: <DollarSign className="w-5 h-5" />,
    },
    leads: {
      gradient: 'bg-gradient-to-r from-violet-500 to-purple-400',
      icon: <UserPlus className="w-5 h-5" />,
    },
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-8 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="heroGrid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M 5 0 L 0 0 0 5" fill="none" stroke="white" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#heroGrid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-white/80">CRM Online</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#047474]/30 backdrop-blur-sm border border-[#047474]/40">
                  <Target className="w-3.5 h-3.5 text-[#069B9A]" />
                  <span className="text-xs font-medium text-[#069B9A]">Sales Hub</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{greeting}, {firstName}!</h1>
              <p className="text-white/60 text-lg">Here&apos;s what&apos;s happening with your CRM today</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white/60">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats in header */}
          <div className="flex items-center gap-6 mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Sun className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{todaysTasks.length}</p>
                <p className="text-xs text-white/50">Tasks Today</p>
              </div>
            </div>
            {overdueTasks.length > 0 && (
              <>
                <div className="w-px h-12 bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{overdueTasks.length}</p>
                    <p className="text-xs text-white/50">Overdue</p>
                  </div>
                </div>
              </>
            )}
            <div className="w-px h-12 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.reduce((sum, s) => sum + s.createdThisWeek, 0)}</p>
                <p className="text-xs text-white/50">New This Week</p>
              </div>
            </div>
            {atRiskDeals.length > 0 && (
              <>
                <div className="w-px h-12 bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/20">
                    <Flame className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{atRiskDeals.length}</p>
                    <p className="text-xs text-white/50">At Risk</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.length > 0 ? (
          stats.map((stat) => {
            const config = statConfigs[stat.moduleKey] || statConfigs.contacts;
            return (
              <PremiumStatCard
                key={stat.moduleKey}
                title={stat.moduleName}
                value={stat.totalRecords.toLocaleString()}
                subtitle={`Total ${stat.moduleName.toLowerCase()}`}
                icon={config.icon}
                gradient={config.gradient}
                href={`/crm/modules/${stat.moduleKey}`}
                change={stat.createdThisWeek}
              />
            );
          })
        ) : (
          // Default cards when no stats
          <>
            <PremiumStatCard
              title="Accounts"
              value="0"
              subtitle="Total accounts"
              icon={<Building2 className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-amber-500 to-orange-400"
              href="/crm/modules/accounts"
            />
            <PremiumStatCard
              title="Contacts"
              value="0"
              subtitle="Total contacts"
              icon={<Users className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-[#047474] to-[#069B9A]"
              href="/crm/modules/contacts"
            />
            <PremiumStatCard
              title="Deals"
              value="0"
              subtitle="Total deals"
              icon={<DollarSign className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-emerald-500 to-teal-400"
              href="/crm/modules/deals"
            />
            <PremiumStatCard
              title="Leads"
              value="0"
              subtitle="Total leads"
              icon={<UserPlus className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-violet-500 to-purple-400"
              href="/crm/modules/leads"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Today & At Risk (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Today's Tasks */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400">
                    <Sun className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Today&apos;s Tasks</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                {todaysTasks.length > 0 && (
                  <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4">
              {todaysTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-500/20 dark:to-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">All clear!</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">No tasks scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {overdueTasks.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-3 mb-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {todaysTasks.slice(0, 5).map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>

            {todaysTasks.length > 5 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/crm/tasks"
                  className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                >
                  View all {todaysTasks.length} tasks
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          {/* At-Risk Deals */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-red-400 to-rose-500" />

            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-400">
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">At-Risk Deals</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Stale for 7+ days</p>
                  </div>
                </div>
                {atRiskDeals.length > 0 && (
                  <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                    ${totalAtRiskValue >= 1000 ? `${(totalAtRiskValue / 1000).toFixed(0)}K` : totalAtRiskValue.toLocaleString()} at risk
                  </span>
                )}
              </div>
            </div>

            <div className="p-4">
              {atRiskDeals.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-500/20 dark:to-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <Target className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Pipeline healthy!</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">No stale deals detected</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {atRiskDeals.slice(0, 4).map((deal) => (
                    <AtRiskDealItem key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </div>

            {atRiskDeals.length > 4 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/crm/pipeline"
                  className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                >
                  View pipeline
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Actions & Activity (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#003560] via-[#047474] to-[#E9B61F]" />

            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#003560] to-[#047474]">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Quick Actions</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Common tasks</p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <Link
                href="/crm/modules/contacts/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-[#047474]/20 hover:bg-gradient-to-r hover:from-[#047474]/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-[#047474]/10 group-hover:bg-[#047474] transition-colors">
                  <Users className="w-5 h-5 text-[#047474] group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">New Contact</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Add a contact</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#047474] group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/crm/modules/deals/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-emerald-200 hover:bg-gradient-to-r hover:from-emerald-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 group-hover:bg-emerald-500 transition-colors">
                  <DollarSign className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">New Deal</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Create a deal</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/crm/tasks/new"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-amber-200 hover:bg-gradient-to-r hover:from-amber-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-500/10 group-hover:bg-amber-500 transition-colors">
                  <Calendar className="w-5 h-5 text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">New Task</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Schedule a task</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/crm/reports"
                className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-violet-200 hover:bg-gradient-to-r hover:from-violet-500/5 hover:to-transparent transition-all"
              >
                <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-500/10 group-hover:bg-violet-500 transition-colors">
                  <BarChart3 className="w-5 h-5 text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">View Reports</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Analytics</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#047474] via-[#069B9A] to-[#027343]" />

            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#047474] to-[#069B9A]">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Latest actions</p>
                  </div>
                </div>
                <Link
                  href="/crm/activities"
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                >
                  View all
                </Link>
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto">
              {activity.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-2xl flex items-center justify-center">
                    <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No activity yet</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Actions will appear here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activity.slice(0, 6).map((item) => (
                    <ActivityItem key={item.id} activity={item} />
                  ))}
                </div>
              )}
            </div>
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
    <div className="space-y-8 pb-8">
      {/* Hero skeleton */}
      <div className="h-64 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl animate-pulse" />

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
