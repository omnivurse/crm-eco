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
  // Habit bias only applies when there is no custom saved layout.
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
    peopleQueueResult,
  ] = await Promise.allSettled([
    getCachedDashboardHeroStats(profile.organization_id, profile.id),
    getCachedModuleStats(profile.organization_id),
    getReportSummary(profile.organization_id),
    buildPeopleQueue(profile, { limit: 12, recentLimit: 6 }),
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

  // Today queue of people (command desk). A rejected build degrades to an
  // empty-but-honest desk rather than failing the whole page.
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
        {/* Command desk: greeting + search → count chips → today queue of people + next-up rail */}
        <CommandDesk profile={profile} queue={peopleQueue} />

        {/* CRM Alerts — only renders when there are actionable items */}
        <CrmAlerts heroStats={heroStats} />

        {/* Habit coach tips (cached from nightly AI batch — 0 tokens on load) */}
        <HabitForYouCard />

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
