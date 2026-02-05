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
  RefreshCw,
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
import { Button } from '@crm-eco/ui/components/button';
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
  onRefresh?: () => void;
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
        bg-white/[0.07] backdrop-blur-xl
        border border-white/10
        hover:bg-white/[0.10] hover:border-white/20
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
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      {/* Inner border glow effect */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[inset_0_0_20px_rgba(4,116,116,0.1)] pointer-events-none" />
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
  color: 'teal' | 'emerald' | 'amber' | 'violet';
}) {
  const colorClasses = {
    teal: 'bg-[#047474]/20 hover:bg-[#047474] text-[#069B9A] hover:text-white',
    emerald: 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white',
    amber: 'bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white',
    violet: 'bg-violet-500/20 hover:bg-violet-500 text-violet-400 hover:text-white',
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
      <div className="p-1.5 rounded-lg bg-[#047474]/20">
        <TypeIcon className="w-3.5 h-3.5 text-[#069B9A]" />
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
          <Trophy className={`w-4 h-4 ${isComplete ? 'text-[#E9B61F]' : 'text-white/50'}`} />
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
              ? 'bg-gradient-to-r from-[#E9B61F] to-amber-400'
              : 'bg-gradient-to-r from-[#047474] to-[#069B9A]'
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
        <p className="text-[10px] text-[#E9B61F] mt-1.5 flex items-center gap-1">
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
  onRefresh,
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

  // Generate AI insight if not provided
  const displayInsight = useMemo(() => {
    if (aiInsight) return aiInsight;
    
    const insights: string[] = [];
    if (atRiskCount > 0) insights.push(`${atRiskCount} deal${atRiskCount > 1 ? 's' : ''} need attention`);
    if (overdueCount > 0) insights.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
    if (todaysTaskCount > 0) insights.push(`${todaysTaskCount} task${todaysTaskCount > 1 ? 's' : ''} due today`);
    if (newThisWeek > 0) insights.push(`${newThisWeek} new record${newThisWeek > 1 ? 's' : ''} this week`);
    
    if (insights.length === 0) return "You're all caught up! Great job staying on top of things.";
    return `Focus on: ${insights.slice(0, 2).join(', ')}`;
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#003560] via-[#004a7c] to-[#047474] p-6 shadow-[0_20px_50px_-12px_rgba(0,53,96,0.4)]">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#047474]/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-[#E9B61F]/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.02]">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="heroGrid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="white" strokeWidth="0.2" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#heroGrid)" />
        </svg>
      </div>

      {/* Main Content - Bento Grid */}
      <div className="relative z-10">
        {/* Top Row: Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="animate-fadeSlideUp">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-colors cursor-default">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-white/80">CRM Online</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#047474]/30 backdrop-blur-sm border border-[#047474]/40 hover:bg-[#047474]/40 transition-colors cursor-default">
                <Target className="w-3.5 h-3.5 text-[#069B9A]" />
                <span className="text-xs font-medium text-[#069B9A]">Sales Hub</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {dateInfo.greeting}, {firstName}!
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white text-sm font-medium transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">{mounted ? dateInfo.formattedDate : ''}</span>
            </div>
          </div>
        </div>

        {/* AI Insight Banner */}
        <div 
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[#E9B61F]/10 to-[#047474]/10 border border-[#E9B61F]/20 mb-4 hover:border-[#E9B61F]/40 transition-all duration-300 cursor-pointer group animate-fadeSlideUp opacity-0"
          style={{ animationDelay: '50ms' }}
        >
          <div className="p-1.5 rounded-lg bg-[#E9B61F]/20 group-hover:bg-[#E9B61F]/30 transition-colors">
            <Sparkles className="w-4 h-4 text-[#E9B61F] group-hover:animate-pulse" />
          </div>
          <p className="text-sm text-white/80 flex-1">{displayInsight}</p>
          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
        </div>

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
              <Zap className="w-3.5 h-3.5 text-[#E9B61F]" />
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">Quick Actions</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton href="/crm/modules/contacts/new" icon={UserPlus} label="Contact" color="teal" />
              <QuickActionButton href="/crm/modules/deals/new" icon={DollarSign} label="Deal" color="emerald" />
              <QuickActionButton href="/crm/tasks/new?type=call" icon={Phone} label="Log Call" color="amber" />
              <QuickActionButton href="/crm/tasks/new?type=email" icon={Mail} label="Email" color="violet" />
            </div>
          </BentoCell>

          {/* Pipeline Health Gauge */}
          <BentoCell delay={300}>
            <PipelineGauge health={displayPipelineHealth} />
          </BentoCell>

          {/* Today's Meetings */}
          <BentoCell className="p-3" delay={350}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#069B9A]" />
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
