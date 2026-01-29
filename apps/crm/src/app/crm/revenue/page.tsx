'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  FileCheck,
  Receipt,
  Package,
  ChevronRight,
  ArrowUpRight,
  PieChart,
  BarChart3,
  Percent,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ============================================================================
// Type Definitions
// ============================================================================

interface RevenueModule {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  count: number;
  value?: number;
}

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface DealData {
  id: string;
  stage: string;
  data: { amount?: number } | null;
}

// Stage color mapping
const STAGE_COLORS: Record<string, string> = {
  'Qualification': 'bg-slate-500',
  'Discovery': 'bg-blue-500',
  'Proposal': 'bg-violet-500',
  'Negotiation': 'bg-amber-500',
  'Closed Won': 'bg-emerald-500',
  'Closed Lost': 'bg-red-500',
};

// ============================================================================
// Components
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function StatCard({
  label,
  value,
  trend,
  trendLabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{trend >= 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      {trendLabel && (
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{trendLabel}</div>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: RevenueModule }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <Link
      href={module.href}
      className="group glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-emerald-500/50 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[module.color]}`}>
          {module.icon}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
      </div>

      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {module.name}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {module.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {module.count} {module.count === 1 ? 'item' : 'items'}
        </span>
        {module.value !== undefined && (
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {formatCurrency(module.value)}
          </span>
        )}
      </div>
    </Link>
  );
}

function PipelineOverview({ stages }: { stages: PipelineStage[] }) {
  const totalValue = stages.reduce((sum, s) => sum + s.value, 0);
  const maxValue = stages.length > 0 ? Math.max(...stages.map(s => s.value)) : 1;

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Pipeline Overview</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total value: {formatCurrency(totalValue)}
          </p>
        </div>
        <Link href="/crm/pipeline" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
          View Pipeline
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">{stage.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{stage.count} deals</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatCurrency(stage.value)}
                </span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${stage.color} transition-all`}
                style={{ width: `${(stage.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function RevenuePage() {
  const [loading, setLoading] = useState(true);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [modules, setModules] = useState<RevenueModule[]>([]);
  const [stats, setStats] = useState({
    pipelineValue: 0,
    closedWonValue: 0,
    activeDeals: 0,
    winRate: 0,
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .single();

        if (!profile) return;

        // Get deals module
        const { data: dealsModule } = await supabase
          .from('crm_modules')
          .select('id')
          .eq('org_id', profile.organization_id)
          .eq('key', 'deals')
          .single();

        if (!dealsModule) {
          setLoading(false);
          return;
        }

        // Fetch deals with stage info
        const { data: dealsData } = await supabase
          .from('crm_records')
          .select('id, stage, data')
          .eq('module_id', dealsModule.id);

        const deals = (dealsData || []) as unknown as DealData[];

        // Group by stage
        const stageMap = new Map<string, { count: number; value: number }>();
        let totalPipelineValue = 0;
        let closedWonValue = 0;

        deals.forEach(deal => {
          const stage = deal.stage || 'Qualification';
          const amount = deal.data?.amount || 0;

          if (!stageMap.has(stage)) {
            stageMap.set(stage, { count: 0, value: 0 });
          }
          const stageData = stageMap.get(stage)!;
          stageData.count++;
          stageData.value += amount;

          if (stage !== 'Closed Won' && stage !== 'Closed Lost') {
            totalPipelineValue += amount;
          }
          if (stage === 'Closed Won') {
            closedWonValue += amount;
          }
        });

        // Convert to pipeline stages array
        const orderedStages = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Closed Won'];
        const stages: PipelineStage[] = orderedStages
          .filter(stageName => stageMap.has(stageName))
          .map(stageName => ({
            name: stageName,
            count: stageMap.get(stageName)!.count,
            value: stageMap.get(stageName)!.value,
            color: STAGE_COLORS[stageName] || 'bg-slate-500',
          }));

        setPipelineStages(stages);

        // Calculate win rate
        const closedDeals = deals.filter(d => d.stage === 'Closed Won' || d.stage === 'Closed Lost');
        const wonDeals = deals.filter(d => d.stage === 'Closed Won');
        const winRate = closedDeals.length > 0 ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;

        setStats({
          pipelineValue: totalPipelineValue,
          closedWonValue: closedWonValue,
          activeDeals: deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').length,
          winRate: winRate,
        });

        // Fetch products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', profile.organization_id);

        // Create revenue modules
        const revenueModules: RevenueModule[] = [
          {
            key: 'pipeline',
            name: 'Sales Pipeline',
            description: 'Manage your deal pipeline and stages',
            icon: <Target className="w-5 h-5" />,
            href: '/crm/pipeline',
            color: 'teal',
            count: deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost').length,
            value: totalPipelineValue,
          },
          {
            key: 'deals',
            name: 'Deals',
            description: 'Track opportunities and close deals',
            icon: <DollarSign className="w-5 h-5" />,
            href: '/crm/deals',
            color: 'emerald',
            count: deals.length,
            value: deals.reduce((sum, d) => sum + (d.data?.amount || 0), 0),
          },
          {
            key: 'quotes',
            name: 'Quotes',
            description: 'Create and send professional quotes',
            icon: <FileCheck className="w-5 h-5" />,
            href: '/crm/quotes',
            color: 'blue',
            count: 0,
            value: 0,
          },
          {
            key: 'invoices',
            name: 'Invoices',
            description: 'Generate and track invoices',
            icon: <Receipt className="w-5 h-5" />,
            href: '/crm/invoices',
            color: 'violet',
            count: 0,
            value: 0,
          },
          {
            key: 'products',
            name: 'Products',
            description: 'Manage your product catalog',
            icon: <Package className="w-5 h-5" />,
            href: '/crm/products',
            color: 'amber',
            count: productsCount || 0,
          },
          {
            key: 'commissions',
            name: 'Commissions',
            description: 'Track sales commissions and payouts',
            icon: <Percent className="w-5 h-5" />,
            href: '/crm/commissions',
            color: 'rose',
            count: 0,
            value: 0,
          },
        ];

        setModules(revenueModules);
      } catch (error) {
        console.error('Error loading revenue data:', error);
        toast.error('Failed to load revenue data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [supabase]);

  if (loading) {
    return <RevenueSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Revenue Command Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Track pipeline, deals, quotes, and invoices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/crm/reports">
            <Button variant="outline" size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              Reports
            </Button>
          </Link>
          <Link href="/crm/pipeline">
            <Button className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400">
              <Target className="w-4 h-4 mr-2" />
              View Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(stats.pipelineValue)}
          icon={Target}
          color="teal"
        />
        <StatCard
          label="Closed Won (MTD)"
          value={formatCurrency(stats.closedWonValue)}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          label="Active Deals"
          value={stats.activeDeals.toString()}
          icon={PieChart}
          color="blue"
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          icon={TrendingUp}
          color="violet"
        />
      </div>

      {/* Pipeline Overview & Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineOverview stages={pipelineStages} />

        {/* Quick Actions */}
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h3>

          <div className="space-y-2">
            <Link
              href="/crm/modules/deals/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Create Deal</div>
                <div className="text-xs text-slate-500">Add a new opportunity</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/quotes/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <FileCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Create Quote</div>
                <div className="text-xs text-slate-500">Generate a new quote</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/invoices/new"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <Receipt className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">Create Invoice</div>
                <div className="text-xs text-slate-500">Generate an invoice</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/crm/reports"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-white">View Reports</div>
                <div className="text-xs text-slate-500">Sales analytics & insights</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Revenue Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Revenue Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <ModuleCard key={module.key} module={module} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div>
          <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800/50 rounded" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800/50 rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="h-72 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        <div className="h-72 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
