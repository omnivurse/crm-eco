'use client';

import { useState, useEffect, useMemo } from 'react';
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
  CreditCard,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Download,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';

type DatePreset = 'TD' | 'YD' | 'MO' | '7' | '30' | '60' | '90';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'TD', label: 'Today' },
  { key: 'YD', label: 'Yesterday' },
  { key: 'MO', label: 'This Month' },
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '60', label: '60 Days' },
  { key: '90', label: '90 Days' },
];

interface SummaryStats {
  totalCollected: number;
  totalFailed: number;
  totalRefunded: number;
  totalPending: number;
  transactionCount: number;
  successRate: number;
  avgTransactionAmount: number;
}

interface BreakdownItem {
  label: string;
  count: number;
  amount: number;
  percentage: number;
}

export default function BillingSummaryPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>('30');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats>({
    totalCollected: 0,
    totalFailed: 0,
    totalRefunded: 0,
    totalPending: 0,
    transactionCount: 0,
    successRate: 0,
    avgTransactionAmount: 0,
  });
  const [statusBreakdown, setStatusBreakdown] = useState<BreakdownItem[]>([]);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState<BreakdownItem[]>([]);
  const [declineCategoryBreakdown, setDeclineCategoryBreakdown] = useState<BreakdownItem[]>([]);
  const [dailyTrend, setDailyTrend] = useState<{ date: string; collected: number; failed: number }[]>([]);

  const supabase = createClient();

  const getDateRange = (preset: DatePreset): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'TD':
        break;
      case 'YD':
        start.setDate(start.getDate() - 1);
        end.setDate(end.getDate() - 1);
        break;
      case 'MO':
        start.setDate(1);
        break;
      case '7':
        start.setDate(start.getDate() - 7);
        break;
      case '30':
        start.setDate(start.getDate() - 30);
        break;
      case '60':
        start.setDate(start.getDate() - 60);
        break;
      case '90':
        start.setDate(start.getDate() - 90);
        break;
    }

    return { start, end };
  };

  const fetchSummary = async () => {
    setLoading(true);
    const { start, end } = getDateRange(datePreset);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: transactions, error } = await (supabase as any)
        .from('billing_transactions')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const txns = (transactions || []) as Array<{ status: string; amount: number; created_at: string; payment_method?: string; decline_category?: string }>;

      // Calculate main stats
      const collected = txns
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const failed = txns
        .filter((t) => t.status === 'failed')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const refunded = txns
        .filter((t) => t.status === 'refunded')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const pending = txns
        .filter((t) => t.status === 'pending')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const completedCount = txns.filter((t) => t.status === 'completed').length;
      const failedCount = txns.filter((t) => t.status === 'failed').length;
      const totalWithResult = completedCount + failedCount;
      const successRate = totalWithResult > 0 ? (completedCount / totalWithResult) * 100 : 0;
      const avgAmount = txns.length > 0 ? (collected + failed + refunded + pending) / txns.length : 0;

      setStats({
        totalCollected: collected,
        totalFailed: failed,
        totalRefunded: refunded,
        totalPending: pending,
        transactionCount: txns.length,
        successRate,
        avgTransactionAmount: avgAmount,
      });

      // Status breakdown
      const statusCounts: Record<string, { count: number; amount: number }> = {};
      txns.forEach((t) => {
        const status = t.status || 'unknown';
        if (!statusCounts[status]) {
          statusCounts[status] = { count: 0, amount: 0 };
        }
        statusCounts[status].count++;
        statusCounts[status].amount += t.amount || 0;
      });

      const statusItems: BreakdownItem[] = Object.entries(statusCounts).map(([label, data]) => ({
        label,
        count: data.count,
        amount: data.amount,
        percentage: txns.length > 0 ? (data.count / txns.length) * 100 : 0,
      }));
      setStatusBreakdown(statusItems.sort((a, b) => b.count - a.count));

      // Payment method breakdown
      const methodCounts: Record<string, { count: number; amount: number }> = {};
      txns.forEach((t) => {
        const method = t.payment_method || 'unknown';
        if (!methodCounts[method]) {
          methodCounts[method] = { count: 0, amount: 0 };
        }
        methodCounts[method].count++;
        methodCounts[method].amount += t.amount || 0;
      });

      const methodItems: BreakdownItem[] = Object.entries(methodCounts).map(([label, data]) => ({
        label,
        count: data.count,
        amount: data.amount,
        percentage: txns.length > 0 ? (data.count / txns.length) * 100 : 0,
      }));
      setPaymentMethodBreakdown(methodItems.sort((a, b) => b.count - a.count));

      // Decline category breakdown (for failed transactions only)
      const failedTxns = txns.filter((t) => t.status === 'failed');
      const declineCounts: Record<string, { count: number; amount: number }> = {};
      failedTxns.forEach((t) => {
        const category = t.decline_category || 'uncategorized';
        if (!declineCounts[category]) {
          declineCounts[category] = { count: 0, amount: 0 };
        }
        declineCounts[category].count++;
        declineCounts[category].amount += t.amount || 0;
      });

      const declineItems: BreakdownItem[] = Object.entries(declineCounts).map(([label, data]) => ({
        label,
        count: data.count,
        amount: data.amount,
        percentage: failedTxns.length > 0 ? (data.count / failedTxns.length) * 100 : 0,
      }));
      setDeclineCategoryBreakdown(declineItems.sort((a, b) => b.count - a.count));

      // Daily trend (group by date)
      const dailyData: Record<string, { collected: number; failed: number }> = {};
      txns.forEach((t) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { collected: 0, failed: 0 };
        }
        if (t.status === 'completed') {
          dailyData[date].collected += t.amount || 0;
        } else if (t.status === 'failed') {
          dailyData[date].failed += t.amount || 0;
        }
      });

      const trendData = Object.entries(dailyData)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setDailyTrend(trendData);
    } catch (error) {
      console.error('Error fetching billing summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [datePreset]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <RefreshCw className="h-4 w-4 text-amber-500" />;
      case 'refunded':
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'card':
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />;
      case 'ach':
      case 'bank':
        return <Building2 className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const exportSummary = () => {
    const { start, end } = getDateRange(datePreset);
    const report = [
      `Billing Summary Report`,
      `Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'OVERVIEW',
      `Total Collected: ${formatCurrency(stats.totalCollected)}`,
      `Total Failed: ${formatCurrency(stats.totalFailed)}`,
      `Total Refunded: ${formatCurrency(stats.totalRefunded)}`,
      `Total Pending: ${formatCurrency(stats.totalPending)}`,
      `Transaction Count: ${stats.transactionCount}`,
      `Success Rate: ${stats.successRate.toFixed(1)}%`,
      `Average Transaction: ${formatCurrency(stats.avgTransactionAmount)}`,
      '',
      'STATUS BREAKDOWN',
      ...statusBreakdown.map((s) => `${s.label}: ${s.count} (${formatCurrency(s.amount)}) - ${s.percentage.toFixed(1)}%`),
      '',
      'PAYMENT METHOD BREAKDOWN',
      ...paymentMethodBreakdown.map((m) => `${m.label}: ${m.count} (${formatCurrency(m.amount)}) - ${m.percentage.toFixed(1)}%`),
      '',
      'DECLINE CATEGORIES',
      ...declineCategoryBreakdown.map((d) => `${d.label}: ${d.count} (${formatCurrency(d.amount)}) - ${d.percentage.toFixed(1)}%`),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-summary-${datePreset}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Summary</h1>
          <p className="text-muted-foreground">Overview of billing activity and trends</p>
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

      {/* Date Presets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Date Range</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={datePreset === preset.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDatePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalCollected)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Failed</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalFailed)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-2xl font-bold">{stats.transactionCount.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-full">
                <DollarSign className="h-6 w-6 text-slate-600" />
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
                <p className="text-sm text-muted-foreground">Total Refunded</p>
                <p className="text-xl font-semibold text-blue-600">{formatCurrency(stats.totalRefunded)}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pending</p>
                <p className="text-xl font-semibold text-amber-600">{formatCurrency(stats.totalPending)}</p>
              </div>
              <RefreshCw className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Transaction</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.avgTransactionAmount)}</p>
              </div>
              <DollarSign className="h-5 w-5 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Status</CardTitle>
            <CardDescription>Transaction status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded" />
                ))}
              </div>
            ) : statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-3">
                {statusBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.label)}
                      <span className="text-sm capitalize">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Payment Method</CardTitle>
            <CardDescription>Payment method distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded" />
                ))}
              </div>
            ) : paymentMethodBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-3">
                {paymentMethodBreakdown.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMethodIcon(item.label)}
                      <span className="text-sm capitalize">{item.label.replace('_', ' ')}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decline Categories */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Decline Categories</CardTitle>
                <CardDescription>Failed transaction reasons</CardDescription>
              </div>
              <Link href="/billing/declined/today">
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded" />
                ))}
              </div>
            ) : declineCategoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No declines</p>
            ) : (
              <div className="space-y-3">
                {declineCategoryBreakdown.slice(0, 5).map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {item.percentage.toFixed(0)}%
                      </Badge>
                      <span className="text-sm capitalize">{item.label.replace('_', ' ')}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.count}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Trend</CardTitle>
          <CardDescription>Collections and failures over time</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="animate-pulse h-48 bg-slate-100 rounded" />
          ) : dailyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No data for selected period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-right py-2 px-3 font-medium text-emerald-600">Collected</th>
                    <th className="text-right py-2 px-3 font-medium text-red-600">Failed</th>
                    <th className="text-right py-2 px-3 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTrend.slice(-14).map((day) => (
                    <tr key={day.date} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">{new Date(day.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(day.collected)}</td>
                      <td className="py-2 px-3 text-right text-red-600">{formatCurrency(day.failed)}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(day.collected - day.failed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-medium">
                    <td className="py-2 px-3">Total</td>
                    <td className="py-2 px-3 text-right text-emerald-600">
                      {formatCurrency(dailyTrend.reduce((sum, d) => sum + d.collected, 0))}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {formatCurrency(dailyTrend.reduce((sum, d) => sum + d.failed, 0))}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {formatCurrency(
                        dailyTrend.reduce((sum, d) => sum + d.collected, 0) -
                          dailyTrend.reduce((sum, d) => sum + d.failed, 0)
                      )}
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
            <Link href="/billing/list">
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                View All Transactions
              </Button>
            </Link>
            <Link href="/billing/declined/today">
              <Button variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                Today's Declines
              </Button>
            </Link>
            <Link href="/billing/nacha/export">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                NACHA Export
              </Button>
            </Link>
            <Link href="/billing/payment-processors">
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Payment Processors
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
