import { Suspense } from 'react';
import {
  getCurrentProfile,
  getCachedModuleStats,
  getCachedCommandConsoleStats,
  getUpcomingTasks,
  getRecentActivity,
  getCachedAtRiskDeals,
  getTodaysTasks,
  getCalendarEvents,
  getOrganization,
} from '@/lib/crm/queries';
import type { CommandConsoleStats } from '@/lib/crm/queries';
import { loadDashboardLayout } from './dashboard-actions';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '@/lib/dashboard';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import {
  CommandBar,
  AlertsStrip,
  OperationalTiles,
  WorkQueue,
  EnrollmentFunnel,
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

/** Default empty stats when the command console RPC fails */
const EMPTY_CONSOLE_STATS: CommandConsoleStats = {
  enrollmentStats: {
    startedToday: 0, submittedToday: 0, activatedToday: 0,
    pendingUnderwriting: 0, docsRequired: 0, activationDelayed: 0,
    rejectedCount: 0, expiringSoon: 0, totalDraft: 0,
  },
  billingStats: {
    collectedToday: 0, mrr: 0, failedToday: 0,
    pendingAch: 0, lastSuccessfulPaymentAt: null,
  },
  pipelineCounts: {
    leads: 0, draft: 0, inProgress: 0, submitted: 0,
    approved: 0, rejected: 0, cancelled: 0,
  },
  operationsStats: { overdueTasks: 0, atRiskDeals: 0 },
  workQueue: [],
};

async function DashboardContent() {
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[Dashboard] Failed to get profile:', err);
    return null;
  }
  if (!profile) return null;

  // Load user's saved layout or use default
  let layout = DEFAULT_LAYOUT;
  try {
    const savedLayout = await loadDashboardLayout();
    if (savedLayout) layout = savedLayout;
  } catch (err) {
    console.error('[Dashboard] Failed to load layout, using default:', err);
  }

  const widgetTypes = layout.widgets.map((w) => w.type);

  // Fetch all data in parallel: command console stats, org info, widget data
  let consoleStats: CommandConsoleStats = EMPTY_CONSOLE_STATS;
  let orgName = 'Operations';
  let widgetData: Record<string, unknown> = {};

  const [consoleResult, orgResult, widgetDataResult] = await Promise.allSettled([
    getCachedCommandConsoleStats(profile.organization_id, profile.id),
    getOrganization(profile.organization_id),
    fetchWidgetData(profile, widgetTypes),
  ]);

  if (consoleResult.status === 'fulfilled') consoleStats = consoleResult.value;
  else console.error('[Dashboard] Console stats fetch failed:', consoleResult.reason);

  if (orgResult.status === 'fulfilled' && orgResult.value) orgName = orgResult.value.name;
  else console.error('[Dashboard] Org fetch failed:', orgResult.status === 'rejected' ? orgResult.reason : 'null');

  if (widgetDataResult.status === 'fulfilled') widgetData = widgetDataResult.value;
  else console.error('[Dashboard] Widget data fetch failed:', widgetDataResult.reason);

  return (
    <DashboardLayoutProvider initialLayout={layout}>
      <div className="space-y-5 pb-8">
        {/* ── Layer 1: Command Bar ── */}
        <CommandBar
          profile={profile}
          orgName={orgName}
          stats={consoleStats}
        />

        {/* ── Layer 2: Critical Alerts Strip (hidden when clean) ── */}
        <AlertsStrip stats={consoleStats} />

        {/* ── Layer 3: Operational Tiles ── */}
        <OperationalTiles stats={consoleStats} />

        {/* ── Work Queue ── */}
        <WorkQueue items={consoleStats.workQueue} />

        {/* ── Enrollment Pipeline Funnel ── */}
        <EnrollmentFunnel stats={consoleStats} />

        {/* ── Dashboard Toolbar ── */}
        <DashboardToolbar />

        {/* ── Customizable Widget Grid (preserved) ── */}
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
