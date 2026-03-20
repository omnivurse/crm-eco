'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Heart,
  Shield,
  AlertTriangle,
  Cigarette,
  Building2,
  UserX,
  FileSearch,
} from 'lucide-react';

interface DashboardStats {
  total_records: number;
  total_individual: number;
  total_group: number;
  healthshare: number;
  traditional_insurance: number;
  unknown_plan_type: number;
  tobacco_users: number;
  tobacco_unknown: number;
  needs_review: number;
  needs_classification: number;
  missing_carrier: number;
  unassigned_advisor: number;
  with_advisor: number;
  created_last_7d: number;
  updated_last_7d: number;
}

interface KpiCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href?: string;
  subtitle?: string;
}

export default function MemberKpiWidget() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/dashboard')
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards: KpiCard[] = [
    {
      label: 'Total Members',
      value: stats.total_individual,
      icon: Users,
      color: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-500/10',
      href: '/crm/modules/contacts',
    },
    {
      label: 'HealthShare',
      value: stats.healthshare,
      icon: Heart,
      color:
        'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10',
      href: '/crm/modules/contacts?market_type=healthshare',
    },
    {
      label: 'Traditional Insurance',
      value: stats.traditional_insurance,
      icon: Shield,
      color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10',
      href: '/crm/modules/contacts?market_type=traditional_insurance',
    },
    {
      label: 'Tobacco Users',
      value: stats.tobacco_users,
      icon: Cigarette,
      color:
        'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10',
      subtitle: `${stats.tobacco_unknown.toLocaleString()} unknown`,
    },
    {
      label: 'Needs Review',
      value: stats.needs_review,
      icon: FileSearch,
      color:
        stats.needs_review > 0
          ? 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/10'
          : 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10',
    },
    {
      label: 'Needs Classification',
      value: stats.needs_classification,
      icon: AlertTriangle,
      color:
        stats.needs_classification > 0
          ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10'
          : 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10',
    },
    {
      label: 'Missing Carrier',
      value: stats.missing_carrier,
      icon: Building2,
      color:
        'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10',
    },
    {
      label: 'Unassigned Advisor',
      value: stats.unassigned_advisor,
      icon: UserX,
      color:
        stats.unassigned_advisor > 0
          ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10'
          : 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const content = (
          <div
            className="rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/30 p-4 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-2">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              {card.value > 0 && (
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  View
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {card.value.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {card.label}
            </p>
            {card.subtitle && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {card.subtitle}
              </p>
            )}
          </div>
        );

        return card.href ? (
          <Link key={card.label} href={card.href}>
            {content}
          </Link>
        ) : (
          <div key={card.label}>{content}</div>
        );
      })}
    </div>
  );
}
