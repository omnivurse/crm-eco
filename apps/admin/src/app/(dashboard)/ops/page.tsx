'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@crm-eco/ui';
import {
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Calendar,
  ChevronRight,
  Activity,
  Server,
  Database,
  RefreshCw,
  Shield,
  FileText,
  Users,
  Building2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface OpsStats {
  totalJobs: number;
  runningJobs: number;
  failedJobs24h: number;
  recentJobs: any[];
  vendorStats: {
    vendor_code: string;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    last_run_at: string | null;
  }[];
}

const statusConfig: Record<string, { icon: any; color: string }> = {
  pending: { icon: Clock, color: 'bg-slate-100 text-slate-600' },
  running: { icon: RefreshCw, color: 'bg-blue-100 text-blue-600' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-600' },
  cancelled: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
};

const vendorInfo: Record<string, { name: string; icon: any; color: string }> = {
  arm: { name: 'ARM', icon: Shield, color: 'bg-blue-100 text-blue-600' },
  sedera: { name: 'Sedera', icon: Users, color: 'bg-purple-100 text-purple-600' },
  zion: { name: 'Zion', icon: Building2, color: 'bg-emerald-100 text-emerald-600' },
  mphc: { name: 'MPHC', icon: Shield, color: 'bg-amber-100 text-amber-600' },
  altrua: { name: 'Altrua', icon: Users, color: 'bg-pink-100 text-pink-600' },
};

export default function OpsPage() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
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
    init();
  }, [supabase]);

  useEffect(() => {
    if (!organizationId) return;

    async function fetchStats() {
      try {
        const sb = supabase as any;
        const [totalJobsResult, runningJobsResult, failedJobsResult, recentJobsResult, vendorStatsResult] = await Promise.all([
          sb
            .from('job_runs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
          sb
            .from('job_runs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'running'),
          sb
            .from('job_runs')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'failed')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
          sb
            .from('job_runs')
            .select('id, job_type, job_name, status, created_at, duration_ms, vendor_code')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(5),
          sb.rpc('get_vendor_eligibility_summary', { p_org_id: organizationId }),
        ]);

        setStats({
          totalJobs: totalJobsResult.count ?? 0,
          runningJobs: runningJobsResult.count ?? 0,
          failedJobs24h: failedJobsResult.count ?? 0,
          recentJobs: recentJobsResult.data || [],
          vendorStats: vendorStatsResult.data || [],
        });
      } catch (error) {
        console.error('Error fetching ops stats:', error);
        setStats({
          totalJobs: 0,
          runningJobs: 0,
          failedJobs24h: 0,
          recentJobs: [],
          vendorStats: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [supabase, organizationId]);

  const quickLinks = [
    { name: 'Job History', href: '/ops/jobs', icon: Clock, description: 'View all job runs' },
    { name: 'Scheduler', href: '/ops/scheduler', icon: Calendar, description: 'Manage job schedules' },
    { name: 'Age Up/Out Report', href: '/ops/reports/age-up-out', icon: FileText, description: 'Sedera age tracking' },
  ];

  const vendors = ['arm', 'sedera', 'zion', 'mphc', 'altrua'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
          <p className="text-slate-500">Monitor and manage system operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ops/scheduler">
            <Button variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Scheduler
            </Button>
          </Link>
          <Link href="/ops/jobs">
            <Button>
              <Clock className="w-4 h-4 mr-2" />
              View Jobs
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-100">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalJobs ?? 0}</p>
                <p className="text-sm text-slate-500">Total Job Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-100">
                <Activity className={`w-6 h-6 text-blue-600 ${stats?.runningJobs ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats?.runningJobs ?? 0}</p>
                <p className="text-sm text-slate-500">Running Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats?.failedJobs24h ?? 0}</p>
                <p className="text-sm text-slate-500">Failed (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <Server className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">Healthy</p>
                <p className="text-sm text-slate-500">System Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Eligibility Cards */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Vendor Eligibility</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {vendors.map((vendorCode) => {
            const vendor = vendorInfo[vendorCode] || { name: vendorCode.toUpperCase(), icon: Database, color: 'bg-slate-100 text-slate-600' };
            const vendorStat = stats?.vendorStats?.find(v => v.vendor_code === vendorCode);
            const VendorIcon = vendor.icon;

            return (
              <Link key={vendorCode} href={`/ops/vendor/${vendorCode}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${vendor.color}`}>
                        <VendorIcon className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-slate-900">{vendor.name}</span>
                    </div>
                    {vendorStat ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Runs</span>
                          <span className="font-medium">{vendorStat.total_runs}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Success</span>
                          <span className="font-medium text-emerald-600">{vendorStat.successful_runs}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Failed</span>
                          <span className="font-medium text-red-600">{vendorStat.failed_runs}</span>
                        </div>
                        {vendorStat.last_run_at && (
                          <p className="text-xs text-slate-400 pt-1">
                            Last run {formatDistanceToNow(new Date(vendorStat.last_run_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No runs yet</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Job Runs</CardTitle>
                <Link
                  href="/ops/jobs"
                  className="text-sm text-[#047474] hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {stats?.recentJobs && stats.recentJobs.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentJobs.map((job: any) => {
                    const config = statusConfig[job.status] || statusConfig.pending;
                    const StatusIcon = config.icon;

                    return (
                      <Link
                        key={job.id}
                        href={`/ops/jobs?id=${job.id}`}
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <StatusIcon className={`w-4 h-4 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 truncate">
                            {job.job_name || job.job_type}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                            {job.duration_ms && ` • ${(job.duration_ms / 1000).toFixed(1)}s`}
                            {job.vendor_code && (
                              <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                                {job.vendor_code.toUpperCase()}
                              </span>
                            )}
                          </p>
                        </div>
                        <Badge className={config.color}>{job.status}</Badge>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">No job runs yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
              >
                <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-[#047474] group-hover:text-white transition-colors">
                  <link.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">{link.name}</p>
                  <p className="text-xs text-slate-400">{link.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
