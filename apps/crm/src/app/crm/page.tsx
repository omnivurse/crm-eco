import { Suspense } from 'react';
import {
  getCurrentProfile,
  getCachedDashboardHeroStats,
  getCachedAtRiskDeals,
  getCachedModuleStats,
  getReportSummary,
  getMyTasks,
  getUpcomingTasks,
  getRecentActivity,
  getTodaysTasks,
  getCalendarEvents,
  getOrganization,
} from '@/lib/crm/queries';
import type { PersonalWorkItem } from '@/components/dashboard';
import { loadDashboardLayout } from './dashboard-actions';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '@/lib/dashboard';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import {
  CommandBar,
  DashboardStats,
  WorkQueue,
  CrmAlerts,
  SalesCommandTiles,
  DealPipelineFunnel,
  DashboardToolbar,
  DashboardSkeleton,
} from '@/components/dashboard';
import { preRenderWidgets } from '@/components/dashboard/ServerWidgetRenderer';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';

// Server-side data fetching based on widget types
async function fetchWidgetData(
  profile: { id: string; organization_id: string },
  widgetTypes: string[]
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

/**
 * Build personal work queue items from overdue tasks and at-risk deals.
 */
function buildPersonalWorkItems(
  overdueTasks: { id: string; title: string; due_at: string | null; created_at: string }[],
  atRiskDeals: { id: string; name: string; stage: string; daysInStage: number }[],
): PersonalWorkItem[] {
  const items: PersonalWorkItem[] = [];

  for (const deal of atRiskDeals.slice(0, 4)) {
    items.push({
      id: deal.id,
      type: 'at_risk_deal',
      title: deal.name,
      subtitle: `${deal.stage} · ${deal.daysInStage}d without update`,
      createdAt: new Date(Date.now() - deal.daysInStage * 86400000).toISOString(),
    });
  }

  for (const task of overdueTasks.slice(0, 4)) {
    items.push({
      id: task.id,
      type: 'overdue_task',
      title: task.title || 'Untitled Task',
      subtitle: task.due_at ? `Due ${new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'No due date',
      createdAt: task.due_at || task.created_at,
    });
  }

  return items;
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

  // Load user's saved layout or use default
  let layout = DEFAULT_LAYOUT;
  try {
    const savedLayout = await loadDashboardLayout();
    if (savedLayout) layout = savedLayout;
  } catch (err) {
    console.error('[Dashboard] Failed to load layout, using default:', err);
  }

  const widgetTypes = layout.widgets.map((w) => w.type);

  // Fetch all data in parallel: personal stats, org info, module stats, tasks, at-risk deals, report summary, widget data
  const [heroStatsResult, orgResult, moduleStatsResult, overdueTasksResult, atRiskDealsResult, reportSummaryResult, widgetDataResult] =
    await Promise.allSettled([
      getCachedDashboardHeroStats(profile.organization_id, profile.id),
      getOrganization(profile.organization_id),
      getCachedModuleStats(profile.organization_id),
      getMyTasks(profile.id, false, 50),
      getCachedAtRiskDeals(profile.organization_id, 5),
      getReportSummary(profile.organization_id),
      fetchWidgetData(profile, widgetTypes),
    ]);

  const heroStats = heroStatsResult.status === 'fulfilled'
    ? heroStatsResult.value
    : { todaysTaskCount: 0, overdueCount: 0, atRiskCount: 0, newThisWeek: 0 };

  const orgName = orgResult.status === 'fulfilled' && orgResult.value
    ? orgResult.value.name
    : 'Operations';

  const moduleStats = moduleStatsResult.status === 'fulfilled'
    ? moduleStatsResult.value
    : [];

  // Build personal work queue from overdue tasks and at-risk deals
  const overdueTasks = overdueTasksResult.status === 'fulfilled'
    ? (overdueTasksResult.value || []).filter((t) => t.due_at && new Date(t.due_at) < new Date())
    : [];

  const atRiskDeals = atRiskDealsResult.status === 'fulfilled'
    ? atRiskDealsResult.value || []
    : [];

  const personalItems = buildPersonalWorkItems(overdueTasks, atRiskDeals);

  const reportSummary = reportSummaryResult.status === 'fulfilled'
    ? reportSummaryResult.value
    : null;

  const widgetData = widgetDataResult.status === 'fulfilled'
    ? widgetDataResult.value
    : {};

  return (
    <DashboardLayoutProvider initialLayout={layout}>
      <div className="space-y-5 pb-8">
        {/* Personal Command Bar */}
        <CommandBar
          profile={profile}
          orgName={orgName}
          stats={heroStats}
        />

        {/* CRM Alerts -- overdue tasks, at-risk deals, tasks today */}
        <CrmAlerts heroStats={heroStats} />

        {/* Sales Command Tiles -- pipeline, leads, activity, relationships */}
        <SalesCommandTiles
          moduleStats={moduleStats}
          heroStats={heroStats}
          reportSummary={reportSummary}
        />

        {/* CRM Stats Cards -- Contacts, Leads, Deals, Accounts */}
        <DashboardStats stats={moduleStats} />

        {/* Deal Pipeline Funnel */}
        <DealPipelineFunnel
          moduleStats={moduleStats}
          reportSummary={reportSummary}
        />

        {/* Personal Work Queue */}
        <WorkQueue items={personalItems} />

        {/* Dashboard Toolbar */}
        <DashboardToolbar />

        {/* Customizable Widget Grid (preserved) */}
        <DashboardGrid renderedWidgets={preRenderWidgets(layout.widgets, widgetData)} />
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
