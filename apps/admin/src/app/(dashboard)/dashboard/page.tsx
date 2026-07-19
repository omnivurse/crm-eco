import {
  Users,
  UserCheck,
  FileText,
  Clock,
  Pulse,
  User,
  Package,
  GearSix,
  CurrencyDollar,
  Lightning,
  ChartBar,
  CaretRight,
  CreditCard,
} from '@phosphor-icons/react/dist/ssr';
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
    case 'member': return <User weight="light" className="h-4 w-4" />;
    case 'advisor': return <UserCheck weight="light" className="h-4 w-4" />;
    case 'enrollment': return <FileText weight="light" className="h-4 w-4" />;
    case 'product': case 'plan': return <Package weight="light" className="h-4 w-4" />;
    case 'settings': return <GearSix weight="light" className="h-4 w-4" />;
    default: return <Pulse weight="light" className="h-4 w-4" />;
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
    case 'charge': case 'refund': case 'generate_payouts': return 'text-[var(--adm-teal)] bg-[rgba(11,109,133,0.10)]';
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

          <div className="adm-bento">
            <div className="adm-span-12">
              <AdminOperationalTiles stats={consoleStats} />
            </div>
            <div className="adm-span-8">
              <AdminWorkQueue items={consoleStats.workQueue} />
            </div>
            <div className="adm-span-4">
              <AdminMemberFunnel stats={consoleStats} />
            </div>
          </div>
        </>
      )}

      {/* ── CRM Member KPI Overview ── */}
      <div className="adm-bezel">
        <div className="adm-bezel-inner p-6">
          <CrmKpiCards orgId={orgId} />
        </div>
      </div>

      {/* ── Commission Stats (preserved) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CommissionCard
          title="Pending Commissions"
          value={`$${commissions.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Awaiting approval and processing"
          icon={<Clock weight="light" className="h-6 w-6" />}
          href="/commissions/transactions?status=pending"
        />
        <CommissionCard
          title="Commissions Paid This Month"
          value={`$${commissions.paidThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          subtitle="Successfully disbursed to advisors"
          icon={<CurrencyDollar weight="light" className="h-6 w-6" />}
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
          <div className="adm-bezel h-full">
            <div className="adm-bezel-inner flex h-full flex-col">
              <div className="border-b border-[var(--adm-hairline)] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-[var(--adm-cyan)] to-[var(--adm-teal)] p-2.5">
                      <Pulse weight="light" className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--adm-ink)]">Recent Activity</h3>
                      <p className="text-sm text-[var(--adm-muted)]">Latest actions in the system</p>
                    </div>
                  </div>
                  <Link href="/settings/audit-logs" className="flex items-center gap-1 text-sm font-medium text-[var(--adm-muted)] transition-colors hover:text-[var(--adm-ink)]">
                    View all <CaretRight weight="light" className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="flex-1 p-4">
                {recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {recentActivity.map((activity, index) => (
                      <div key={activity.id} className="group flex items-center gap-4 rounded-xl p-4 transition-all duration-200 hover:bg-[rgba(11,109,133,0.05)] dark:hover:bg-white/5" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className={`rounded-xl p-2.5 ${getActionColor(activity.action)}`}>
                          {getEntityIcon(activity.entity_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--adm-ink)]">{formatActivity(activity)}</p>
                          <p className="text-xs text-[var(--adm-muted)]">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getActionColor(activity.action)}`}>{activity.action}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-[rgba(11,109,133,0.06)] dark:bg-white/5">
                      <Clock weight="light" className="h-10 w-10 text-[var(--adm-muted)] opacity-50" />
                    </div>
                    <p className="mb-1 font-semibold text-[var(--adm-ink)]">No recent activity</p>
                    <p className="text-sm text-[var(--adm-muted)]">Activities will appear here as you use the system</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - 2 columns */}
        <div className="lg:col-span-2">
          <div className="adm-bezel h-full">
            <div className="adm-bezel-inner flex h-full flex-col">
              <div className="border-b border-[var(--adm-hairline)] p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-[var(--adm-cyan)] to-[var(--adm-teal)] p-2.5">
                    <Lightning weight="light" className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--adm-ink)]">Quick Actions</h3>
                    <p className="text-sm text-[var(--adm-muted)]">Common administrative tasks</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 p-4">
                {[
                  { href: '/members/new', icon: Users, title: 'Add New Member', sub: 'Register a new member' },
                  { href: '/agents/new', icon: UserCheck, title: 'Add New Advisor', sub: 'Register a new advisor' },
                  { href: '/enrollments', icon: FileText, title: 'View Enrollments', sub: 'Manage applications' },
                  { href: '/commissions', icon: CreditCard, title: 'Process Commissions', sub: 'Review payouts' },
                  { href: '/reports', icon: ChartBar, title: 'View Reports', sub: 'Analytics & insights' },
                  { href: '/settings', icon: GearSix, title: 'System Settings', sub: 'Configure portal' },
                ].map(({ href, icon: Icon, title, sub }) => (
                  <Link key={href} href={href} className="group flex items-center gap-4 rounded-xl border border-transparent p-4 transition-all hover:border-[var(--adm-hairline)] hover:bg-[rgba(11,109,133,0.05)] dark:hover:bg-white/5">
                    <div className="rounded-xl bg-[rgba(11,109,133,0.06)] p-3 transition-colors group-hover:bg-gradient-to-br group-hover:from-[var(--adm-cyan)] group-hover:to-[var(--adm-teal)] dark:bg-white/5">
                      <Icon weight="light" className="h-5 w-5 text-[var(--adm-muted)] transition-colors group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--adm-ink)]">{title}</p>
                      <p className="text-xs text-[var(--adm-muted)]">{sub}</p>
                    </div>
                    <CaretRight weight="light" className="h-5 w-5 text-[var(--adm-muted)] transition-all group-hover:translate-x-1 group-hover:text-[var(--adm-ink)]" />
                  </Link>
                ))}
              </div>
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
