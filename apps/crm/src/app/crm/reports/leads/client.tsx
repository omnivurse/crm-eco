'use client';

import Link from 'next/link';
import {
  UserPlus,
  TrendingUp,
  TrendingDown,
  Target,
  ChevronLeft,
  Download,
  Globe,
  Mail,
  Phone,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface LeadData {
  id: string;
  title: string;
  status: string;
  data: {
    source?: string;
    lead_score?: number;
    email?: string;
    phone?: string;
    converted_at?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface LeadStats {
  totalLeads: number;
  newLeadsThisMonth: number;
  convertedLeads: number;
  conversionRate: number;
  avgLeadScore: number;
  avgTimeToConvert: number;
}

interface SourceData {
  source: string;
  count: number;
  converted: number;
  conversionRate: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
  color: string;
}

interface ScoreDistribution {
  range: string;
  count: number;
}

interface LeadsReportClientProps {
  leads: LeadData[];
  stats: LeadStats;
  sourceData: SourceData[];
  funnelStages: FunnelStage[];
  scoreDistribution: ScoreDistribution[];
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{change >= 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function SourcesChart({ data }: { data: SourceData[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const sourceIcons: Record<string, React.ElementType> = {
    web: Globe,
    email: Mail,
    phone: Phone,
    referral: Users,
    other: Target,
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Lead Sources</h3>
          <p className="text-sm text-slate-500">Performance by acquisition channel</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((source) => {
          const Icon = sourceIcons[source.source.toLowerCase()] || Target;
          return (
            <div key={source.source} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300 capitalize">{source.source || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500">{source.count} leads</span>
                  <span className="text-emerald-600 font-medium">{source.conversionRate}% conv.</span>
                </div>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all"
                  style={{ width: `${(source.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No lead source data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversionFunnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Conversion Funnel</h3>
          <p className="text-sm text-slate-500">Lead progression through stages</p>
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div key={stage.stage} className="relative">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{stage.stage}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all ${stage.color}`}
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
              </div>
              {index < stages.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreDistributionChart({ data }: { data: ScoreDistribution[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Lead Score Distribution</h3>
          <p className="text-sm text-slate-500">Quality breakdown by score range</p>
        </div>
      </div>

      <div className="h-48 flex items-end gap-2">
        {data.map((item) => (
          <div key={item.range} className="flex-1 flex flex-col items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">{item.count}</span>
            <div
              className="w-full bg-gradient-to-t from-teal-500 to-teal-400 rounded-t transition-all"
              style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: item.count > 0 ? '8px' : '0' }}
            />
            <span className="text-xs text-slate-500">{item.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentConversions({ leads }: { leads: LeadData[] }) {
  const convertedLeads = leads
    .filter(l => l.status?.toLowerCase() === 'converted' || l.data?.converted_at)
    .slice(0, 5);

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Conversions</h3>

      <div className="space-y-3">
        {convertedLeads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{lead.title}</p>
                <p className="text-sm text-slate-500 capitalize">{lead.data?.source || 'Unknown source'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-emerald-600">Converted</p>
              <p className="text-xs text-slate-500">
                {new Date(lead.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
        {convertedLeads.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent conversions</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

export function LeadsReportClient({
  leads,
  stats,
  sourceData,
  funnelStages,
  scoreDistribution,
}: LeadsReportClientProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/reports">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-lg">
                <UserPlus className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lead Analytics</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Source analysis and conversion metrics
            </p>
          </div>
        </div>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Leads" value={stats.totalLeads.toLocaleString()} icon={UserPlus} color="violet" />
        <StatCard label="New This Month" value={stats.newLeadsThisMonth} icon={TrendingUp} color="blue" />
        <StatCard label="Converted" value={stats.convertedLeads} icon={CheckCircle2} color="emerald" />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={Target} color="amber" />
        <StatCard label="Avg Lead Score" value={stats.avgLeadScore} icon={Target} color="teal" />
        <StatCard label="Avg Days to Convert" value={stats.avgTimeToConvert} icon={Clock} color="rose" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourcesChart data={sourceData} />
        <ConversionFunnel stages={funnelStages} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreDistributionChart data={scoreDistribution} />
        <RecentConversions leads={leads} />
      </div>
    </div>
  );
}
