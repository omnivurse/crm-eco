'use client';

import Link from 'next/link';
import { Trophy, ArrowRight, Medal } from 'lucide-react';
import { WidgetCard } from '../WidgetCard';
import { EmptyState } from './shared';
import type { WidgetSize } from '@/lib/dashboard/types';

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string;
  deals_closed: number;
  revenue: number;
  tasks_completed: number;
}

interface TeamLeaderboardData {
  members: TeamMember[];
  period: string;
  metric: 'deals' | 'revenue' | 'tasks';
}

interface TeamLeaderboardWidgetProps {
  data: TeamLeaderboardData | null;
  size: WidgetSize;
}

const sizeToDisplayCount: Record<WidgetSize, number> = {
  small: 3,
  medium: 5,
  large: 8,
  full: 10,
};

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const getMedalColor = (position: number) => {
  switch (position) {
    case 0:
      return 'text-yellow-500';
    case 1:
      return 'text-slate-400';
    case 2:
      return 'text-amber-600';
    default:
      return 'text-slate-300 dark:text-slate-600';
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function TeamLeaderboardWidget({
  data,
  size,
}: TeamLeaderboardWidgetProps) {
  const leaderboard = data || {
    members: [],
    period: 'This month',
    metric: 'deals' as const,
  };
  const displayCount = sizeToDisplayCount[size] || 5;

  const getValue = (member: TeamMember) => {
    switch (leaderboard.metric) {
      case 'revenue':
        return formatCurrency(member.revenue);
      case 'tasks':
        return `${member.tasks_completed} tasks`;
      default:
        return `${member.deals_closed} deals`;
    }
  };

  return (
    <WidgetCard
      title="Team Leaderboard"
      subtitle={leaderboard.period}
      icon={<Trophy className="w-5 h-5 text-white" />}
      gradient="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"
      footer={
        leaderboard.members.length > displayCount ? (
          <Link
            href="/crm/reports"
            className="inline-flex items-center gap-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
          >
            View full leaderboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {leaderboard.members.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-8 h-8 text-amber-600 dark:text-amber-400" />}
          title="No team data"
          subtitle="Team performance will appear here"
        />
      ) : (
        <div className="space-y-2">
          {leaderboard.members.slice(0, displayCount).map((member, index) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center justify-center w-6">
                {index < 3 ? (
                  <Medal className={`w-5 h-5 ${getMedalColor(index)}`} />
                ) : (
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </span>
                )}
              </div>
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {getInitials(member.name)}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {member.name}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {getValue(member)}
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
