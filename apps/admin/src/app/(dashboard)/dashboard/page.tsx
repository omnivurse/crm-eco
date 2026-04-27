import {
  Users,
  UserCheck,
  FileText,
  Clock,
  Activity,
  User,
  Package,
  Settings,
  DollarSign,
  Zap,
  BarChart3,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { Suspense } from 'react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  TodoListWidget,
  JobsWidget,
  RecentPagesWidget,
  CommissionCard,
  FutureEnrollmentsCard,
  MemberActivityAnalysis,
  AdminCommandBar,
  AdminAlertsStrip,
  AdminOperationalTiles,
  AdminWorkQueue,
  AdminMemberFunnel,
  CrmKpiCards,
} from '@/components/dashboard';
import type { FutureEnrollmentsData, MemberActivityData } from '@/components/dashboard';
import { getCachedAdminConsoleStats } from '@/lib/admin-console-queries';

// ============================================================================
// Types
// ============================================================================

interface ActivityLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_profile: {
    full_name: string;
    email: string;
  } | null;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getAdminContext() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single() as { data: { id: string; full_name: string | null } | null };

  if (!profile) return null;

  return {
    profileId: profile.id,
    fullName: profile.full_name || 'Admin',
    orgId: tenant.organizationId,
    orgName: tenant.organizationName,
  };
}

async function getCommissionStats(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [pendingSettled, paidSettled] = await Promise.allSettled([
    supabase
      .from('commission_transactions')
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'pending') as unknown as { data: { commission_amount: number }[] | null },
    supabase
      .from('commission_transactions')
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', startOfMonth.toISOString()) as unknown as { data: { commission_amount: number }[] | null },
  ]);
  const pendingResult = pendingSettled.status === 'fulfilled' ? pendingSettled.value : { data: null };
  const paidResult = paidSettled.status === 'fulfilled' ? paidSettled.value : { data: null };

  return {
    pending: (pendingResult.data || []).reduce((s, t) => s + (t.commission_amount || 0), 0),
    paidThisMonth: (paidResult.data || []).reduce((s, t) => s + (t.commission_amount || 0), 0),
  };
}

async function getFutureEnrollmentsData(orgId: string): Promise<FutureEnrollmentsData> {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { data: futureEnrollments, count: totalFutureActive } = await (supabase
    .from('enrollments')
    .select('id, start_date, members(first_name, last_name), products(name)', { count: 'exact' })
    .eq('organization_id', orgId)
    .gt('start_date', now.toISOString())
    .eq('status', 'approved')
    .order('start_date', { ascending: true })
    .limit(10) as any);

  const { count: startingThisMonth } = await (supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('start_date', startOfMonth.toISOString())
    .lte('start_date', endOfMonth.toISOString())
    .eq('status', 'approved') as any);

  const upcomingEnrollments = (futureEnrollments || []).map((e: any) => ({
    id: e.id,
    memberName: e.members ? `${e.members.first_name} ${e.members.last_name}` : 'Unknown',
    startDate: e.start_date,
    planName: e.products?.name || 'Unknown Plan',
  }));

  return {
    totalFutureActive: totalFutureActive ?? 0,
    startingThisMonth: startingThisMonth ?? 0,
    nextStartDate: upcomingEnrollments.length > 0 ? upcomingEnrollments[0].startDate : null,
    upcomingEnrollments,
  };
}

async function getMemberActivityData(orgId: string): Promise<MemberActivityData> {
  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [newEnrollmentsSettled, inactiveSettled, prevEnrollmentsSettled, prevInactiveSettled, totalSettled, activeSettled] =
    await Promise.allSettled([
      supabase.from('enrollments').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'approved').gte('approved_at', startOfMonth.toISOString()) as any,
      supabase.from('members').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'inactive').gte('updated_at', startOfMonth.toISOString()) as any,
      supabase.from('enrollments').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'approved')
        .gte('approved_at', startOfPrevMonth.toISOString()).lt('approved_at', startOfMonth.toISOString()) as any,
      supabase.from('members').select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId).eq('status', 'inactive')
        .gte('updated_at', startOfPrevMonth.toISOString()).lt('updated_at', startOfMonth.toISOString()) as any,
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    ]);
  const newEnrollmentsResult = newEnrollmentsSettled.status === 'fulfilled' ? newEnrollmentsSettled.value : { count: null };
  const inactiveResult = inactiveSettled.status === 'fulfilled' ? inactiveSettled.value : { count: null };
  const prevEnrollmentsResult = prevEnrollmentsSettled.status === 'fulfilled' ? prevEnrollmentsSettled.value : { count: null };
  const prevInactiveResult = prevInactiveSettled.status === 'fulfilled' ? prevInactiveSettled.value : { count: null };
  const totalResult = totalSettled.status === 'fulfilled' ? totalSettled.value : { count: null };
  const activeResult = activeSettled.status === 'fulfilled' ? activeSettled.value : { count: null };

  const newEnrollments = newEnrollmentsResult.count ?? 0;
  const inactive = inactiveResult.count ?? 0;
  const total = totalResult.count ?? 1;
  const active = activeResult.count ?? 0;

  return {
    newEnrollmentsThisMonth: newEnrollments,
    inactiveMembersThisMonth: inactive,
    netGrowth: newEnrollments - inactive,
    retentionRate: Math.round((active / total) * 100),
    previousMonthEnrollments: prevEnrollmentsResult.count ?? 0,
    previousMonthInactive: prevInactiveResult.count ?? 0,
  };
}

async function getRecentActivity(orgId: string): Promise<ActivityLogEntry[]> {
  const supabase = await createServerSupabaseClient();

  const { data: activities, error } = await supabase
    .from('admin_activity_log')
    .select(`
      id, entity_type, entity_id, action, description, metadata, created_at,
      actor_profile:profiles!admin_activity_log_actor_profile_id_fkey(full_name, email)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return (activities || []) as unknown as ActivityLogEntry[];
}

// ============================================================================
// UI Helpers
// ============================================================================

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'member': return <User className="h-4 w-4" />;
    case 'advisor': return <UserCheck className="h-4 w-4" />;
    case 'enrollment': return <FileText className="h-4 w-4" />;
    case 'product': case 'plan': return <Package className="h-4 w-4" />;
    case 'settings': return <Settings className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'create': return 'text-emerald-600 bg-emerald-500/10';
    case 'update': case 'update_commission_tier': return 'text-blue-600 bg-blue-500/10';
    case 'delete': return 'text-red-600 bg-red-500/10';
    case 'approve': case 'process_enrollment': return 'text-emerald-600 bg-emerald-500/10';
    case 'reject': return 'text-orange-600 bg-orange-500/10';
    case 'cancel': return 'text-slate-600 bg-slate-500/10';
    case 'charge': case 'refund': case 'generate_payouts': return 'text-purple-600 bg-purple-500/10';
    default: return 'text-slate-600 bg-slate-500/10';
  }
}

function formatActivity(activity: ActivityLogEntry): string {
  if (activity.description) return activity.description;
  const actorName = activity.actor_profile?.full_name || 'System';
  const actionMap: Record<string, string> = {
    create: 'created', update: 'updated', delete: 'deleted',
    approve: 'approved', reject: 'rejected', cancel: 'cancelled',
    activate: 'activated', deactivate: 'deactivated',
    import: 'imported', export: 'exported',
  };
  return `${actorName} ${actionMap[activity.action] || activity.action} a ${activity.entity_type}`;
}

// ============================================================================
// Page Component
// ============================================================================

async function DashboardContent() {
  const adminCtx = await getAdminContext();
  if (!adminCtx) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700">Unable to load dashboard</p>
          <p className="text-sm text-slate-500 mt-1">Please sign in to access the admin console.</p>
        </div>
      </div>
    );
  }

  const { profileId, fullName, orgId, orgName } = adminCtx;

  // Fetch all data in parallel with individual error handling
  const [consoleStatsResult, commissionsResult, futureEnrollmentsResult, memberActivityResult, recentActivityResult] =
    await Promise.allSettled([
      getCachedAdminConsoleStats(orgId),
      getCommissionStats(orgId),
      getFutureEnrollmentsData(orgId),
      getMemberActivityData(orgId),
      getRecentActivity(orgId),
    ]);

  const consoleStats = consoleStatsResult.status === 'fulfilled' ? consoleStatsResult.value : null;
  const commissions = commissionsResult.status === 'fulfilled' ? commissionsResult.value : { pending: 0, paidThisMonth: 0 };
  const futureEnrollments = futureEnrollmentsResult.status === 'fulfilled' ? futureEnrollmentsResult.value : { totalFutureActive: 0, startingThisMonth: 0, nextStartDate: null, upcomingEnrollments: [] };
  const memberActivity = memberActivityResult.status === 'fulfilled' ? memberActivityResult.value : { newEnrollmentsThisMonth: 0, inactiveMembersThisMonth: 0, netGrowth: 0, retentionRate: 0, previousMonthEnrollments: 0, previousMonthInactive: 0 };
  const recentActivity = recentActivityResult.status === 'fulfilled' ? recentActivityResult.value : [];

  return (
    <div className="space-y-6 pb-8">
      {/* ── Enterprise Command Console ── */}
      {consoleStats && (
        <>
          <AdminCommandBar
            adminName={fullName}
            orgName={orgName}
            stats={consoleStats}
          />

          <AdminAlertsStrip stats={consoleStats} />

          <AdminOperationalTiles stats={consoleStats} />

          <AdminWorkQueue items={consoleStats.workQueue} />

          <AdminMemberFunnel stats={consoleStats} />
        </>
      )}

      {/* ── CRM Member KPI Overview ── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] p-6">
        <CrmKpiCards orgId={orgId} />
      </div>

      {/* ── Commission Stats (preserved) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CommissionCard
          title="Pending Commissions"
          value={`$${commissions.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Awaiting approval and processing"
          icon={<Clock className="w-6 h-6 text-slate-600" />}
          href="/commissions/transactions?status=pending"
        />
        <CommissionCard
          title="Commissions Paid This Month"
          value={`$${commissions.paidThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Successfully disbursed to advisors"
          icon={<DollarSign className="w-6 h-6 text-slate-600" />}
          href="/commissions"
        />
      </div>

      {/* ── Future Enrollments & Member Activity (preserved) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FutureEnrollmentsCard data={futureEnrollments} />
        <MemberActivityAnalysis data={memberActivity} />
      </div>

      {/* ── Dashboard Widgets (preserved) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TodoListWidget profileId={profileId} organizationId={orgId} />
        <JobsWidget organizationId={orgId} />
        <RecentPagesWidget profileId={profileId} organizationId={orgId} />
      </div>

      {/* ── Activity Feed & Quick Actions (preserved) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Activity - 3 columns */}
        <div className="lg:col-span-3">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200" />
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-700">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-sm text-slate-500">Latest actions in the system</p>
                  </div>
                </div>
                <Link href="/settings/audit-logs" className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="p-4">
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity, index) => (
                    <div key={activity.id} className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className={`p-2.5 rounded-xl ${getActionColor(activity.action)}`}>
                        {getEntityIcon(activity.entity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{formatActivity(activity)}</p>
                        <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                      </div>
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize ${getActionColor(activity.action)}`}>{activity.action}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center">
                    <Clock className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">No recent activity</p>
                  <p className="text-sm text-slate-400">Activities will appear here as you use the system</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions - 2 columns */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] h-full">
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200" />
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-700">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
                  <p className="text-sm text-slate-500">Common administrative tasks</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {[
                { href: '/members/new', icon: Users, title: 'Add New Member', sub: 'Register a new member' },
                { href: '/agents/new', icon: UserCheck, title: 'Add New Advisor', sub: 'Register a new advisor' },
                { href: '/enrollments', icon: FileText, title: 'View Enrollments', sub: 'Manage applications' },
                { href: '/commissions', icon: CreditCard, title: 'Process Commissions', sub: 'Review payouts' },
                { href: '/reports', icon: BarChart3, title: 'View Reports', sub: 'Analytics & insights' },
                { href: '/settings', icon: Settings, title: 'System Settings', sub: 'Configure portal' },
              ].map(({ href, icon: Icon, title, sub }) => (
                <Link key={href} href={href} className="group flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-slate-700 transition-colors">
                    <Icon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-700">{title}</p>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-8 animate-pulse">
      <div className="h-24 bg-slate-200 rounded-2xl" />
      <div className="h-16 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
