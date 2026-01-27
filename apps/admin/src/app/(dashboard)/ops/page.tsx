import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
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
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

async function getOpsStats() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const orgId = profile.organization_id;

  // Get job stats
  const [totalJobsResult, runningJobsResult, failedJobsResult, recentJobsResult] = await Promise.all([
    supabase
      .from('job_runs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('job_runs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'running'),
    supabase
      .from('job_runs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('job_runs')
      .select('id, job_type, job_name, status, created_at, duration_ms')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    totalJobs: totalJobsResult.count ?? 0,
    runningJobs: runningJobsResult.count ?? 0,
    failedJobs24h: failedJobsResult.count ?? 0,
    recentJobs: recentJobsResult.data || [],
  };
}

const statusConfig: Record<string, { icon: any; color: string }> = {
  pending: { icon: Clock, color: 'bg-slate-100 text-slate-600' },
  running: { icon: RefreshCw, color: 'bg-blue-100 text-blue-600' },
  completed: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-600' },
  cancelled: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
};

export default async function OpsPage() {
  const stats = await getOpsStats();

  const quickLinks = [
    { name: 'Job History', href: '/ops/jobs', icon: Clock, description: 'View all job runs' },
    { name: 'Scheduled Jobs', href: '/ops/scheduler', icon: Calendar, description: 'Manage job schedules' },
    { name: 'Vendor Sync', href: '/vendors', icon: Database, description: 'Vendor integrations' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
        <p className="text-slate-500">Monitor and manage system operations</p>
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
                <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
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
