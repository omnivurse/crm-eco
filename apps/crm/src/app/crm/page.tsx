import { Suspense } from 'react';
import {
  getCurrentProfile,
  getCachedModuleStats,
  getUpcomingTasks,
  getRecentActivity,
  getCachedAtRiskDeals,
  getTodaysTasks,
  getCalendarEvents,
} from '@/lib/crm/queries';
import { loadDashboardLayout } from './dashboard-actions';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '@/lib/dashboard';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import {
  DashboardHero,
  DashboardStats,
  DashboardGrid,
  DashboardToolbar,
  DashboardSkeleton,
} from '@/components/dashboard';
import type { CrmTask } from '@/lib/crm/types';

interface AtRiskDeal {
  id: string;
  name: string;
  value: number;
  stage: string;
  daysInStage: number;
}

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
    // Placeholder fetchers for new widgets - will be implemented in Phase 6
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
        results[key] = await fetchers[key]();
      }
    })
  );

  return results;
}

async function DashboardContent() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  // Load user's saved layout or use default
  const savedLayout = await loadDashboardLayout();
  const layout = savedLayout || DEFAULT_LAYOUT;

  // Get widget types from layout to fetch only needed data
  const widgetTypes = layout.widgets.map((w) => w.type);

  // Fetch all required widget data in parallel - using cached versions for expensive queries
  const [stats, widgetData] = await Promise.all([
    getCachedModuleStats(profile.organization_id),
    fetchWidgetData(profile, widgetTypes),
  ]);

  const todaysTasks = (widgetData.todaysTasks as CrmTask[]) || [];
  const atRiskDeals = (widgetData.atRiskDeals as AtRiskDeal[]) || [];
  const newThisWeek = stats.reduce((sum, s) => sum + s.createdThisWeek, 0);

  return (
    <DashboardLayoutProvider initialLayout={layout}>
      <div className="space-y-8 pb-8">
        {/* Hero Header - Fixed, not customizable */}
        <DashboardHero
          profile={profile}
          todaysTaskCount={todaysTasks.length}
          overdueCount={
            todaysTasks.filter(
              (t) => t.due_at && new Date(t.due_at) < new Date()
            ).length
          }
          newThisWeek={newThisWeek}
          atRiskCount={atRiskDeals.length}
        />

        {/* Stats Grid - Fixed, not customizable */}
        <DashboardStats stats={stats} />

        {/* Dashboard Toolbar - Edit mode toggle, Add Widget, Save/Reset */}
        <DashboardToolbar />

        {/* Customizable Widget Grid */}
        <DashboardGrid widgetData={widgetData} />
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
