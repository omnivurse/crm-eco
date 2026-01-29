'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { toast } from 'sonner';

interface DashboardData {
  summary: {
    totalMembers: number;
    activeMembers: number;
    newMembersThisMonth: number;
    memberGrowthPct: number;
    mrr: number;
    totalLeads: number;
    activeLeads: number;
    conversionRate: number;
    pendingEnrollments: number;
    completedEnrollments: number;
    openNeeds: number;
    urgentNeeds: number;
    totalNeedsAmount: number;
    totalReimbursed: number;
    activeAdvisors: number;
    totalAdvisors: number;
  };
  pipeline: {
    newLeads: number;
    contacted: number;
    qualified: number;
    proposal: number;
    converted: number;
  };
  dailyActivity: Array<{
    date: string;
    members: number;
    leads: number;
    enrollments: number;
  }>;
  needsBreakdown: {
    open: number;
    urgent: number;
    atRisk: number;
    onTrack: number;
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: 'teal' | 'violet' | 'emerald' | 'amber' | 'blue' | 'red';
}) {
  const colorClasses = {
    teal: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    red: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  };
  const colors = colorClasses[color];

  return (
    <Card className="glass-card border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${
              trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> : null}
              {change !== 0 && <span>{change > 0 ? '+' : ''}{change}%</span>}
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniChart({ data, height = 60 }: { data: number[]; height?: number }) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((value, idx) => (
        <div
          key={idx}
          className="flex-1 bg-gradient-to-t from-teal-500/50 to-teal-400/30 rounded-t hover:from-teal-500 hover:to-teal-400 transition-all"
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 4 : 0 }}
        />
      ))}
    </div>
  );
}

function PipelineFunnel({ pipeline }: { pipeline: DashboardData['pipeline'] }) {
  const stages = [
    { label: 'New Leads', value: pipeline.newLeads, color: 'bg-blue-500' },
    { label: 'Contacted', value: pipeline.contacted, color: 'bg-indigo-500' },
    { label: 'Qualified', value: pipeline.qualified, color: 'bg-violet-500' },
    { label: 'Proposal', value: pipeline.proposal, color: 'bg-purple-500' },
    { label: 'Converted', value: pipeline.converted, color: 'bg-emerald-500' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => (
        <div key={stage.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">{stage.label}</span>
            <span className="text-slate-900 dark:text-white font-medium">{stage.value}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${stage.color} transition-all duration-500`}
              style={{ width: `${(stage.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const res = await fetch('/api/analytics/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-slate-500 dark:text-slate-400">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Failed to load analytics</p>
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const { summary, pipeline, dailyActivity, needsBreakdown } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-slate-600 dark:text-slate-400">Real-time insights into your organization</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          className="border-slate-300 dark:border-slate-700"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Members"
          value={summary.activeMembers}
          change={summary.memberGrowthPct}
          trend={summary.memberGrowthPct > 0 ? 'up' : summary.memberGrowthPct < 0 ? 'down' : 'neutral'}
          icon={Users}
          color="teal"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(summary.mrr)}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Lead Conversion"
          value={`${summary.conversionRate}%`}
          icon={Target}
          color="violet"
        />
        <StatCard
          title="Active Advisors"
          value={summary.activeAdvisors}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card className="glass-card border-slate-200 dark:border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">30-Day Activity</CardTitle>
            <CardDescription>New members, leads, and enrollments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">New Members</span>
                  <span className="text-sm text-slate-900 dark:text-white">{summary.newMembersThisMonth} this month</span>
                </div>
                <MiniChart data={dailyActivity.map(d => d.members)} height={40} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">New Leads</span>
                  <span className="text-sm text-slate-900 dark:text-white">{summary.activeLeads} active</span>
                </div>
                <MiniChart data={dailyActivity.map(d => d.leads)} height={40} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Enrollments</span>
                  <span className="text-sm text-slate-900 dark:text-white">{summary.pendingEnrollments} pending</span>
                </div>
                <MiniChart data={dailyActivity.map(d => d.enrollments)} height={40} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Sales Pipeline</CardTitle>
            <CardDescription>Lead progression</CardDescription>
          </CardHeader>
          <CardContent>
            <PipelineFunnel pipeline={pipeline} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Overview */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Needs Management</CardTitle>
            <CardDescription>Healthcare needs status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Urgent</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{needsBreakdown.urgent}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">At Risk</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{needsBreakdown.atRisk}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">On Track</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{needsBreakdown.onTrack}</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Reimbursed</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(summary.totalReimbursed)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Quick Stats</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Total Members</span>
                <span className="text-slate-900 dark:text-white font-bold">{summary.totalMembers}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Total Leads</span>
                <span className="text-slate-900 dark:text-white font-bold">{summary.totalLeads}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Completed Enrollments</span>
                <span className="text-slate-900 dark:text-white font-bold">{summary.completedEnrollments}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                <span className="text-slate-600 dark:text-slate-400">Needs Amount Submitted</span>
                <span className="text-slate-900 dark:text-white font-bold">{formatCurrency(summary.totalNeedsAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
