import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  getCurrentProfile,
  getCachedModuleStats,
  getUpcomingTasks,
  getRecentActivity,
  getCachedAtRiskDeals,
  getTodaysTasks,
  getCalendarEvents,
} from '@/lib/crm/queries';
import type { CalendarEvent } from '@/lib/crm/queries';
import { loadDashboardLayout } from './dashboard-actions';
import { DEFAULT_LAYOUT, WIDGET_REGISTRY } from '@/lib/dashboard';
import { DashboardLayoutProvider } from '@/contexts/DashboardLayoutContext';
import {
  DashboardHero,
  DashboardStats,
  DashboardToolbar,
  DashboardSkeleton,
} from '@/components/dashboard';
import type { HeroCalendarEvent, PipelineHealth, WeeklyGoalProgress } from '@/components/dashboard/DashboardHero';
import { preRenderWidgets } from '@/components/dashboard/ServerWidgetRenderer';
import type { CrmTask } from '@/lib/crm/types';

// Lazy load DashboardGrid - contains @dnd-kit (~50KB)
const DashboardGrid = dynamic(
  () => import('@/components/dashboard/DashboardGrid').then((mod) => mod.DashboardGrid),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>
    ),
  }
);

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

  // Fetch each widget's data independently so one failure doesn't crash the dashboard
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

  // Get widget types from layout to fetch only needed data
  const widgetTypes = layout.widgets.map((w) => w.type);

  // Fetch all required widget data in parallel - using cached versions for expensive queries
  // Always fetch calendar events for the hero section
  // Each fetch is wrapped individually so one failure doesn't crash the page
  let stats: Awaited<ReturnType<typeof getCachedModuleStats>> = [];
  let widgetData: Record<string, unknown> = {};
  let calendarEvents: Awaited<ReturnType<typeof getCalendarEvents>> = [];

  const [statsResult, widgetDataResult, calendarResult] = await Promise.allSettled([
    getCachedModuleStats(profile.organization_id),
    fetchWidgetData(profile, widgetTypes),
    getCalendarEvents(profile.organization_id, 1), // Today's events only
  ]);

  if (statsResult.status === 'fulfilled') stats = statsResult.value;
  else console.error('[Dashboard] Stats fetch failed:', statsResult.reason);

  if (widgetDataResult.status === 'fulfilled') widgetData = widgetDataResult.value;
  else console.error('[Dashboard] Widget data fetch failed:', widgetDataResult.reason);

  if (calendarResult.status === 'fulfilled') calendarEvents = calendarResult.value;
  else console.error('[Dashboard] Calendar fetch failed:', calendarResult.reason);

  const todaysTasks = (widgetData.todaysTasks as CrmTask[]) || [];
  const atRiskDeals = (widgetData.atRiskDeals as AtRiskDeal[]) || [];
  const newThisWeek = stats.reduce((sum, s) => sum + s.createdThisWeek, 0);
  const totalDeals = stats.find((s) => s.moduleKey === 'deals')?.totalRecords || 0;

  // Transform calendar events for hero display
  const upcomingMeetings: HeroCalendarEvent[] = (calendarEvents || []).map((event: CalendarEvent) => ({
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    type: event.type,
    location: event.location,
  }));

  // Calculate pipeline health based on at-risk deals ratio
  const pipelineHealth: PipelineHealth = {
    percent: totalDeals > 0 
      ? Math.max(0, Math.min(100, Math.round(100 - (atRiskDeals.length / Math.max(totalDeals, 1)) * 100)))
      : 100,
    status: atRiskDeals.length > 3 ? 'critical' : atRiskDeals.length > 0 ? 'warning' : 'healthy',
    trend: 'stable',
  };

  // Weekly goal based on new records this week (target: 10 new records)
  const weeklyGoal: WeeklyGoalProgress = {
    current: newThisWeek,
    target: 10,
    label: 'Weekly Records Goal',
  };

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
          upcomingMeetings={upcomingMeetings}
          pipelineHealth={pipelineHealth}
          weeklyGoal={weeklyGoal}
        />

        {/* Stats Grid - Fixed, not customizable */}
        <DashboardStats stats={stats} />

        {/* Dashboard Toolbar - Edit mode toggle, Add Widget, Save/Reset */}
        <DashboardToolbar />

        {/* Customizable Widget Grid - widgets pre-rendered on server */}
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
