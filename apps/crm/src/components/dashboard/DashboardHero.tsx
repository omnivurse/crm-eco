'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Sun,
  AlertTriangle,
  TrendingUp,
  Flame,
  Target,
  Clock,

  Sparkles,
  UserPlus,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  Video,
  ChevronRight,
  Zap,
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
 * BentoCell - Glassmorphism cell for bento grid with entry animation
 */
function BentoCell({
  children,
  className = '',
  span = 1,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3;
  /** Animation delay in ms for staggered entry */
  delay?: number;
}) {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-1 md:col-span-2',
    3: 'col-span-1 md:col-span-3',
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/[0.04] backdrop-blur-xl
        border border-white/[0.06]
        hover:bg-white/[0.06] hover:border-white/[0.10]
        transition-all duration-300 ease-out
        group
        animate-fadeSlideUp
        opacity-0
        ${spanClasses[span]}
        ${className}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * QuickActionButton - Compact action button for hero
 */
function QuickActionButton({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: typeof UserPlus;
  label: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white',
    amber: 'bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white',
    violet: 'bg-violet-500/10 hover:bg-violet-500 text-violet-400 hover:text-white',
  };

  return (
    <Link
      href={href}
      className={`
        flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl
        ${colorClasses[color]}
        transition-all duration-200
        hover:scale-105 hover:shadow-lg
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
}

/**
 * MeetingItem - Single meeting preview
 */
function MeetingItem({ event, mounted }: { event: HeroCalendarEvent; mounted: boolean }) {
  // Format time only on client to avoid hydration mismatch
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
 * PipelineGauge - Circular progress indicator
 */
function PipelineGauge({ health }: { health: PipelineHealth }) {
  const { percent, status } = health;
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const statusColors = {
    healthy: { stroke: '#10b981', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    warning: { stroke: '#f59e0b', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    critical: { stroke: '#ef4444', bg: 'bg-red-500/20', text: 'text-red-400' },
  };

  const colors = statusColors[status];

  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${colors.text}`}>{percent}%</span>
        </div>
      </div>
      <p className="text-xs text-white/50 mt-2">Pipeline Health</p>
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
    <div className="p-4 h-full flex flex-col justify-center">
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
        {/* Animated shine effect */}
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
 * StatItem - Compact stat display for bento grid
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
  const colorClasses = {
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    red: 'bg-red-500/20 text-red-400',
    rose: 'bg-rose-500/20 text-rose-400',
  };

  return (
    <div className="flex items-center gap-3 p-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[10px] text-white/50">{label}</p>
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
    setDateInfo({ greeting, formattedDate });
    setMounted(true);
  }, []);

  const firstName = profile.full_name?.split(' ')[0] || 'there';

  // Generate AI insight and a matching link destination
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

  // Default pipeline health if not provided
  const displayPipelineHealth: PipelineHealth = pipelineHealth || {
    percent: atRiskCount > 3 ? 65 : atRiskCount > 0 ? 80 : 92,
    status: atRiskCount > 3 ? 'warning' : atRiskCount > 0 ? 'warning' : 'healthy',
    trend: 'stable',
  };

  // Default weekly goal if not provided
  const displayWeeklyGoal: WeeklyGoalProgress = weeklyGoal || {
    current: newThisWeek,
    target: 10,
    label: 'Weekly Goal',
  };

  // Today's meetings (max 3)
  const todaysMeetings = upcomingMeetings.slice(0, 3);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-800 p-6 shadow-xl shadow-black/10 ring-1 ring-white/[0.05]">
      {/* Subtle background accents */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-500/[0.07] to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-indigo-500/[0.04] to-transparent rounded-full blur-3xl" />
      </div>

      {/* Main Content - Bento Grid */}
      <div className="relative z-10">
        {/* Top Row: Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="animate-fadeSlideUp">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-sm border border-white/[0.06] hover:bg-white/[0.08] transition-colors cursor-default">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-white/70">CRM Online</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 hover:bg-blue-500/15 transition-colors cursor-default">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">Sales Hub</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {dateInfo.greeting}, {firstName}!
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <Clock className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/60">{mounted ? dateInfo.formattedDate : ''}</span>
          </div>
        </div>

        {/* AI Insight Banner */}
        {insightHref ? (
          <Link
            href={insightHref}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4 hover:border-white/[0.12] transition-all duration-300 cursor-pointer group animate-fadeSlideUp opacity-0"
            style={{ animationDelay: '50ms' }}
          >
            <div className="p-1.5 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/15 transition-colors">
              <Sparkles className="w-4 h-4 text-blue-400 group-hover:animate-pulse" />
            </div>
            <p className="text-sm text-white/80 flex-1">{displayInsight}</p>
            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ) : (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4 animate-fadeSlideUp opacity-0"
            style={{ animationDelay: '50ms' }}
          >
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-sm text-white/80 flex-1">{displayInsight}</p>
          </div>
        )}

        {/* Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Stats Row */}
          <BentoCell delay={100}>
            <StatItem icon={Sun} value={todaysTaskCount} label="Tasks Today" color="amber" />
          </BentoCell>

          {overdueCount > 0 ? (
            <BentoCell delay={150}>
              <StatItem icon={AlertTriangle} value={overdueCount} label="Overdue" color="red" />
            </BentoCell>
          ) : (
            <BentoCell delay={150}>
              <StatItem icon={TrendingUp} value={newThisWeek} label="New This Week" color="emerald" />
            </BentoCell>
          )}

          {atRiskCount > 0 && (
            <BentoCell delay={200}>
              <StatItem icon={Flame} value={atRiskCount} label="At Risk" color="rose" />
            </BentoCell>
          )}

          {overdueCount > 0 && (
            <BentoCell delay={200}>
              <StatItem icon={TrendingUp} value={newThisWeek} label="New This Week" color="emerald" />
            </BentoCell>
          )}

          {/* Quick Actions */}
          <BentoCell className="p-3" span={atRiskCount > 0 || overdueCount > 0 ? 1 : 2} delay={250}>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">Quick Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton href="/crm/modules/contacts/new" icon={UserPlus} label="Contact" color="blue" />
              <QuickActionButton href="/crm/modules/deals/new" icon={DollarSign} label="Deal" color="emerald" />
              <QuickActionButton href="/crm/activities?type=call" icon={Phone} label="Log Call" color="amber" />
              <QuickActionButton href="/crm/communications/new" icon={Mail} label="Email" color="violet" />
            </div>
          </BentoCell>

          {/* Pipeline Health Gauge */}
          <BentoCell delay={300}>
            <PipelineGauge health={displayPipelineHealth} />
          </BentoCell>

          {/* Today's Meetings */}
          <BentoCell className="p-3" delay={350}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">Today</span>
            </div>
            {todaysMeetings.length > 0 ? (
              <div className="space-y-0.5">
                {todaysMeetings.map((event) => (
                  <MeetingItem key={event.id} event={event} mounted={mounted} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-white/40">
                <Calendar className="w-6 h-6 mb-1 opacity-50" />
                <p className="text-[10px]">No meetings today</p>
              </div>
            )}
          </BentoCell>

          {/* Weekly Goal Progress */}
          <BentoCell span={2} delay={400}>
            <GoalProgressBar goal={displayWeeklyGoal} />
          </BentoCell>
        </div>
      </div>
    </div>
  );
}
