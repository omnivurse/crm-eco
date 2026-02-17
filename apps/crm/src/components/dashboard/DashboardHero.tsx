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
  UserPlus,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  Video,
  ChevronRight,
  Trophy,
} from 'lucide-react';

import type { CrmProfile } from '@/lib/crm/types';
import type { CalendarEvent } from '@/lib/crm/queries';

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
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * GlassCard - Refined glass card wrapper with entry animation
 */
function GlassCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/[0.07] backdrop-blur-xl
        border border-white/[0.10]
        hover:bg-white/[0.10] hover:border-white/[0.15]
        transition-all duration-300 ease-out
        group
        animate-fadeSlideUp
        opacity-0
        ${className}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * QuickActionButton - Horizontal pill-style action button
 */
function QuickActionButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof UserPlus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 text-xs font-medium whitespace-nowrap"
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </Link>
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
      <div className="p-1.5 rounded-lg bg-blue-500/10">
        <TypeIcon className="w-3.5 h-3.5 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{event.title}</p>
        <p className="text-[10px] text-white/50">{time}</p>
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
    healthy: { bar: 'from-emerald-500 to-emerald-400', text: 'text-emerald-400' },
    warning: { bar: 'from-amber-500 to-amber-400', text: 'text-amber-400' },
    critical: { bar: 'from-red-500 to-red-400', text: 'text-red-400' },
  };

  const colors = statusColors[status];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white/50" />
          <span className="text-xs font-medium text-white/80">Pipeline Health</span>
        </div>
        <span className={`text-xs font-semibold ${colors.text}`}>{percent}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
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
          <Trophy className={`w-4 h-4 ${isComplete ? 'text-amber-400' : 'text-white/50'}`} />
          <span className="text-xs font-medium text-white/80">{goal.label}</span>
        </div>
        <span className="text-xs text-white/50">
          {goal.current}/{goal.target}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
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
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer"
          style={{ animationDelay: '1s' }}
        />
      </div>
      {isComplete && (
        <p className="text-[10px] text-amber-400 mt-1.5 flex items-center gap-1">
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
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    rose: 'text-rose-400',
  };

  return (
    <div className="flex flex-col items-center justify-center py-5 text-center">
      <p className="text-3xl font-bold text-white">{value}</p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Icon className={`w-3.5 h-3.5 ${iconColorClasses[color]}`} />
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </div>
  );
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
      if (!href) href = '/crm/activities?filter=overdue';
    }
    if (todaysTaskCount > 0) {
      insights.push(`${todaysTaskCount} task${todaysTaskCount > 1 ? 's' : ''} due today`);
      if (!href) href = '/crm/activities';
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-6 md:p-8 shadow-lg shadow-[#003560]/20 ring-1 ring-white/10">

      <div className="relative z-10">
        {/* ── Zone A: Header ── */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div className="animate-fadeSlideUp">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              {dateInfo.greeting}, {firstName}!
            </h1>
            <p className="text-sm text-white/40 mt-1.5">
              {mounted ? dateInfo.formattedDate : ''}
            </p>
          </div>

          {/* Quick Actions - 2x2 pill grid */}
          <div
            className="grid grid-cols-2 gap-2 animate-fadeSlideUp opacity-0"
            style={{ animationDelay: '50ms' }}
          >
            <QuickActionButton href="/crm/modules/contacts/new" icon={UserPlus} label="Contact" />
            <QuickActionButton href="/crm/modules/deals/new" icon={DollarSign} label="Deal" />
            <QuickActionButton href="/crm/activities?type=call" icon={Phone} label="Log Call" />
            <QuickActionButton href="/crm/communications/new" icon={Mail} label="Email" />
          </div>
        </div>

        {/* ── AI Insight Banner ── */}
        {insightHref ? (
          <Link
            href={insightHref}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.07] border border-white/[0.10] mb-5 hover:border-white/[0.18] transition-all duration-300 cursor-pointer group animate-fadeSlideUp opacity-0"
            style={{ animationDelay: '100ms' }}
          >
            <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
              <Sparkles className="w-4 h-4 text-blue-400 group-hover:animate-pulse" />
            </div>
            <p className="text-sm text-white/80 flex-1">{displayInsight}</p>
            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ) : (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.07] border border-white/[0.10] mb-5 animate-fadeSlideUp opacity-0"
            style={{ animationDelay: '100ms' }}
          >
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-sm text-white/80 flex-1">{displayInsight}</p>
          </div>
        )}

        {/* ── Zone B: Metrics Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <GlassCard delay={150}>
            <StatItem icon={Sun} value={todaysTaskCount} label="Tasks Today" color="amber" />
          </GlassCard>
          <GlassCard delay={200}>
            <StatItem icon={AlertTriangle} value={overdueCount} label="Overdue" color="red" />
          </GlassCard>
          <GlassCard delay={250}>
            <StatItem icon={TrendingUp} value={newThisWeek} label="New This Week" color="emerald" />
          </GlassCard>
          <GlassCard delay={300}>
            <StatItem icon={Flame} value={atRiskCount} label="At Risk" color="rose" />
          </GlassCard>
        </div>

        {/* ── Zone C: Context Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Pipeline Health + Weekly Goal */}
          <GlassCard className="p-5" delay={350}>
            <PipelineBar health={displayPipelineHealth} />
            <div className="border-t border-white/[0.10] my-4" />
            <GoalProgressBar goal={displayWeeklyGoal} />
          </GlassCard>

          {/* Right: Today's Schedule */}
          <GlassCard className="p-5" delay={400}>
            <div className="flex items-center gap-1.5 mb-3">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Today&apos;s Schedule</span>
            </div>
            {todaysMeetings.length > 0 ? (
              <div className="space-y-0.5">
                {todaysMeetings.map((event) => (
                  <MeetingItem key={event.id} event={event} mounted={mounted} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-white/40">
                <Calendar className="w-6 h-6 mb-1.5 opacity-50" />
                <p className="text-xs">No meetings today</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
