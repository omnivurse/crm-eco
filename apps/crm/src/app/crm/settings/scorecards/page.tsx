'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Progress } from '@crm-eco/ui/components/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Phone,
  Mail,
  CheckSquare,
  Target,
  Award,
  Loader2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react';

interface AdvisorScorecard {
  id: string;
  organization_id: string;
  advisor_id: string;
  advisor_name?: string;
  period_type: string;
  period_start: string;
  period_end: string;
  new_enrollments: number;
  total_premium: number;
  personal_production: number;
  team_production: number;
  leads_generated: number;
  leads_contacted: number;
  leads_converted: number;
  conversion_rate: number;
  avg_days_to_close: number;
  member_retention_rate: number;
  members_retained: number;
  members_churned: number;
  calls_made: number;
  emails_sent: number;
  tasks_completed: number;
  commissions_earned: number;
  overrides_earned: number;
  bonuses_earned: number;
  org_rank?: number;
  percentile?: number;
}

interface Advisor {
  id: string;
  full_name: string;
}

export default function ScorecardsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [scorecards, setScorecards] = useState<AdvisorScorecard[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [orgId, setOrgId] = useState('');

  // Filters
  const [periodType, setPeriodType] = useState<string>('monthly');
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('personal_production');

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setOrgId(profile.organization_id);

      // Build query
      let query = supabase
        .from('advisor_scorecards')
        .select(`*, advisors(full_name)`)
        .eq('organization_id', profile.organization_id)
        .eq('period_type', periodType)
        .order('period_start', { ascending: false });

      if (selectedAdvisor !== 'all') {
        query = query.eq('advisor_id', selectedAdvisor);
      }

      const [scorecardsRes, advisorsRes] = await Promise.all([
        query.limit(100),
        supabase.from('advisors').select('id, full_name').eq('organization_id', profile.organization_id).eq('status', 'active'),
      ]);

      const scorecardsWithNames = (scorecardsRes.data || []).map((s: any) => ({
        ...s,
        advisor_name: s.advisors?.full_name || 'Unknown',
      }));

      // Calculate rankings
      const periodGroups = new Map<string, AdvisorScorecard[]>();
      scorecardsWithNames.forEach((s: AdvisorScorecard) => {
        const key = `${s.period_start}-${s.period_end}`;
        if (!periodGroups.has(key)) periodGroups.set(key, []);
        periodGroups.get(key)!.push(s);
      });

      periodGroups.forEach((group) => {
        const sorted = [...group].sort((a, b) => b.personal_production - a.personal_production);
        sorted.forEach((s, idx) => {
          s.org_rank = idx + 1;
          s.percentile = Math.round(((sorted.length - idx) / sorted.length) * 100);
        });
      });

      setScorecards(scorecardsWithNames);
      setAdvisors((advisorsRes.data || []) as Advisor[]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, periodType, selectedAdvisor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generateScorecards = async () => {
    setGenerating(true);
    try {
      // In production, this would call an API to calculate scorecards
      // For now, we show a message
      alert('Scorecard generation would be triggered via a server-side job');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getTrendIcon = (current: number, target: number) => {
    const diff = ((current - target) / target) * 100;
    if (diff > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (diff < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
    if (percentile >= 75) return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
    if (percentile >= 50) return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
    return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800';
  };

  // Get unique periods
  const periods = [...new Set(scorecards.map(s => `${s.period_start}|${s.period_end}`))].map(p => {
    const [start, end] = p.split('|');
    return { start, end, label: `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}` };
  });

  // Calculate aggregates
  const totalProduction = scorecards.reduce((sum, s) => sum + s.personal_production, 0);
  const totalEnrollments = scorecards.reduce((sum, s) => sum + s.new_enrollments, 0);
  const avgConversion = scorecards.length > 0
    ? scorecards.reduce((sum, s) => sum + s.conversion_rate, 0) / scorecards.length
    : 0;
  const topPerformer = scorecards.reduce((top, s) =>
    s.personal_production > (top?.personal_production || 0) ? s : top,
    null as AdvisorScorecard | null
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Advisor Scorecards</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Performance metrics and rankings
              </p>
            </div>
          </div>
        </div>
        <Button onClick={generateScorecards} disabled={generating}>
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh Scorecards
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Period:</span>
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Advisor:</span>
          <Select value={selectedAdvisor} onValueChange={setSelectedAdvisor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Advisors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Advisors</SelectItem>
              {advisors.map((adv) => (
                <SelectItem key={adv.id} value={adv.id}>{adv.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <CardTitle className="text-sm font-medium text-slate-500">Total Production</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(totalProduction)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <CardTitle className="text-sm font-medium text-slate-500">Enrollments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalEnrollments.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-500" />
              <CardTitle className="text-sm font-medium text-slate-500">Avg Conversion</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatPercent(avgConversion)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-slate-500">Top Performer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {topPerformer?.advisor_name || 'N/A'}
            </p>
            {topPerformer && (
              <p className="text-sm text-slate-500">{formatCurrency(topPerformer.personal_production)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scorecards Table */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {scorecards.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No scorecards available
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Scorecards are generated periodically based on activity
            </p>
            <Button onClick={generateScorecards}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Now
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Conversion</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecards.map((sc) => (
                <TableRow key={sc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {sc.org_rank === 1 && <Trophy className="w-4 h-4 text-amber-500" />}
                      <span className={`px-2 py-0.5 rounded text-sm font-medium ${getPercentileColor(sc.percentile || 0)}`}>
                        #{sc.org_rank || '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{sc.advisor_name}</p>
                      <p className="text-xs text-slate-500">
                        Top {sc.percentile || 0}%
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {new Date(sc.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' - '}
                    {new Date(sc.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {formatCurrency(sc.personal_production)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Team: {formatCurrency(sc.team_production)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{sc.new_enrollments}</span>
                      <span className="text-xs text-slate-500">new</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatPercent(sc.conversion_rate)}</span>
                        {sc.conversion_rate >= 25 ? (
                          <ChevronUp className="w-3 h-3 text-green-500" />
                        ) : sc.conversion_rate < 15 ? (
                          <ChevronDown className="w-3 h-3 text-red-500" />
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        {sc.leads_converted}/{sc.leads_generated} leads
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <span className="text-sm font-medium">{formatPercent(sc.member_retention_rate)}</span>
                      <Progress value={sc.member_retention_rate} className="h-1.5 w-16" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1" title="Calls">
                        <Phone className="w-3 h-3" />
                        {sc.calls_made}
                      </span>
                      <span className="flex items-center gap-1" title="Emails">
                        <Mail className="w-3 h-3" />
                        {sc.emails_sent}
                      </span>
                      <span className="flex items-center gap-1" title="Tasks">
                        <CheckSquare className="w-3 h-3" />
                        {sc.tasks_completed}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sc.commissions_earned + sc.overrides_earned + sc.bonuses_earned)}
                      </p>
                      <p className="text-xs text-slate-500">
                        +{formatCurrency(sc.bonuses_earned)} bonus
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded ${getPercentileColor(95)}`}>Top 10%</span>
          <span>Elite Performer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded ${getPercentileColor(80)}`}>Top 25%</span>
          <span>High Performer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded ${getPercentileColor(60)}`}>Top 50%</span>
          <span>On Track</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded ${getPercentileColor(30)}`}>Below 50%</span>
          <span>Needs Attention</span>
        </div>
      </div>
    </div>
  );
}
