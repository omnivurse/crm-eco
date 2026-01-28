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
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Download,
  ArrowRight,
  Building2,
  User,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface SummaryStats {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  totalOverdue: number;
  countPending: number;
  countApproved: number;
  countPaid: number;
  countOverdue: number;
}

interface PayeeTypeSummary {
  type: string;
  count: number;
  amount: number;
  percentage: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
  paid: number;
  pending: number;
}

interface TopPayee {
  name: string;
  type: string;
  totalAmount: number;
  count: number;
}

export default function PayablesSummaryPage() {
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [stats, setStats] = useState<SummaryStats>({
    totalPending: 0,
    totalApproved: 0,
    totalPaid: 0,
    totalOverdue: 0,
    countPending: 0,
    countApproved: 0,
    countPaid: 0,
    countOverdue: 0,
  });

  const [payeeTypeSummary, setPayeeTypeSummary] = useState<PayeeTypeSummary[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [topPayees, setTopPayees] = useState<TopPayee[]>([]);
  const [upcomingDue, setUpcomingDue] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 });

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
      // Fetch all payables
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: payables, error } = await (supabase as any)
        .from('payables')
        .select('*')
        .eq('organization_id', organizationId);

      if (error && error.code !== '42P01') throw error;

      interface PayableRecord { status: string; due_date?: string; amount?: number; payee_type: string; payee_name: string; created_at: string; }
      const data = (payables || []) as PayableRecord[];
      const now = new Date();

      // Calculate main stats
      const pending = data.filter((p) => p.status === 'pending');
      const approved = data.filter((p) => p.status === 'approved');
      const paid = data.filter((p) => p.status === 'paid');
      const overdue = data.filter(
        (p) => ['pending', 'approved'].includes(p.status) && p.due_date && new Date(p.due_date) < now
      );

      setStats({
        totalPending: pending.reduce((sum, p) => sum + (p.amount || 0), 0),
        totalApproved: approved.reduce((sum, p) => sum + (p.amount || 0), 0),
        totalPaid: paid.reduce((sum, p) => sum + (p.amount || 0), 0),
        totalOverdue: overdue.reduce((sum, p) => sum + (p.amount || 0), 0),
        countPending: pending.length,
        countApproved: approved.length,
        countPaid: paid.length,
        countOverdue: overdue.length,
      });

      // Payee type breakdown
      const typeMap = new Map<string, { count: number; amount: number }>();
      data.forEach((p) => {
        const existing = typeMap.get(p.payee_type) || { count: 0, amount: 0 };
        existing.count++;
        existing.amount += p.amount || 0;
        typeMap.set(p.payee_type, existing);
      });

      const totalAmount = data.reduce((sum, p) => sum + (p.amount || 0), 0);
      const typeSummary: PayeeTypeSummary[] = Array.from(typeMap.entries()).map(([type, info]) => ({
        type,
        count: info.count,
        amount: info.amount,
        percentage: totalAmount > 0 ? (info.amount / totalAmount) * 100 : 0,
      }));
      setPayeeTypeSummary(typeSummary.sort((a, b) => b.amount - a.amount));

      // Top payees
      const payeeMap = new Map<string, { name: string; type: string; amount: number; count: number }>();
      data.forEach((p) => {
        const key = p.payee_name;
        const existing = payeeMap.get(key) || { name: p.payee_name, type: p.payee_type, amount: 0, count: 0 };
        existing.amount += p.amount || 0;
        existing.count++;
        payeeMap.set(key, existing);
      });

      const sortedPayees = Array.from(payeeMap.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((p) => ({
          name: p.name,
          type: p.type,
          totalAmount: p.amount,
          count: p.count,
        }));
      setTopPayees(sortedPayees);

      // Upcoming due (next 7 days)
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const upcoming = data.filter(
        (p) =>
          ['pending', 'approved'].includes(p.status) &&
          p.due_date &&
          new Date(p.due_date) >= now &&
          new Date(p.due_date) <= nextWeek
      );
      setUpcomingDue({
        count: upcoming.length,
        amount: upcoming.reduce((sum, p) => sum + (p.amount || 0), 0),
      });

      // Monthly trend (last 6 months)
      const trendData: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        const monthPayables = data.filter((p) => {
          const created = new Date(p.created_at);
          return created >= monthStart && created <= monthEnd;
        });

        trendData.push({
          month: format(monthDate, 'MMM yyyy'),
          total: monthPayables.reduce((sum, p) => sum + (p.amount || 0), 0),
          paid: monthPayables.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
          pending: monthPayables
            .filter((p) => ['pending', 'approved'].includes(p.status))
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        });
      }
      setMonthlyTrend(trendData);
    } catch (error) {
      console.error('Error fetching payables summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchSummary();
    }
  }, [organizationId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getPayeeTypeLabel = (type: string) => {
    switch (type) {
      case 'agent':
        return 'Agent';
      case 'vendor':
        return 'Vendor';
      case 'provider':
        return 'Provider';
      default:
        return 'Other';
    }
  };

  const getPayeeTypeColor = (type: string) => {
    switch (type) {
      case 'agent':
        return 'bg-teal-100 text-teal-700';
      case 'vendor':
        return 'bg-blue-100 text-blue-700';
      case 'provider':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const exportSummary = () => {
    const report = [
      `Payables Summary Report`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'OVERVIEW',
      `Total Pending: ${formatCurrency(stats.totalPending)} (${stats.countPending})`,
      `Total Approved: ${formatCurrency(stats.totalApproved)} (${stats.countApproved})`,
      `Total Paid: ${formatCurrency(stats.totalPaid)} (${stats.countPaid})`,
      `Total Overdue: ${formatCurrency(stats.totalOverdue)} (${stats.countOverdue})`,
      '',
      `Upcoming (7 days): ${formatCurrency(upcomingDue.amount)} (${upcomingDue.count})`,
      '',
      'BY PAYEE TYPE',
      ...payeeTypeSummary.map((t) => `${getPayeeTypeLabel(t.type)}: ${formatCurrency(t.amount)} (${t.count})`),
      '',
      'TOP PAYEES',
      ...topPayees.map((p, i) => `${i + 1}. ${p.name}: ${formatCurrency(p.totalAmount)} (${p.count} payables)`),
      '',
      'MONTHLY TREND',
      ...monthlyTrend.map((m) => `${m.month}: ${formatCurrency(m.total)} (Paid: ${formatCurrency(m.paid)})`),
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payables-summary-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payables Summary</h1>
          <p className="text-muted-foreground">Overview of accounts payable</p>
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

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPending)}</p>
                <p className="text-xs text-muted-foreground">{stats.countPending} payables</p>
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
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalApproved)}</p>
                <p className="text-xs text-muted-foreground">{stats.countApproved} payables</p>
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
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">{stats.countPaid} payables</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={stats.countOverdue > 0 ? 'border-red-200' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalOverdue)}</p>
                <p className="text-xs text-muted-foreground">{stats.countOverdue} payables</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Due Alert */}
      {upcomingDue.count > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Upcoming Due (Next 7 Days)</p>
                  <p className="text-sm text-amber-700">
                    {upcomingDue.count} payables totaling {formatCurrency(upcomingDue.amount)}
                  </p>
                </div>
              </div>
              <Link href="/payables?status=approved">
                <Button variant="outline" size="sm">
                  View
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Payee Type */}
        <Card>
          <CardHeader>
            <CardTitle>By Payee Type</CardTitle>
            <CardDescription>Distribution of payables by type</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded" />
                ))}
              </div>
            ) : payeeTypeSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="space-y-4">
                {payeeTypeSummary.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge className={getPayeeTypeColor(item.type)}>{getPayeeTypeLabel(item.type)}</Badge>
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

        {/* Top Payees */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Payees</CardTitle>
                <CardDescription>Highest payable amounts by payee</CardDescription>
              </div>
              <Link href="/payables">
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
            ) : topPayees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="space-y-3">
                {topPayees.slice(0, 5).map((payee, index) => (
                  <div key={payee.name} className="flex items-center justify-between py-2 border-b last:border-0">
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
                        <p className="font-medium">{payee.name}</p>
                        <div className="flex items-center gap-1">
                          {payee.type === 'agent' ? (
                            <User className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">{payee.count} payables</span>
                        </div>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(payee.totalAmount)}</p>
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
          <CardDescription>Payables activity over the last 6 months</CardDescription>
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
                    <th className="text-right py-2 px-3 font-medium text-amber-600">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((month) => (
                    <tr key={month.month} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">{month.month}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(month.total)}</td>
                      <td className="py-2 px-3 text-right text-emerald-600">{formatCurrency(month.paid)}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{formatCurrency(month.pending)}</td>
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
            <Link href="/payables">
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                View All Payables
              </Button>
            </Link>
            <Link href="/payables?status=approved">
              <Button variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Ready to Pay
              </Button>
            </Link>
            <Link href="/payables?status=pending">
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                Pending Approval
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
