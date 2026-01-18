import { Suspense } from 'react';
import Link from 'next/link';
import {
  Building2,
  Upload,
  Settings2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  TrendingUp,
  Activity,
  AlertTriangle,
  Plus,
  GitBranch,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import { getVendorStats, getVendors, getRecentJobs, getVendorChanges } from './actions';
import { formatDistanceToNow } from 'date-fns';

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color = 'teal',
  href,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'teal' | 'green' | 'amber' | 'red' | 'blue';
  href?: string;
}) {
  const colorClasses = {
    teal: 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 border-teal-100 dark:border-teal-900',
    green: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900',
    red: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900',
  };

  const iconBgClasses = {
    teal: 'bg-teal-100 dark:bg-teal-900/50',
    green: 'bg-green-100 dark:bg-green-900/50',
    amber: 'bg-amber-100 dark:bg-amber-900/50',
    red: 'bg-red-100 dark:bg-red-900/50',
    blue: 'bg-blue-100 dark:bg-blue-900/50',
  };

  const content = (
    <Card className={`${colorClasses[color]} border transition-all hover:shadow-md`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconBgClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Active', variant: 'default' },
    inactive: { label: 'Inactive', variant: 'secondary' },
    pending: { label: 'Pending', variant: 'outline' },
    suspended: { label: 'Suspended', variant: 'destructive' },
    completed: { label: 'Completed', variant: 'default' },
    processing: { label: 'Processing', variant: 'outline' },
    validating: { label: 'Validating', variant: 'outline' },
    failed: { label: 'Failed', variant: 'destructive' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
  };

  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// File Status Icon
function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'processing':
    case 'validating':
      return <RefreshCw className="w-4 h-4 text-teal-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-amber-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

// Severity Badge
function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
    normal: { label: 'Normal', className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' },
    high: { label: 'High', className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' },
    critical: { label: 'Critical', className: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' },
  };

  const { label, className } = config[severity] || config.normal;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

async function VendorHubContent() {
  const [statsResult, vendorsResult, jobsResult, changesResult] = await Promise.all([
    getVendorStats(),
    getVendors({ limit: 10 }),
    getRecentJobs({ limit: 5 }),
    getVendorChanges({ status: 'pending', limit: 5 }),
  ]);

  const stats = statsResult.data || {
    totalVendors: 0,
    activeVendors: 0,
    filesInProgress: 0,
    changesLast7Days: 0,
    pendingChanges: 0,
  };
  const vendors = vendorsResult.data || [];
  const recentJobs = jobsResult.data || [];
  const pendingChanges = changesResult.data?.changes || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-100 dark:bg-teal-900/50 rounded-lg">
            <Building2 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Vendor Hub</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Manage vendor integrations, file uploads, and data synchronization
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/crm/vendors/upload">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
          </Link>
          <Link href="/crm/vendors/connectors">
            <Button variant="outline" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Connectors
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Total Vendors"
          value={stats.totalVendors}
          icon={Building2}
          color="teal"
        />
        <StatCard
          title="Active Vendors"
          value={stats.activeVendors}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Files Processing"
          value={stats.filesInProgress}
          icon={RefreshCw}
          color="blue"
          href="/crm/vendors/jobs"
        />
        <StatCard
          title="Changes (7d)"
          value={stats.changesLast7Days}
          icon={Activity}
          color="amber"
        />
        <StatCard
          title="Pending Review"
          value={stats.pendingChanges}
          icon={AlertTriangle}
          color="red"
          href="/crm/vendors/changes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendors List */}
        <Card className="lg:col-span-2 glass-card border border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Vendors</CardTitle>
              <CardDescription>Connected vendor integrations</CardDescription>
            </div>
            <Link href="/crm/vendors">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {vendors.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 mb-4">No vendors configured yet</p>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Vendor
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {vendors.map((vendor) => (
                  <Link
                    key={vendor.id}
                    href={`/crm/vendors/${vendor.id}`}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                        {vendor.logo_url ? (
                          <img src={vendor.logo_url} alt={vendor.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{vendor.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {vendor.vendor_type.replace('_', ' ')} · {vendor.code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {vendor.last_sync_at && (
                        <span className="text-xs text-slate-400">
                          Last sync: {formatDistanceToNow(new Date(vendor.last_sync_at), { addSuffix: true })}
                        </span>
                      )}
                      <StatusBadge status={vendor.status} />
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Jobs */}
          <Card className="glass-card border border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Jobs</CardTitle>
                <CardDescription>Latest file processing</CardDescription>
              </div>
              <Link href="/crm/vendors/jobs">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No recent uploads</p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <FileStatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {job.file_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {job.vendor_name} · {job.processed_rows}/{job.total_rows} rows
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Changes */}
          <Card className="glass-card border border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Pending Changes</CardTitle>
                <CardDescription>Changes requiring review</CardDescription>
              </div>
              {pendingChanges.length > 0 && (
                <Badge variant="destructive">{stats.pendingChanges}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pendingChanges.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">All caught up!</p>
                  <p className="text-xs text-slate-400">No pending changes to review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingChanges.map((change) => (
                    <div
                      key={change.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-l-2 border-amber-400"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {change.change_type.replace(/_/g, ' ')}
                        </span>
                        <SeverityBadge severity={change.severity} />
                      </div>
                      {change.field_changed && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-medium">{change.field_changed}:</span>{' '}
                          <span className="text-red-500 line-through">{change.old_value || 'null'}</span>
                          {' → '}
                          <span className="text-green-600">{change.new_value || 'null'}</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {change.vendor_name} · {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                  <Link href="/crm/vendors/changes">
                    <Button variant="outline" size="sm" className="w-full mt-2 gap-2">
                      <GitBranch className="w-4 h-4" />
                      Review All Changes
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function VendorHubSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div>
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded mt-2" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="space-y-6">
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function VendorHubPage() {
  return (
    <Suspense fallback={<VendorHubSkeleton />}>
      <VendorHubContent />
    </Suspense>
  );
}
