// #region agent log
import * as _dbgFs from 'fs';
const _dbgLog = (d: Record<string, unknown>) => { try { _dbgFs.appendFileSync('c:\\Users\\User\\Documents\\GitHub\\crm-eco\\.cursor\\debug.log', JSON.stringify({...d,timestamp:Date.now()})+'\n'); } catch {} };
// #endregion
import { Suspense } from 'react';
import {
  getCurrentProfile,
  getCachedModuleStats,
  getCachedDashboardHeroStats,
  getUpcomingTasks,
  getRecentActivity,
  getCachedAtRiskDeals,
  getTodaysTasks,
  getCalendarEvents,
} from '@/lib/crm/queries';
import type { CalendarEvent, DashboardHeroStats } from '@/lib/crm/queries';
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
  // #region agent log
  _dbgLog({location:'page.tsx:DashboardContent',message:'DashboardContent started',hypothesisId:'H1'});
  // #endregion
  let profile;
  try {
    profile = await getCurrentProfile();
    // #region agent log
    _dbgLog({location:'page.tsx:getCurrentProfile',message:'getCurrentProfile result',data:{hasProfile:!!profile,profileId:profile?.id},hypothesisId:'H1'});
    // #endregion
  } catch (err) {
    // #region agent log
    _dbgLog({location:'page.tsx:getCurrentProfile:catch',message:'getCurrentProfile threw',data:{error:String(err)},hypothesisId:'H1'});
    // #endregion
    console.error('[Dashboard] Failed to get profile:', err);
    return null;
  }
  if (!profile) return null;

  // Load user's saved layout or use default
  let layout = DEFAULT_LAYOUT;
  try {
    const savedLayout = await loadDashboardLayout();
    if (savedLayout) layout = savedLayout;
    // #region agent log
    _dbgLog({location:'page.tsx:loadDashboardLayout',message:'Layout loaded',data:{hasLayout:!!savedLayout,widgetCount:layout.widgets?.length},hypothesisId:'H3'});
    // #endregion
  } catch (err) {
    // #region agent log
    _dbgLog({location:'page.tsx:loadDashboardLayout:catch',message:'loadDashboardLayout threw',data:{error:String(err)},hypothesisId:'H3'});
    // #endregion
    console.error('[Dashboard] Failed to load layout, using default:', err);
  }

  // Get widget types from layout to fetch only needed data
  const widgetTypes = layout.widgets.map((w) => w.type);

  // Fetch all required data in parallel - using cached RPC for hero stats
  // Each fetch is wrapped individually so one failure doesn't crash the page
  let stats: Awaited<ReturnType<typeof getCachedModuleStats>> = [];
  let heroStats: DashboardHeroStats = { todaysTaskCount: 0, overdueCount: 0, atRiskCount: 0, newThisWeek: 0 };
  let widgetData: Record<string, unknown> = {};

  const [statsResult, heroResult, widgetDataResult] = await Promise.allSettled([
    getCachedModuleStats(profile.organization_id),
    getCachedDashboardHeroStats(profile.organization_id, profile.id),
    fetchWidgetData(profile, widgetTypes),
  ]);

  if (statsResult.status === 'fulfilled') stats = statsResult.value;
  else console.error('[Dashboard] Stats fetch failed:', statsResult.reason);

  if (heroResult.status === 'fulfilled') heroStats = heroResult.value;
  else console.error('[Dashboard] Hero stats fetch failed:', heroResult.reason);

  if (widgetDataResult.status === 'fulfilled') widgetData = widgetDataResult.value;
  else console.error('[Dashboard] Widget data fetch failed:', widgetDataResult.reason);

  // #region agent log
  _dbgLog({location:'page.tsx:allSettled',message:'Data fetch results',data:{statsOk:statsResult.status==='fulfilled',heroOk:heroResult.status==='fulfilled',widgetOk:widgetDataResult.status==='fulfilled',statsErr:statsResult.status==='rejected'?String(statsResult.reason):'',heroErr:heroResult.status==='rejected'?String(heroResult.reason):'',widgetErr:widgetDataResult.status==='rejected'?String(widgetDataResult.reason):''},hypothesisId:'H2'});
  // #endregion

  const totalDeals = stats.find((s) => s.moduleKey === 'deals')?.totalRecords || 0;

  // Use calendar events from widget data (fetched once for 14-day range), filter to today for hero
  const allCalendarEvents = (widgetData.calendarEvents as CalendarEvent[]) || [];
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayCalendarEvents = allCalendarEvents.filter(
    (e) => new Date(e.start_time) <= todayEnd
  );

  // Transform calendar events for hero display
  const upcomingMeetings: HeroCalendarEvent[] = todayCalendarEvents.map((event: CalendarEvent) => ({
    id: event.id,
    title: event.title,
    start_time: event.start_time,
    type: event.type,
    location: event.location,
  }));

  // Calculate pipeline health based on at-risk deals ratio
  const pipelineHealth: PipelineHealth = {
    percent: totalDeals > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (heroStats.atRiskCount / Math.max(totalDeals, 1)) * 100)))
      : 100,
    status: heroStats.atRiskCount > 3 ? 'critical' : heroStats.atRiskCount > 0 ? 'warning' : 'healthy',
    trend: 'stable',
  };

  // Weekly goal based on new records this week (target: 10 new records)
  const weeklyGoal: WeeklyGoalProgress = {
    current: heroStats.newThisWeek,
    target: 10,
    label: 'Weekly Records Goal',
  };

  // #region agent log
  let renderedWidgets;
  try {
    renderedWidgets = preRenderWidgets(layout.widgets, widgetData);
    _dbgLog({location:'page.tsx:preRenderWidgets',message:'preRenderWidgets ok',data:{count:Object.keys(renderedWidgets||{}).length},hypothesisId:'H4'});
  } catch (err) {
    _dbgLog({location:'page.tsx:preRenderWidgets:catch',message:'preRenderWidgets threw',data:{error:String(err),stack:(err as Error)?.stack?.slice(0,500)},hypothesisId:'H4'});
    renderedWidgets = {};
  }
  // #endregion

  return (
    <DashboardLayoutProvider initialLayout={layout}>
      <div className="space-y-8 pb-8">
        {/* Hero Header - Fixed, not customizable */}
        <DashboardHero
          profile={profile}
          todaysTaskCount={heroStats.todaysTaskCount}
          overdueCount={heroStats.overdueCount}
          newThisWeek={heroStats.newThisWeek}
          atRiskCount={heroStats.atRiskCount}
          upcomingMeetings={upcomingMeetings}
          pipelineHealth={pipelineHealth}
          weeklyGoal={weeklyGoal}
        />

        {/* Stats Grid - Fixed, not customizable */}
        <DashboardStats stats={stats} />

        {/* Dashboard Toolbar - Edit mode toggle, Add Widget, Save/Reset */}
        <DashboardToolbar />

        {/* Customizable Widget Grid - widgets pre-rendered on server */}
        <DashboardGrid renderedWidgets={renderedWidgets} />
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
