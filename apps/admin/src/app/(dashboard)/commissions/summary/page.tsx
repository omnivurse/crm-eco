'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@crm-eco/ui';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Gift,
  Calendar,
  RefreshCw,
  Download,
  ArrowRight,
  Clock,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface SummaryStats {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  totalBonuses: number;
  transactionCount: number;
  bonusCount: number;
  avgCommission: number;
  topAgentAmount: number;
}

interface AgentSummary {
  advisorId: string;
  advisorName: string;
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  transactionCount: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  paid: number;
  pending: number;
  bonuses: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
  amount: number;
  percentage: number;
}

export default function CommissionsSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [stats, setStats] = useState<SummaryStats>({
    totalEarned: 0,
    totalPaid: 0,
    totalPending: 0,
    totalBonuses: 0,
    transactionCount: 0,
    bonusCount: 0,
    avgCommission: 0,
    topAgentAmount: 0,
  });

  const [topAgents, setTopAgents] = useState<AgentSummary[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function getOrgId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const result = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      const profile = result.data as { organization_id: string } | null;
      if (profile) {
        setOrganizationId(profile.organization_id);
      }
    }

    getOrgId();
  }, [supabase]);

  const fetchSummary = async () => {
    if (!organizationId) return;
    setLoading(true);

    try {
      // Fetch all commissions for the period
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: commissions, error } = await (supabase as any)
        .from('commission_transactions')
        .select(
          `
          id,
          advisor_id,
          transaction_type,
          commission_amount,
          status,
          is_bonus,
          created_at,
          advisor:advisors(first_name, last_name)
        `
        )
        .eq('organization_id', organizationId)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd + 'T23:59:59');

      if (error) throw error;

      const txns = (commissions || []) as any[];

      // Calculate stats
      const totalEarned = txns.reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const totalPaid = txns
        .filter((t) => t.status === 'paid')
        .reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const totalPending = txns
        .filter((t) => t.status === 'pending')
        .reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const totalBonuses = txns
        .filter((t) => t.is_bonus)
        .reduce((sum, t) => sum + (t.commission_amount || 0), 0);
      const bonusCount = txns.filter((t) => t.is_bonus).length;
      const avgCommission = txns.length > 0 ? totalEarned / txns.length : 0;

      // Group by agent
      const agentMap = new Map<
        string,
        {
          advisorId: string;
          advisorName: string;
          totalEarned: number;
          totalPaid: number;
          totalPending: number;
          transactionCount: number;
        }
      >();

      txns.forEach((t) => {
        const key = t.advisor_id;
        const existing = agentMap.get(key) || {
          advisorId: t.advisor_id,
          advisorName: `${t.advisor?.first_name || ''} ${t.advisor?.last_name || ''}`.trim() || 'Unknown',
          totalEarned: 0,
          totalPaid: 0,
          totalPending: 0,
          transactionCount: 0,
        };

        existing.totalEarned += t.commission_amount || 0;
        if (t.status === 'paid') existing.totalPaid += t.commission_amount || 0;
        if (t.status === 'pending') existing.totalPending += t.commission_amount || 0;
        existing.transactionCount++;

        agentMap.set(key, existing);
      });

      const sortedAgents = Array.from(agentMap.values()).sort((a, b) => b.totalEarned - a.totalEarned);
      const topAgentAmount = sortedAgents[0]?.totalEarned || 0;

      setStats({
        totalEarned,
        totalPaid,
        totalPending,
        totalBonuses,
        transactionCount: txns.length,
        bonusCount,
        avgCommission,
        topAgentAmount,
      });

      setTopAgents(sortedAgents.slice(0, 10));

      // Type breakdown
      const typeMap = new Map<string, { count: number; amount: number }>();
      txns.forEach((t) => {
        const type = t.is_bonus ? 'bonus' : t.transaction_type;
        const existing = typeMap.get(type) || { count: 0, amount: 0 };
        existing.count++;
        existing.amount += t.commission_amount || 0;
        typeMap.set(type, existing);
      });

      const breakdown: TypeBreakdown[] = Array.from(typeMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.amount,
        percentage: txns.length > 0 ? (data.count / txns.length) * 100 : 0,
      }));
      setTypeBreakdown(breakdown.sort((a, b) => b.amount - a.amount));

      // Monthly trend (last 6 months)
      const trendData: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: monthTxns } = await (supabase as any)
          .from('commission_transactions')
          .select('commission_amount, status, is_bonus')
          .eq('organization_id', organizationId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());

        const monthData = (monthTxns || []) as Array<{ commission_amount: number; status: string; is_bonus: boolean }>;
        trendData.push({
          month: format(monthDate, 'MMM yyyy'),
          total: monthData.reduce((sum, t) => sum + (t.commission_amount || 0), 0),
          paid: monthData
            .filter((t) => t.status === 'paid')
            .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
          pending: monthData
            .filter((t) => t.status === 'pending')
            .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
          bonuses: monthData
            .filter((t) => t.is_bonus)
            .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
        });
      }
      setMonthlyTrend(trendData);
    } catch (error) {
      console.error('Error fetching commission summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchSummary();
    }
  }, [organizationId, periodStart, periodEnd]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'new_business':
        return 'New Business';
      case 'renewal':
        return 'Renewal';
      case 'override':
        return 'Override';
      case 'bonus':
        return 'Bonus';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'new_business':
        return 'bg-teal-100 text-teal-700';
      case 'renewal':
        return 'bg-blue-100 text-blue-700';
      case 'override':
        return 'bg-orange-100 text-orange-700';
      case 'bonus':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const exportSummary = () => {
    const report = [
      `Commission Summary Report`,
      `Period: ${periodStart} to ${periodEnd}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'OVERVIEW',
      `Total Earned: ${formatCurrency(stats.totalEarned)}`,
      `Total Paid: ${formatCurrency(stats.totalPaid)}`,
      `Total Pending: ${formatCurrency(stats.totalPending)}`,
      `Total Bonuses: ${formatCurrency(stats.totalBonuses)}`,
      `Transaction Count: ${stats.transactionCount}`,
      `Average Commission: ${formatCurrency(stats.avgCommission)}`,
      '',
      'TOP AGENTS',
      ...topAgents.map(
        (a, i) =>
          `${i + 1}. ${a.advisorName}: ${formatCurrency(a.totalEarned)} (${a.transactionCount} transactions)`
      ),
      '',
      'TYPE BREAKDOWN',
      ...typeBreakdown.map(
        (t) => `${getTypeLabel(t.type)}: ${t.count} (${formatCurrency(t.amount)}) - ${t.percentage.toFixed(1)}%`
      ),
      '',
      'MONTHLY TREND',
      ...monthlyTrend.map((m) => `${m.month}: ${formatCurrency(m.total)} (Paid: ${formatCurrency(m.paid)})`),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-summary-${periodStart}-${periodEnd}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setQuickPeriod = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setPeriodStart(format(startOfMonth(start), 'yyyy-MM-dd'));
    setPeriodEnd(format(endOfMonth(end), 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commission Summary</h1>
          <p className="text-muted-foreground">Overview of commission activity and performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportSummary}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" onClick={fetchSummary}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Period</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(1)}>
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(3)}>
                Last 3 Months
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(6)}>
                Last 6 Months
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickPeriod(12)}>
                Last Year
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalEarned)}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-full">
                <DollarSign className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPending)}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bonuses</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalBonuses)}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Gift className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-xl font-semibold">{stats.transactionCount.toLocaleString()}</p>
              </div>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Commission</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.avgCommission)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Top Agent Earnings</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.topAgentAmount)}</p>
              </div>
              <Users className="h-5 w-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Performing Agents</CardTitle>
                <CardDescription>Ranked by total earnings</CardDescription>
              </div>
              <Link href="/commissions/list">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded" />
                ))}
              </div>
            ) : topAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for selected period</p>
            ) : (
              <div className="space-y-3">
                {topAgents.slice(0, 5).map((agent, index) => (
                  <div key={agent.advisorId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0
                            ? 'bg-amber-100 text-amber-700'
                            : index === 1
                              ? 'bg-slate-200 text-slate-700'
                              : index === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{agent.advisorName}</p>
                        <p className="text-xs text-muted-foreground">{agent.transactionCount} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(agent.totalEarned)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(agent.totalPaid)} paid
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By Commission Type</CardTitle>
            <CardDescription>Distribution of commission types</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded" />
                ))}
              </div>
            ) : typeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for selected period</p>
            ) : (
              <div className="space-y-4">
                {typeBreakdown.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeColor(item.type)}>{getTypeLabel(item.type)}</Badge>
                        <span className="text-sm text-muted-foreground">{item.count}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend</CardTitle>
          <CardDescription>Commission earnings over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse h-48 bg-slate-100 rounded" />
          ) : monthlyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Month</th>
                    <th className="text-right py-2 px-3 font-medium">Total</th>
                    <th className="text-right py-2 px-3 font-medium text-emerald-600">Paid</th>
                    <th className="text-right py-2 px-3 font-medium text-amber-600">Pending</th>
                    <th className="text-right py-2 px-3 font-medium text-purple-600">Bonuses</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((month) => (
                    <tr key={month.month} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">{month.month}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(month.total)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(month.paid)}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(month.pending)}</td>
                      <td className="py-2 px-3 text-right text-purple-600">{formatCurrency(month.bonuses)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-medium">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right">
                      {formatCurrency(monthlyTrend.reduce((sum, m) => sum + m.total, 0))}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-600">
                      {formatCurrency(monthlyTrend.reduce((sum, m) => sum + m.paid, 0))}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-600">
                      {formatCurrency(monthlyTrend.reduce((sum, m) => sum + m.pending, 0))}
                    </td>
                    <td className="py-2 px-3 text-right text-purple-600">
                      {formatCurrency(monthlyTrend.reduce((sum, m) => sum + m.bonuses, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Link href="/commissions/list">
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                View All Commissions
              </Button>
            </Link>
            <Link href="/commissions/payouts">
              <Button variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Process Payouts
              </Button>
            </Link>
            <Link href="/commissions/tiers">
              <Button variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Manage Tiers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
