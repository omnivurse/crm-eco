'use client';

import {
  HeartPulse,
  UserX,
  UserPlus,
  Clock,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  futureActive: number;
  futureInactive: number;
}

interface SummaryCardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
  onClick?: () => void;
  isSelected?: boolean;
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  onClick,
  isSelected,
}: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border transition-all duration-200
        ${
          isSelected
            ? 'border-slate-400 dark:border-slate-500 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] ring-2 ring-slate-300 dark:ring-slate-600'
            : 'border-slate-200/60 dark:border-slate-700/50 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_20px_25px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)]'
        }`}
    >
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      {/* Glow effect on hover */}
      <div
        className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient} blur-xl`}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {value.toLocaleString()}
            </p>
          </div>
          <div
            className={`p-3 rounded-xl ${gradient.replace(
              'bg-gradient-to-r',
              'bg-gradient-to-br'
            )} bg-opacity-10 backdrop-blur-sm`}
          >
            <div className="text-white">{icon}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
          <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </div>
    </button>
  );
}

interface MembersSummaryCardsProps {
  stats: MemberStats;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export function MembersSummaryCards({
  stats,
  activeFilter,
  onFilterChange,
}: MembersSummaryCardsProps) {
  const cards = [
    {
      key: 'active',
      title: 'Active Members',
      value: stats.active,
      subtitle: 'Currently active members',
      icon: <HeartPulse className="w-5 h-5" />,
      gradient: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    },
    {
      key: 'inactive',
      title: 'Inactive Members',
      value: stats.inactive,
      subtitle: 'Paused, inactive, or terminated',
      icon: <UserX className="w-5 h-5" />,
      gradient: 'bg-gradient-to-r from-rose-500 to-pink-400',
    },
    {
      key: 'futureActive',
      title: 'Future Active',
      value: stats.futureActive,
      subtitle: 'Pending or prospect members',
      icon: <UserPlus className="w-5 h-5" />,
      gradient: 'bg-gradient-to-r from-blue-500 to-indigo-400',
    },
    {
      key: 'futureInactive',
      title: 'Future Inactive',
      value: stats.futureInactive,
      subtitle: 'Termination within 90 days',
      icon: <Clock className="w-5 h-5" />,
      gradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card) => (
        <SummaryCard
          key={card.key}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          gradient={card.gradient}
          isSelected={activeFilter === card.key}
          onClick={() =>
            onFilterChange(activeFilter === card.key ? null : card.key)
          }
        />
      ))}
    </div>
  );
}
