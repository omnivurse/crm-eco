'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Building2,
  BarChart3,
  Trophy,
  Shield,
  Heart,
  Target,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Agency {
  id: string;
  name: string;
  code: string | null;
  status: string;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
}

interface AgencySummary {
  total_production: number;
  total_enrollments: number;
  active_advisors: number;
  paid_commissions: number;
  pending_commissions: number;
}

interface ProductBreakdown {
  product_type: string;
  total_commissions: number;
  total_enrollments: number;
}

interface TopAdvisor {
  advisor_id: string;
  first_name: string;
  last_name: string;
  commission_tier: string | null;
  total_commissions: number;
  total_enrollments: number;
}

interface MonthlyTrend {
  month: string;
  total_commissions: number;
  total_enrollments: number;
  active_advisors: number;
}

interface AgencyAnalytics {
  agency_id: string;
  summary: AgencySummary;
  by_product: ProductBreakdown[];
  top_advisors: TopAdvisor[];
  monthly: MonthlyTrend[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function MiniBarChart({
  data,
  valueKey,
  maxBars = 12,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  valueKey: string;
  maxBars?: number;
}) {
  const sliced = data.slice(-maxBars);
  const max = Math.max(...sliced.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {sliced.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-teal-500/80 hover:bg-teal-500 transition-colors min-h-[2px]"
              style={{ height: `${Math.max(pct, 2)}%` }}
              title={`${formatMonth(d.month as string)}: ${formatCurrency(val)}`}
            />
            <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate w-full text-center">
              {formatMonth(d.month as string)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function AgencyAnalyticsPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('');
  const [analytics, setAnalytics] = useState<AgencyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [months, setMonths] = useState('12');
  const [capacityScope, setCapacityScope] = useState<string>('all');

  // Fetch agencies list
  useEffect(() => {
    async function loadAgencies() {
      try {
        const res = await fetch('/api/agencies?status=active');
        if (res.ok) {
          const data = await res.json();
          setAgencies(data.agencies || []);
          if (data.agencies?.length > 0 && !selectedAgencyId) {
            setSelectedAgencyId(data.agencies[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load agencies:', error);
        toast.error('Failed to load agencies');
      } finally {
        setLoading(false);
      }
    }
    loadAgencies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch analytics for selected agency
  const fetchAnalytics = useCallback(async () => {
    if (!selectedAgencyId) return;

    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams({ months });
      if (capacityScope !== 'all') params.set('capacity_scope', capacityScope);

      const res = await fetch(`/api/agencies/${selectedAgencyId}/analytics?${params}`);
      if (res.ok) {
        setAnalytics(await res.json());
      } else {
        toast.error('Failed to load agency analytics');
      }
    } catch (error) {
      console.error('Failed to fetch agency analytics:', error);
      toast.error('Failed to load agency analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedAgencyId, months, capacityScope]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (agencies.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Agency Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            White-label agency performance dashboard
          </p>
        </div>
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Agencies Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Agencies are created when advisors are assigned the &quot;Agency&quot; role.
              Once agencies exist, their analytics will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedAgency = agencies.find((a) => a.id === selectedAgencyId);
  const summary = analytics?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Agency Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {selectedAgency?.company_name || selectedAgency?.name || 'Agency'} performance dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
            <SelectTrigger className="w-48 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
              <SelectValue placeholder="Select agency" />
            </SelectTrigger>
            <SelectContent>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={capacityScope} onValueChange={setCapacityScope}>
            <SelectTrigger className="w-36 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Capacities</SelectItem>
              <SelectItem value="health_insurance">Insurance</SelectItem>
              <SelectItem value="health_share">Health Share</SelectItem>
            </SelectContent>
          </Select>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-32 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 months</SelectItem>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total Production
                      </p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(summary.total_production)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Enrollments</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {summary.total_enrollments}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                      <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Active Advisors</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {summary.active_advisors}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(summary.pending_commissions)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Commission Trend */}
          {analytics?.monthly && analytics.monthly.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-500" />
                  Commission Trend
                </CardTitle>
                <CardDescription>
                  Agency production over time
                  {capacityScope !== 'all' && (
                    <span> &middot; {capacityScope === 'health_insurance' ? 'Insurance' : 'Health Share'}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={analytics.monthly} valueKey="total_commissions" />
              </CardContent>
            </Card>
          )}

          {/* Two-column: Product Breakdown + Top Advisors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Product Breakdown */}
            {analytics?.by_product && analytics.by_product.length > 0 && (
              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white">
                    By Product Type
                  </CardTitle>
                  <CardDescription>Commission breakdown by capacity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.by_product.map((product) => {
                      const label =
                        product.product_type === 'health_insurance'
                          ? 'Health Insurance'
                          : product.product_type === 'health_share'
                            ? 'Health Share'
                            : product.product_type === 'all'
                              ? 'All Types'
                              : product.product_type;
                      const Icon =
                        product.product_type === 'health_insurance'
                          ? Shield
                          : product.product_type === 'health_share'
                            ? Heart
                            : BarChart3;
                      const color =
                        product.product_type === 'health_insurance'
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                          : product.product_type === 'health_share'
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                            : 'text-slate-600 dark:text-slate-400 bg-slate-500/10';

                      return (
                        <div
                          key={product.product_type}
                          className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                          <div className={`p-2 rounded-lg ${color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-slate-900 dark:text-white">
                              {label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {product.total_enrollments} enrollments
                            </p>
                          </div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {formatCurrency(product.total_commissions)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Advisors */}
            {analytics?.top_advisors && analytics.top_advisors.length > 0 && (
              <Card className="glass-card border-slate-200 dark:border-white/10">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Top Producers
                  </CardTitle>
                  <CardDescription>
                    Top {analytics.top_advisors.length} advisors by commission
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.top_advisors.map((advisor, idx) => (
                      <div
                        key={advisor.advisor_id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : idx === 1
                                ? 'bg-slate-300/30 text-slate-600 dark:text-slate-400'
                                : idx === 2
                                  ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {advisor.first_name} {advisor.last_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {advisor.commission_tier || 'No tier'}
                            {' \u00B7 '}{advisor.total_enrollments} enrollments
                          </p>
                        </div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(advisor.total_commissions)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Enrollment Trend */}
          {analytics?.monthly && analytics.monthly.length > 0 && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Enrollment Trend
                </CardTitle>
                <CardDescription>Monthly enrollment count</CardDescription>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={analytics.monthly} valueKey="total_enrollments" />
              </CardContent>
            </Card>
          )}

          {/* Empty analytics state */}
          {(!analytics?.summary || analytics.summary.total_production === 0) && !analyticsLoading && (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardContent className="py-16 text-center">
                <BarChart3 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No Analytics Data
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  No commission data found for this agency. Analytics are populated from
                  commission records and the advisor performance materialized view.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
