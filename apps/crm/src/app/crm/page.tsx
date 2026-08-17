import { Suspense } from 'react';
import {
  getCachedCurrentProfile,
  getCachedDashboardHeroStats,
  getCachedAtRiskDeals,
  getCachedModuleStats,
  getReportSummary,
  getUpcomingTasks,
  getRecentActivity,
  getTodaysTasks,
  getCalendarEvents,
  getAdvisorContactSummary,
} from '@/lib/crm/queries';
import { loadDashboardLayout } from './dashboard-actions';
import { WIDGET_REGISTRY } from '@/lib/dashboard';
import { resolveDefaultDashboardLayout } from '@/lib/dashboard/role-default-layout';
import { biasLayoutWidgetOrder } from '@/lib/crm/habits/score';
import { parseHabitsProfile } from '@/lib/crm/habits/types';
import { HabitForYouCard } from '@/components/crm/habits/HabitForYouCard';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import { CommandDesk } from '@/components/dashboard/command-desk/CommandDesk';
import { buildPeopleQueue } from '@/lib/dashboard/people-queue';
import type { PeopleQueue } from '@/lib/dashboard/people-queue-types';
import {
  CrmAlerts,
  DashboardToolbar,
  DashboardSkeleton,
} from '@/components/dashboard';
import { preRenderWidgets } from '@/components/dashboard/ServerWidgetRenderer';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';

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

function DashboardUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{detail}</p>
      </div>
    </div>
  );
}

function DeskSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-28 animate-pulse rounded-lg border border-border bg-muted" />
      <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
    </div>
  );
}

function WidgetsSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

async function CommandDeskBlock({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getCachedCurrentProfile>>>;
}) {
  const [heroStatsResult, peopleQueueResult] = await Promise.allSettled([
    getCachedDashboardHeroStats(profile.organization_id, profile.id),
    buildPeopleQueue(profile, { limit: 12, recentLimit: 6 }),
  ]);

  const heroStats = heroStatsResult.status === 'fulfilled'
    ? heroStatsResult.value
    : { todaysTaskCount: 0, overdueCount: 0, atRiskCount: 0, newThisWeek: 0 };

  let peopleQueue: PeopleQueue;
  if (peopleQueueResult.status === 'fulfilled') {
    peopleQueue = peopleQueueResult.value;
  } else {
    console.error('[Dashboard] buildPeopleQueue failed:', peopleQueueResult.reason);
    peopleQueue = {
      items: [],
      counts: {
        tasksToday: heroStats.todaysTaskCount,
        overdue: heroStats.overdueCount,
        pending: 0,
        startingSoon: 0,
      },
      recentlyViewed: [],
      degraded: true,
    };
  }

  return (
    <>
      <CommandDesk profile={profile} queue={peopleQueue} />
      <CrmAlerts heroStats={heroStats} />
    </>
  );
}

async function WidgetsBlock({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getCachedCurrentProfile>>>;
}) {
  let layout = resolveDefaultDashboardLayout(profile.crm_role);
  let usedSavedLayout = false;
  try {
    const savedLayout = await loadDashboardLayout();
    if (savedLayout) {
      layout = savedLayout;
      usedSavedLayout = true;
    }
  } catch (err) {
    console.error('[Dashboard] Failed to load layout, using role default:', err);
  }
  if (!usedSavedLayout) {
    const habits = parseHabitsProfile(profile.ui_preferences?.habits);
    if (habits) {
      layout = {
        ...layout,
        widgets: biasLayoutWidgetOrder(layout.widgets, habits),
      };
    }
  }

  const activeWidgets = layout.widgets.filter(
    (w) => !WIDGET_REGISTRY[w.type]?.comingSoon,
  );
  const layoutForRender = { ...layout, widgets: activeWidgets };
  const widgetTypes = activeWidgets.map((w) => w.type);

  const [heroStatsResult, moduleStatsResult, reportSummaryResult] = await Promise.allSettled([
    getCachedDashboardHeroStats(profile.organization_id, profile.id),
    getCachedModuleStats(profile.organization_id),
    getReportSummary(profile.organization_id),
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
      <HabitForYouCard />
      <section aria-label="Dashboard widgets" className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your dashboard
          </h2>
        </div>
        <DashboardToolbar />
        <DashboardGrid renderedWidgets={preRenderWidgets(activeWidgets, widgetData)} />
      </section>
    </DashboardLayoutProvider>
  );
}

async function DashboardContent() {
  let profile;
  try {
    profile = await getCachedCurrentProfile();
  } catch (err) {
    console.error('[Dashboard] Failed to get profile:', err);
    return (
      <DashboardUnavailable
        title="Unable to load dashboard"
        detail="Please sign in to access the CRM."
      />
    );
  }
  if (!profile) {
    return (
      <DashboardUnavailable
        title="Profile not found"
        detail="Please complete your profile setup."
      />
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <Suspense fallback={<DeskSkeleton />}>
        <CommandDeskBlock profile={profile} />
      </Suspense>
      <Suspense fallback={<WidgetsSkeleton />}>
        <WidgetsBlock profile={profile} />
      </Suspense>
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
