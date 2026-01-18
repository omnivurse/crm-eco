'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2,
  Filter,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Progress } from '@crm-eco/ui/components/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import { formatDistanceToNow, format } from 'date-fns';
import { getRecentJobs, getVendors, type RecentJob, type Vendor } from '../actions';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'validating', label: 'Validating' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'outline' },
    validating: { label: 'Validating', variant: 'outline' },
    processing: { label: 'Processing', variant: 'outline' },
    completed: { label: 'Completed', variant: 'default' },
    failed: { label: 'Failed', variant: 'destructive' },
    partially_completed: { label: 'Partial', variant: 'secondary' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={variant}>{label}</Badge>;
}

function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'processing':
    case 'validating':
      return <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-amber-500" />;
    default:
      return <FileText className="w-5 h-5 text-slate-400" />;
  }
}

export default function VendorJobsPage() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getRecentJobs({
        vendorId: vendorFilter !== 'all' ? vendorFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });

      if (result.success && result.data) {
        setJobs(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorFilter, statusFilter]);

  const fetchVendors = useCallback(async () => {
    const result = await getVendors();
    if (result.success && result.data) {
      setVendors(result.data);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const getProgressPercent = (job: RecentJob) => {
    if (job.total_rows === 0) return 0;
    return Math.round((job.processed_rows / job.total_rows) * 100);
  };

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
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Processing Jobs</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Monitor file processing status and history
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={fetchJobs} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card border border-slate-200 dark:border-slate-700">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-slate-400" />

            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card className="glass-card border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Processing Jobs</CardTitle>
          <CardDescription>File upload and processing history</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                No Jobs Found
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                No files have been uploaded yet.
              </p>
              <Link href="/crm/vendors/upload">
                <Button className="gap-2">
                  <FileText className="w-4 h-4" />
                  Upload File
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <FileStatusIcon status={job.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {job.file_name}
                          </h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {job.vendor_name} · {job.file_type}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={job.status} />
                          <Link href={`/crm/vendors/${job.vendor_id}`}>
                            <Button variant="ghost" size="sm" className="gap-1">
                              View <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {['processing', 'validating'].includes(job.status) && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Processing...</span>
                            <span>{getProgressPercent(job)}%</span>
                          </div>
                          <Progress value={getProgressPercent(job)} className="h-2" />
                        </div>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Total Rows</span>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {job.total_rows.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Processed</span>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {job.processed_rows.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Valid</span>
                          <p className="font-medium text-green-600">
                            {job.valid_rows.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Errors</span>
                          <p className={`font-medium ${job.error_rows > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                            {job.error_rows.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">New</span>
                          <p className="font-medium text-teal-600">
                            {job.new_records.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Updated</span>
                          <p className="font-medium text-blue-600">
                            {job.updated_records.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span>
                          Uploaded {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                        </span>
                        {job.completed_at && (
                          <span>
                            Completed {format(new Date(job.completed_at), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>

                      {/* Error Warning */}
                      {job.status === 'failed' && (
                        <div className="flex items-center gap-2 mt-3 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm text-red-600 dark:text-red-400">
                          <AlertTriangle className="w-4 h-4" />
                          Processing failed. Please check the file and try again.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
