'use client';

import { Buildings, Cigarette, FileMagnifyingGlass, Heart, ShieldCheck, UserMinus, Users, Warning } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
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
}

interface KpiCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

export function CrmKpiCards({ orgId }: { orgId: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Call the RPC directly via Supabase client
    const fetchStats = async () => {
      try {
        const { createClient } = await import('@crm-eco/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.rpc('get_crm_dashboard_stats' as any, {
          p_org_id: orgId,
        });
        setStats(data as DashboardStats);
      } catch (err) {
        console.error('Failed to fetch CRM stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [orgId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
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
      color: 'text-teal-700 bg-teal-50',
    },
    {
      label: 'HealthShare',
      value: stats.healthshare,
      icon: Heart,
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: 'Traditional Insurance',
      value: stats.traditional_insurance,
      icon: ShieldCheck,
      color: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'Tobacco Users',
      value: stats.tobacco_users,
      icon: Cigarette,
      color: 'text-amber-700 bg-amber-50',
      subtitle: `${stats.tobacco_unknown.toLocaleString()} unknown`,
    },
    {
      label: 'Needs Review',
      value: stats.needs_review,
      icon: FileMagnifyingGlass,
      color: stats.needs_review > 0
        ? 'text-orange-700 bg-orange-50'
        : 'text-slate-500 bg-slate-50',
    },
    {
      label: 'Needs Classification',
      value: stats.needs_classification,
      icon: Warning,
      color: stats.needs_classification > 0
        ? 'text-amber-700 bg-amber-50'
        : 'text-slate-500 bg-slate-50',
    },
    {
      label: 'Missing Carrier',
      value: stats.missing_carrier,
      icon: Buildings,
      color: 'text-slate-600 bg-slate-50',
    },
    {
      label: 'Unassigned Advisor',
      value: stats.unassigned_advisor,
      icon: UserMinus,
      color: stats.unassigned_advisor > 0
        ? 'text-red-700 bg-red-50'
        : 'text-slate-500 bg-slate-50',
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-teal-700">
          <Users weight="light" className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">CRM Member Overview</h3>
          <p className="text-sm text-slate-500">Key metrics across all CRM records</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {card.value.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
              {card.subtitle && (
                <p className="text-[10px] text-slate-400 mt-0.5">{card.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
