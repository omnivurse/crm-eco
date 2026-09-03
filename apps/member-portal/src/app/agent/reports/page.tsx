'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  ChartBar,
  TrendUp,
  Users,
  CurrencyDollar,
  Calendar,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface ReportData {
  monthlyEnrollments: { month: string; count: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  enrollmentsByStatus: { status: string; count: number }[];
  topProducts: { name: string; count: number }[];
}

export default function AgentReportsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6months');
  const [data, setData] = useState<ReportData>({
    monthlyEnrollments: [],
    monthlyRevenue: [],
    enrollmentsByStatus: [],
    topProducts: [],
  });
  
  const supabase = createClient();

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile first
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null };

    if (!profile) return;

    // Get advisor using profile_id
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id, organization_id')
      .eq('profile_id', profile.id)
      .single() as { data: { id: string; organization_id: string } | null };

    if (!advisor) return;

    // Get enrollments (column is `total_monthly_cost`, not `monthly_cost`)
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        total_monthly_cost,
        created_at,
        plans (name)
      `)
      .eq('advisor_id', advisor.id)
      .eq('organization_id', advisor.organization_id);

    if (enrollments) {
      // Calculate monthly enrollments
      const monthlyMap = new Map<string, number>();
      const revenueMap = new Map<string, number>();
      const statusMap = new Map<string, number>();
      const productMap = new Map<string, number>();

      enrollments.forEach((e: any) => {
        const date = new Date(e.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
        revenueMap.set(monthKey, (revenueMap.get(monthKey) || 0) + (e.total_monthly_cost || 0));
        statusMap.set(e.status, (statusMap.get(e.status) || 0) + 1);
        
        const planName = e.plans?.name || 'Unknown';
        productMap.set(planName, (productMap.get(planName) || 0) + 1);
      });

      // Convert to arrays and sort
      const monthlyEnrollments = Array.from(monthlyMap.entries())
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6);

      const monthlyRevenue = Array.from(revenueMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-6);

      const enrollmentsByStatus = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }));

      const topProducts = Array.from(productMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setData({
        monthlyEnrollments,
        monthlyRevenue,
        enrollmentsByStatus,
        topProducts,
      });
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => fetchReportData());
  }, [fetchReportData]);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const totalEnrollments = data.enrollmentsByStatus.reduce((sum, s) => sum + s.count, 0);
  const totalRevenue = data.monthlyRevenue.reduce((sum, m) => sum + m.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ChartBar weight="light" className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-bold text-slate-900 min-w-0 flex-1">Reports & Analytics</h1>
        <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto sm:justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar weight="light" className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="12months">Last 12 Months</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Enrollments</p>
                <p className="text-3xl font-bold">{totalEnrollments}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <Users weight="light" className="h-6 w-6 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Monthly Recurring</p>
                <p className="text-3xl font-bold text-green-600">
                  ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CurrencyDollar weight="light" className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg Revenue/Member</p>
                <p className="text-3xl font-bold text-[var(--mp-teal)]">
                  ${totalEnrollments > 0 ? (totalRevenue / totalEnrollments).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[rgba(11,109,133,0.1)] flex items-center justify-center">
                <TrendUp weight="light" className="h-6 w-6 text-[var(--mp-teal)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Enrollment Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyEnrollments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {data.monthlyEnrollments.map((item) => {
                  const maxCount = Math.max(...data.monthlyEnrollments.map(m => m.count));
                  const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={item.month} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-slate-500">{formatMonth(item.month)}</span>
                      <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[rgba(11,109,133,0.06)]0 rounded-full flex items-center justify-end pr-3"
                          style={{ width: `${Math.max(percentage, 10)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrollments by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollments by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.enrollmentsByStatus.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No data available
              </div>
            ) : (
              <div className="space-y-4">
                {data.enrollmentsByStatus.map((item) => {
                  const colors: Record<string, string> = {
                    active: 'bg-green-500',
                    Active: 'bg-green-500',
                    pending: 'bg-amber-500',
                    Pending: 'bg-amber-500',
                    inactive: 'bg-slate-400',
                    Inactive: 'bg-slate-400',
                    cancelled: 'bg-red-500',
                    Cancelled: 'bg-red-500',
                  };
                  const percentage = totalEnrollments > 0 ? (item.count / totalEnrollments) * 100 : 0;
                  
                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize text-slate-700">{item.status}</span>
                        <span className="text-slate-500">{item.count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${colors[item.status] || 'bg-slate-400'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 font-medium text-slate-600">Product</th>
                      <th className="text-right py-3 font-medium text-slate-600">Enrollments</th>
                      <th className="text-right py-3 font-medium text-slate-600">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product, index) => (
                      <tr key={product.name} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)] flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </span>
                            {product.name}
                          </div>
                        </td>
                        <td className="text-right py-3 font-medium">{product.count}</td>
                        <td className="text-right py-3 text-slate-500">
                          {((product.count / totalEnrollments) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
