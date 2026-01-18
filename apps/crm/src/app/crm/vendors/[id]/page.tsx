'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Upload,
  FileText,
  GitBranch,
  Settings2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Mail,
  Phone,
  Globe,
  User,
  ExternalLink,
  MoreVertical,
  Edit,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { formatDistanceToNow, format } from 'date-fns';
import {
  getVendorById,
  getRecentJobs,
  getVendorChanges,
  reviewChange,
  type Vendor,
  type RecentJob,
  type VendorChange,
} from '../actions';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
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
    ignored: { label: 'Ignored', variant: 'secondary' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={variant}>{label}</Badge>;
}

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

export default function VendorDetailPage() {
  const params = useParams();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [changes, setChanges] = useState<VendorChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchVendor = useCallback(async () => {
    const result = await getVendorById(vendorId);
    if (result.success && result.data) {
      setVendor(result.data);
    }
  }, [vendorId]);

  const fetchJobs = useCallback(async () => {
    const result = await getRecentJobs({ vendorId, limit: 20 });
    if (result.success && result.data) {
      setJobs(result.data);
    }
  }, [vendorId]);

  const fetchChanges = useCallback(async () => {
    const result = await getVendorChanges({ vendorId, limit: 20 });
    if (result.success && result.data) {
      setChanges(result.data.changes);
    }
  }, [vendorId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchVendor(), fetchJobs(), fetchChanges()]);
      setLoading(false);
    };
    loadData();
  }, [fetchVendor, fetchJobs, fetchChanges]);

  const handleReviewChange = async (changeId: string, action: 'approve' | 'reject' | 'ignore') => {
    setActionLoading(changeId);
    try {
      const result = await reviewChange(changeId, action);
      if (result.success) {
        fetchChanges();
      }
    } catch (error) {
      console.error('Failed to review change:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-24">
        <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
          Vendor Not Found
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          The vendor you're looking for doesn't exist.
        </p>
        <Link href="/crm/vendors">
          <Button>Back to Vendors</Button>
        </Link>
      </div>
    );
  }

  const pendingChanges = changes.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/vendors">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-center">
              {vendor.logo_url ? (
                <img src={vendor.logo_url} alt={vendor.name} className="w-10 h-10 object-contain" />
              ) : (
                <Building2 className="w-8 h-8 text-slate-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vendor.name}</h1>
                <StatusBadge status={vendor.status} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {vendor.vendor_type.replace('_', ' ')} · {vendor.code}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/crm/vendors/upload?vendor=${vendorId}`}>
            <Button variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit Vendor
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings2 className="w-4 h-4 mr-2" />
                Configure Connectors
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Vendor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            Files
            {jobs.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {jobs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="changes" className="gap-2">
            Changes
            {pendingChanges.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingChanges.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contact Info */}
            <Card className="glass-card border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.contact_name && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-900 dark:text-white">{vendor.contact_name}</span>
                  </div>
                )}
                {vendor.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a href={`mailto:${vendor.contact_email}`} className="text-sm text-teal-600 hover:underline">
                      {vendor.contact_email}
                    </a>
                  </div>
                )}
                {vendor.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-900 dark:text-white">{vendor.contact_phone}</span>
                  </div>
                )}
                {vendor.website_url && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <a href={vendor.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline flex items-center gap-1">
                      {vendor.website_url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {!vendor.contact_name && !vendor.contact_email && !vendor.contact_phone && !vendor.website_url && (
                  <p className="text-sm text-slate-400">No contact information</p>
                )}
              </CardContent>
            </Card>

            {/* Integration Status */}
            <Card className="glass-card border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Integration Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Connection Type</span>
                  <Badge variant="outline">{vendor.connection_type}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Auto Sync</span>
                  {vendor.sync_enabled ? (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Enabled</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm">Disabled</span>
                    </div>
                  )}
                </div>
                {vendor.last_sync_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Last Sync</span>
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatDistanceToNow(new Date(vendor.last_sync_at), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="glass-card border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total Files</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{jobs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Pending Changes</span>
                  <span className={`text-lg font-bold ${pendingChanges.length > 0 ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                    {pendingChanges.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Created</span>
                  <span className="text-sm text-slate-900 dark:text-white">
                    {format(new Date(vendor.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {vendor.description && (
            <Card className="glass-card border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400">{vendor.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card className="glass-card border border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Uploaded Files</CardTitle>
                <CardDescription>File processing history for this vendor</CardDescription>
              </div>
              <Link href={`/crm/vendors/upload?vendor=${vendorId}`}>
                <Button className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload File
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                    No Files Yet
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Upload vendor files to start processing data.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                    >
                      <FileStatusIcon status={job.status} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white">{job.file_name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {job.file_type} · {job.total_rows.toLocaleString()} rows
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={job.status} />
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Changes Tab */}
        <TabsContent value="changes">
          <Card className="glass-card border border-slate-200 dark:border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detected Changes</CardTitle>
                <CardDescription>Changes detected from vendor file uploads</CardDescription>
              </div>
              <Link href={`/crm/vendors/changes?vendor=${vendorId}`}>
                <Button variant="outline" className="gap-2">
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {changes.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                    No Changes
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    No changes have been detected for this vendor.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {changes.map((change) => (
                    <div
                      key={change.id}
                      className={`p-4 rounded-lg border-l-2 ${
                        change.status === 'pending'
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-400'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {change.change_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-slate-500 ml-2">
                            {change.entity_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={change.severity} />
                          <StatusBadge status={change.status} />
                        </div>
                      </div>
                      {change.field_changed && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          <span className="font-medium">{change.field_changed}:</span>{' '}
                          <span className="text-red-500 line-through">{change.old_value || 'null'}</span>
                          {' → '}
                          <span className="text-green-600">{change.new_value || 'null'}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                        </span>
                        {change.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-green-500 hover:text-green-600 hover:bg-green-50"
                              onClick={() => handleReviewChange(change.id, 'approve')}
                              disabled={actionLoading === change.id}
                            >
                              {actionLoading === change.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleReviewChange(change.id, 'reject')}
                              disabled={actionLoading === change.id}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="glass-card border border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle>Vendor Settings</CardTitle>
              <CardDescription>Configure vendor integration settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                  Settings Coming Soon
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Vendor configuration options will be available here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
