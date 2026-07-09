import { Suspense } from 'react';
import {
  getCurrentProfile,
  getCachedDashboardHeroStats,
  getCachedAtRiskDeals,
  getCachedModuleStats,
  getReportSummary,
  getUpcomingTasks,
  getRecentActivity,
  getTodaysTasks,
  getCalendarEvents,
  getAdvisorContactSummary,
  createCrmClient,
  getMyTasks,
} from '@/lib/crm/queries';
import { loadDashboardLayout } from './dashboard-actions';
import { WIDGET_REGISTRY } from '@/lib/dashboard';
import { resolveDefaultDashboardLayout } from '@/lib/dashboard/role-default-layout';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import type { HeroCalendarEvent } from '@/components/dashboard/DashboardHero';
import type { TodayQueueItem } from '@/components/dashboard/TodayQueuePreview';
import {
  CrmAlerts,
  DashboardToolbar,
  DashboardSkeleton,
} from '@/components/dashboard';
import { preRenderWidgets } from '@/components/dashboard/ServerWidgetRenderer';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';

/** Active enrollment count for the journey strip (draft + in_progress + submitted). */
async function getOpenEnrollmentCount(orgId: string): Promise<number> {
  try {
    const supabase = await createCrmClient();
    const { count, error } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['draft', 'in_progress', 'submitted']);
    if (error) {
      console.error('[Dashboard] enrollment count failed:', error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error('[Dashboard] enrollment count error:', err);
    return 0;
  }
}

/** Build a compact today-queue preview from tasks + at-risk deals. */
async function buildTodayQueueItems(
  profileId: string,
  orgId: string,
): Promise<TodayQueueItem[]> {
  const items: TodayQueueItem[] = [];
  try {
    const [todaysTasks, myTasks, atRisk] = await Promise.all([
      getTodaysTasks(profileId, 5),
      getMyTasks(profileId, false, 20),
      getCachedAtRiskDeals(orgId, 3),
    ]);

    const now = new Date();
    const overdue = myTasks.filter(
      (t) => t.due_at && new Date(t.due_at) < now && t.status !== 'completed',
    );

    for (const t of overdue.slice(0, 2)) {
      items.push({
        id: `overdue-${t.id}`,
        title: t.title || 'Untitled task',
        subtitle: t.due_at ? `Due ${new Date(t.due_at).toLocaleDateString()}` : null,
        href: '/crm/workqueue',
        kind: 'overdue',
      });
    }

    for (const t of todaysTasks.slice(0, 3)) {
      if (items.some((i) => i.id === `overdue-${t.id}`)) continue;
      items.push({
        id: `task-${t.id}`,
        title: t.title || 'Untitled task',
        subtitle: 'Due today',
        href: '/crm/workqueue',
        kind: 'task',
      });
    }

    for (const d of atRisk.slice(0, 2)) {
      items.push({
        id: `risk-${d.id}`,
        title: d.name || 'At-risk deal',
        subtitle: `${d.daysInStage}d in stage · ${d.stage}`,
        href: `/crm/r/${d.id}`,
        kind: 'at_risk',
      });
    }
  } catch (err) {
    console.error('[Dashboard] today queue build failed:', err);
  }
  return items.slice(0, 5);
}

// Server-side data fetching based on widget types
async function fetchWidgetData(
  profile: { id: string; organization_id: string },
  widgetTypes: string[],
  sharedData: {
    moduleStats: unknown;
    heroStats: unknown;
    reportSummary: unknown;
  }
) {
  const dataKeys = new Set(
    widgetTypes.map((type) => WIDGET_REGISTRY[type]?.dataKey).filter(Boolean)
  );

  const fetchers: Record<string, () => Promise<unknown>> = {
    todaysTasks: () => getTodaysTasks(profile.id),
    upcomingTasks: () => getUpcomingTasks(profile.id, 7),
    recentActivity: () => getRecentActivity(profile.organization_id, 10),
    atRiskDeals: () => getCachedAtRiskDeals(profile.organization_id, 5),
    quickActions: () => Promise.resolve(null),
    topDeals: () => Promise.resolve([]),
    pipelineSummary: () => Promise.resolve(null),
    performanceMetrics: () => Promise.resolve(null),
    calendarEvents: () => getCalendarEvents(profile.organization_id),
    notesMemos: () => Promise.resolve([]),
    emailStats: () => Promise.resolve(null),
    leadConversion: () => Promise.resolve(null),
    teamLeaderboard: () => Promise.resolve([]),
    revenueChart: () => Promise.resolve(null),
    // New widget data — uses already-fetched shared data (no extra DB calls)
    salesCommandTiles: () =>
      Promise.resolve({
        moduleStats: sharedData.moduleStats,
        heroStats: sharedData.heroStats,
        reportSummary: sharedData.reportSummary,
      }),
    moduleStats: () => Promise.resolve(sharedData.moduleStats),
    pipelineFunnel: () =>
      Promise.resolve({
        moduleStats: sharedData.moduleStats,
        reportSummary: sharedData.reportSummary,
      }),
    advisorContacts: () => getAdvisorContactSummary(profile.organization_id),
    advisorGrowth: () => getAdvisorContactSummary(profile.organization_id),
    topAdvisors: () => Promise.resolve([]),
    lowestChurnAdvisors: () => Promise.resolve([]),
    advisorMemberRetention: () => Promise.resolve([]),
    networkCoverageHealth: () => Promise.resolve([]),
    networkProviderStats: () => Promise.resolve([]),
    networkCostRouter: () => Promise.resolve([]),
    memberKpiStats: () => Promise.resolve(null), // MemberKpiWidget fetches its own data client-side
  };

  const results: Record<string, unknown> = {};

  await Promise.all(
    Array.from(dataKeys).map(async (key) => {
      if (fetchers[key]) {
        try {
          results[key] = await fetchers[key]();
        } catch (err) {
          console.error(`[Dashboard] Widget data fetch failed for "${key}":`, err);
          results[key] = null;
        }
      }
    })
  );

  return results;
}

async function DashboardContent() {
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[Dashboard] Failed to get profile:', err);
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Unable to load dashboard</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please sign in to access the CRM.</p>
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Profile not found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please complete your profile setup.</p>
        </div>
      </div>
    );
  }

  // Load user's saved layout, or role-aware defaults for first-time visitors.
  let layout = resolveDefaultDashboardLayout(profile.crm_role);
  try {
    const savedLayout = await loadDashboardLayout();
    if (savedLayout) layout = savedLayout;
  } catch (err) {
    console.error('[Dashboard] Failed to load layout, using role default:', err);
  }

  // Strip comingSoon widgets from the rendered layout (catalog already hides them)
  const activeWidgets = layout.widgets.filter(
    (w) => !WIDGET_REGISTRY[w.type]?.comingSoon,
  );
  const layoutForRender = { ...layout, widgets: activeWidgets };
  const widgetTypes = activeWidgets.map((w) => w.type);

  // Fetch hero/shared data in parallel first
  const [
    heroStatsResult,
    moduleStatsResult,
    reportSummaryResult,
    calendarEventsResult,
    enrollmentCountResult,
    todayQueueResult,
  ] = await Promise.allSettled([
    getCachedDashboardHeroStats(profile.organization_id, profile.id),
    getCachedModuleStats(profile.organization_id),
    getReportSummary(profile.organization_id),
    getCalendarEvents(profile.organization_id),
    getOpenEnrollmentCount(profile.organization_id),
    buildTodayQueueItems(profile.id, profile.organization_id),
  ]);

  const heroStats = heroStatsResult.status === 'fulfilled'
    ? heroStatsResult.value
    : { todaysTaskCount: 0, overdueCount: 0, atRiskCount: 0, newThisWeek: 0 };

  const moduleStats = moduleStatsResult.status === 'fulfilled'
    ? moduleStatsResult.value
    : [];

  const reportSummary = reportSummaryResult.status === 'fulfilled'
    ? reportSummaryResult.value
    : null;

  const calendarEvents = calendarEventsResult.status === 'fulfilled'
    ? calendarEventsResult.value || []
    : [];

  const enrollmentCount =
    enrollmentCountResult.status === 'fulfilled' ? enrollmentCountResult.value : 0;

  const todayQueueItems =
    todayQueueResult.status === 'fulfilled' ? todayQueueResult.value : [];

  // Map calendar events to hero format
  const upcomingMeetings: HeroCalendarEvent[] = calendarEvents.slice(0, 3).map((event: { id: string; title: string; start_time: string; type?: string }) => ({
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    type: (event.type === 'call' ? 'call' : event.type === 'meeting' ? 'meeting' : 'task') as HeroCalendarEvent['type'],
  }));

  // Fetch widget-specific data (passes shared data to avoid duplicate DB calls)
  let widgetData: Record<string, unknown> = {};
  try {
    widgetData = await fetchWidgetData(profile, widgetTypes, {
      moduleStats,
      heroStats,
      reportSummary,
    });
  } catch (err) {
    console.error('[Dashboard] fetchWidgetData failed:', err);
  }

  return (
    <DashboardLayoutProvider initialLayout={layoutForRender}>
      <div className="space-y-4 pb-6">
        {/* Day-in-the-life home: search → journey → queue → pick-up → metrics */}
        <DashboardHero
          profile={profile}
          todaysTaskCount={heroStats.todaysTaskCount}
          overdueCount={heroStats.overdueCount}
          newThisWeek={heroStats.newThisWeek}
          atRiskCount={heroStats.atRiskCount}
          upcomingMeetings={upcomingMeetings}
          moduleStats={moduleStats}
          enrollmentCount={enrollmentCount}
          todayQueueItems={todayQueueItems}
        />

        {/* CRM Alerts — only renders when there are actionable items */}
        <CrmAlerts heroStats={heroStats} />

        {/* Below-fold customizable widgets */}
        <section aria-label="Dashboard widgets" className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Your dashboard
            </h2>
          </div>
          <DashboardToolbar />
          <DashboardGrid renderedWidgets={preRenderWidgets(activeWidgets, widgetData)} />
        </section>
      </div>
    </DashboardLayoutProvider>
  );
}

export default function CrmDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
