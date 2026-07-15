'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Sun,
  AlertTriangle,
  TrendingUp,
  Flame,
  Activity,
  Sparkles,
  Calendar,
  Video,
  ChevronRight,
  Trophy,
  Phone,
} from 'lucide-react';

import type { CrmProfile } from '@/lib/crm/types';
import type { ModuleStats } from '@/lib/crm/types';
import { CrmCommandBar } from '@/components/crm/shell/CrmCommandBar';
import { DashboardWorkflowChips } from '@/components/dashboard/DashboardWorkflowChips';
import { DashboardPickUpSection } from '@/components/dashboard/DashboardPickUpSection';
import {
  SalesJourneyStrip,
  type JourneyStageCounts,
} from '@/components/dashboard/SalesJourneyStrip';
import {
  TodayQueuePreview,
  type TodayQueueItem,
} from '@/components/dashboard/TodayQueuePreview';

/** Calendar event for display in hero section */
export interface HeroCalendarEvent {
  id: string;
  title: string;
  start_time: string;
  type: 'meeting' | 'call' | 'task' | 'reminder';
  location?: string;
}

/** Weekly goal progress tracking */
export interface WeeklyGoalProgress {
  current: number;
  target: number;
  label: string;
}

/** Pipeline health data */
export interface PipelineHealth {
  percent: number;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface DashboardHeroProps {
  profile: CrmProfile;
  todaysTaskCount: number;
  overdueCount: number;
  newThisWeek: number;
  atRiskCount: number;
  /** Upcoming meetings/calls for today */
  upcomingMeetings?: HeroCalendarEvent[];
  /** Pipeline health percentage (0-100) */
  pipelineHealth?: PipelineHealth;
  /** Weekly goal progress */
  weeklyGoal?: WeeklyGoalProgress;
  /** AI-generated insight summary */
  aiInsight?: string;
  /** Module stats for journey strip */
  moduleStats?: ModuleStats[];
  /** Active/open enrollment count for journey strip */
  enrollmentCount?: number;
  /** Compact today-queue preview items */
  todayQueueItems?: TodayQueueItem[];
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * HeroCard - Clean card wrapper.
 *
 * Intentionally NO entry animation: `opacity-0` + `animate-fadeSlideUp` was
 * restarting whenever the dashboard re-rendered/streamed widgets, which made
 * the whole hero look like it was shaking/jittering until the user navigated
 * away (or the tab lost focus during a screenshot). Static cards are stable.
 */
function HeroCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
  /** Kept for call-site compatibility; entry animation removed. */
  delay?: number;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg
        bg-white dark:bg-slate-800/60
        border border-slate-200/70 dark:border-white/10
        shadow-[0_1px_2px_rgba(0,0,0,0.04)]
        hover:shadow-[0_1px_4px_rgba(0,0,0,0.06)]
        transition-shadow duration-200
        group
        ${className}
      `}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * MeetingItem - Single meeting preview
 */
function MeetingItem({ event, mounted }: { event: HeroCalendarEvent; mounted: boolean }) {
  const time = mounted
    ? new Date(event.start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const TypeIcon = event.type === 'call' ? Phone : event.type === 'meeting' ? Video : Calendar;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10">
        <TypeIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 dark:text-white truncate">{event.title}</p>
        <p className="text-[10px] text-slate-400 dark:text-white/50">{time}</p>
      </div>
    </div>
  );
}

/**
 * PipelineBar - Horizontal progress bar for pipeline health
 */
function PipelineBar({ health }: { health: PipelineHealth }) {
  const { percent, status } = health;

  const statusColors = {
    healthy: { bar: 'from-emerald-500 to-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
    warning: { bar: 'from-amber-500 to-amber-400', text: 'text-amber-600 dark:text-amber-400' },
    critical: { bar: 'from-red-500 to-red-400', text: 'text-red-600 dark:text-red-400' },
  };

  const colors = statusColors[status];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400 dark:text-white/50" />
          <span className="text-xs font-medium text-slate-600 dark:text-white/80">Pipeline Health</span>
        </div>
        <span className={`text-xs font-semibold ${colors.text}`}>{percent}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-1000 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * GoalProgressBar - Horizontal progress toward weekly goals
 */
function GoalProgressBar({ goal }: { goal: WeeklyGoalProgress }) {
  const percent = Math.min((goal.current / goal.target) * 100, 100);
  const isComplete = goal.current >= goal.target;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className={`w-4 h-4 ${isComplete ? 'text-amber-500' : 'text-slate-400 dark:text-white/50'}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-white/80">{goal.label}</span>
        </div>
        <span className="text-xs text-slate-400 dark:text-white/50">
          {goal.current}/{goal.target}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            ${isComplete
              ? 'bg-gradient-to-r from-amber-500 to-amber-400'
              : 'bg-gradient-to-r from-blue-500 to-blue-400'
            }
            transition-all duration-1000 ease-out
          `}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isComplete && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Goal achieved!
        </p>
      )}
    </div>
  );
}

/**
 * StatItem - Vertical-centered stat with large number
 */
function StatItem({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Sun;
  value: number;
  label: string;
  color: 'amber' | 'emerald' | 'red' | 'rose';
}) {
  const iconColorClasses = {
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    rose: 'text-rose-500',
  };

  return (
    <div className="flex flex-col items-center justify-center py-3 text-center">
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        <Icon className={`w-3 h-3 ${iconColorClasses[color]}`} />
        <p className="text-[11px] text-slate-500 dark:text-white/50">{label}</p>
      </div>
    </div>
  );
}

function buildJourneyCounts(
  moduleStats: ModuleStats[] | undefined,
  enrollmentCount: number,
  atRiskCount: number,
): JourneyStageCounts {
  const byKey = (key: string) =>
    moduleStats?.find((s) => s.moduleKey === key)?.totalRecords ?? 0;
  return {
    leads: byKey('leads'),
    contacts: byKey('contacts'),
    deals: byKey('deals'),
    enrollments: enrollmentCount,
    atRiskDeals: atRiskCount,
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function DashboardHero({
  profile,
  todaysTaskCount,
  overdueCount,
  newThisWeek,
  atRiskCount,
  upcomingMeetings = [],
  pipelineHealth,
  weeklyGoal,
  aiInsight,
  moduleStats,
  enrollmentCount = 0,
  todayQueueItems = [],
}: DashboardHeroProps) {
  const [mounted, setMounted] = useState(false);
  const [dateInfo, setDateInfo] = useState({ greeting: 'Hello', formattedDate: '' });

  useEffect(() => {
    const currentHour = new Date().getHours();
    const greeting =
      currentHour < 12
        ? 'Good morning'
        : currentHour < 17
        ? 'Good afternoon'
        : 'Good evening';
    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    queueMicrotask(() => {
      setDateInfo({ greeting, formattedDate });
      setMounted(true);
    });
  }, []);

  const firstName = profile.full_name?.split(' ')[0] || 'there';

  const journeyCounts = useMemo(
    () => buildJourneyCounts(moduleStats, enrollmentCount, atRiskCount),
    [moduleStats, enrollmentCount, atRiskCount],
  );

  const { displayInsight, insightHref } = useMemo(() => {
    if (aiInsight) return { displayInsight: aiInsight, insightHref: null };

    const insights: string[] = [];
    let href: string | null = null;

    if (atRiskCount > 0) {
      insights.push(`${atRiskCount} deal${atRiskCount > 1 ? 's' : ''} need attention`);
      if (!href) href = '/crm/pipeline';
    }
    if (overdueCount > 0) {
      insights.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
      if (!href) href = '/crm/workqueue';
    }
    if (todaysTaskCount > 0) {
      insights.push(`${todaysTaskCount} task${todaysTaskCount > 1 ? 's' : ''} due today`);
      if (!href) href = '/crm/workqueue';
    }
    if (newThisWeek > 0) {
      insights.push(`${newThisWeek} new record${newThisWeek > 1 ? 's' : ''} this week`);
      if (!href) href = '/crm/modules/contacts';
    }

    if (insights.length === 0) {
      return {
        displayInsight: "You're all caught up! Great job staying on top of things.",
        insightHref: null,
      };
    }
    return {
      displayInsight: `Focus on: ${insights.slice(0, 2).join(', ')}`,
      insightHref: href,
    };
  }, [aiInsight, atRiskCount, overdueCount, todaysTaskCount, newThisWeek]);

  const displayPipelineHealth: PipelineHealth = pipelineHealth || {
    percent: atRiskCount > 3 ? 65 : atRiskCount > 0 ? 80 : 92,
    status: atRiskCount > 3 ? 'warning' : atRiskCount > 0 ? 'warning' : 'healthy',
    trend: 'stable',
  };

  const displayWeeklyGoal: WeeklyGoalProgress = weeklyGoal || {
    current: newThisWeek,
    target: 10,
    label: 'Weekly Goal',
  };

  const todaysMeetings = upcomingMeetings.slice(0, 3);

  return (
    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/10 p-4 md:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative z-10 space-y-4">
        {/* Zone A: Greeting + search-first command bar */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
              {dateInfo.greeting}, {firstName}!
            </h1>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">
              {mounted ? dateInfo.formattedDate : ''}
              <span className="hidden sm:inline">
                {mounted ? ' · ' : ''}What do you want to work on?
              </span>
            </p>
          </div>
          <CrmCommandBar
            size="hero"
            placeholder="Search people, deals, or start a workflow…"
            className="crm-motion-safe"
          />
        </div>

        {/* Zone B: Lead → Enroll journey */}
        <SalesJourneyStrip counts={journeyCounts} />

        {/* Zone C: Workflow chips + today queue + pick up */}
        <DashboardWorkflowChips
          crmRole={profile.crm_role}
          todaysTaskCount={todaysTaskCount}
          overdueCount={overdueCount}
          atRiskCount={atRiskCount}
        />

        <TodayQueuePreview
          items={todayQueueItems}
          overdueCount={overdueCount}
          todaysTaskCount={todaysTaskCount}
        />

        <DashboardPickUpSection />

        {/* Insight banner */}
        {insightHref ? (
          <Link
            href={insightHref}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.07] border border-slate-200/80 dark:border-white/[0.10] hover:border-teal-300 dark:hover:border-white/[0.18] transition-colors cursor-pointer group"
          >
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-blue-500/10 group-hover:bg-teal-100 dark:group-hover:bg-blue-500/15 transition-colors">
              <Sparkles className="w-4 h-4 text-teal-500 dark:text-blue-400" />
            </div>
            <p className="text-xs text-slate-600 dark:text-white/80 flex-1">{displayInsight}</p>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/40 group-hover:text-teal-500 dark:group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.07] border border-slate-200/80 dark:border-white/[0.10]">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-blue-500/10">
              <Sparkles className="w-4 h-4 text-teal-500 dark:text-blue-400" />
            </div>
            <p className="text-xs text-slate-600 dark:text-white/80 flex-1">{displayInsight}</p>
          </div>
        )}

        {/* Zone D: Metrics + context (secondary, below primary workflow) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <HeroCard delay={150}>
            <StatItem icon={Sun} value={todaysTaskCount} label="Tasks Today" color="amber" />
          </HeroCard>
          <HeroCard delay={200}>
            <StatItem icon={AlertTriangle} value={overdueCount} label="Overdue" color="red" />
          </HeroCard>
          <HeroCard delay={250}>
            <StatItem icon={TrendingUp} value={newThisWeek} label="New This Week" color="emerald" />
          </HeroCard>
          <HeroCard delay={300}>
            <StatItem icon={Flame} value={atRiskCount} label="At Risk" color="rose" />
          </HeroCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <HeroCard className="p-3.5" delay={350}>
            <PipelineBar health={displayPipelineHealth} />
            <div className="border-t border-slate-100 dark:border-white/[0.10] my-3" />
            <GoalProgressBar goal={displayWeeklyGoal} />
          </HeroCard>

          <HeroCard className="p-3.5" delay={400}>
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-white/60 uppercase tracking-wide">
                Today&apos;s Schedule
              </span>
            </div>
            {todaysMeetings.length > 0 ? (
              <div className="space-y-0.5">
                {todaysMeetings.map((event) => (
                  <MeetingItem key={event.id} event={event} mounted={mounted} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-white/40">
                <Calendar className="w-6 h-6 mb-1.5 opacity-50" />
                <p className="text-xs">No meetings today</p>
              </div>
            )}
          </HeroCard>
        </div>
      </div>
    </div>
  );
}
