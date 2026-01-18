import { Suspense } from 'react';
import Link from 'next/link';
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
  Building2,
  Upload,
  Settings2,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileText,
  TrendingUp,
  Activity,
  Loader2,
} from 'lucide-react';
import { getVendorStats, getVendors, getRecentJobs, getRecentChanges } from './actions';
import { formatDistanceToNow } from 'date-fns';

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  const iconBgClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    amber: 'bg-amber-100',
    red: 'bg-red-100',
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${iconBgClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-amber-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

// Change Severity Badge
function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'bg-slate-100 text-slate-600' },
    normal: { label: 'Normal', className: 'bg-blue-100 text-blue-600' },
    high: { label: 'High', className: 'bg-amber-100 text-amber-600' },
    critical: { label: 'Critical', className: 'bg-red-100 text-red-600' },
  };

  const { label, className } = config[severity] || config.normal;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default async function VendorsPage() {
  const [statsResult, vendorsResult, jobsResult, changesResult] = await Promise.all([
    getVendorStats(),
    getVendors({ limit: 10 }),
    getRecentJobs({ limit: 5 }),
    getRecentChanges({ limit: 5, status: 'pending' }),
  ]);

  const stats = statsResult.data || {
    totalVendors: 0,
    activeVendors: 0,
    filesInProgress: 0,
    changesLast7Days: 0,
  };
  const vendors = vendorsResult.data || [];
  const recentJobs = jobsResult.data || [];
  const recentChanges = changesResult.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Management</h1>
          <p className="text-slate-500 mt-1">
            Manage vendor integrations, file uploads, and data synchronization
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/vendors/upload">
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Manual Upload
            </Button>
          </Link>
          <Link href="/vendors/connectors">
            <Button variant="outline" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Configure Connectors
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={stats.totalVendors}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active Vendors"
          value={stats.activeVendors}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Files In Progress"
          value={stats.filesInProgress}
          icon={RefreshCw}
          color="amber"
        />
        <StatCard
          title="Changes (7d)"
          value={stats.changesLast7Days}
          icon={Activity}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vendors List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Vendors</CardTitle>
              <CardDescription>Connected vendor integrations</CardDescription>
            </div>
            <Link href="/vendors">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {vendors.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-4">No vendors configured yet</p>
                <p className="text-sm text-slate-400">
                  Contact your administrator to add vendor integrations
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vendors.map((vendor) => (
                  <Link
                    key={vendor.id}
                    href={`/vendors/${vendor.id}`}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-lg border flex items-center justify-center">
                        {vendor.logo_url ? (
                          <img src={vendor.logo_url} alt={vendor.name} className="w-6 h-6" />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{vendor.name}</p>
                        <p className="text-sm text-slate-500">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Jobs</CardTitle>
              <CardDescription>Latest file upload history</CardDescription>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No recent uploads</p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <FileStatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {job.file_name}
                        </p>
                        <p className="text-xs text-slate-500">
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

          {/* Recent Changes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Pending Changes</CardTitle>
                <CardDescription>Changes requiring review</CardDescription>
              </div>
              {recentChanges.length > 0 && (
                <Badge variant="destructive">{recentChanges.length}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {recentChanges.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">All caught up!</p>
                  <p className="text-xs text-slate-400">No pending changes to review</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChanges.map((change) => (
                    <div
                      key={change.id}
                      className="p-3 bg-slate-50 rounded-lg border-l-2 border-amber-400"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900">
                          {change.change_type.replace('_', ' ')}
                        </span>
                        <SeverityBadge severity={change.severity} />
                      </div>
                      {change.field_changed && (
                        <p className="text-xs text-slate-600">
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
                  <Link href="/vendors?tab=changes">
                    <Button variant="outline" size="sm" className="w-full mt-2">
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
