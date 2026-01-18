'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GitBranch,
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
  RefreshCw,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import {
  getVendorChanges,
  getVendors,
  reviewChange,
  bulkReviewChanges,
  type VendorChange,
  type Vendor,
} from '../actions';

const CHANGE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'new_enrollment', label: 'New Enrollment' },
  { value: 'termination', label: 'Termination' },
  { value: 'demographic_update', label: 'Demographic Update' },
  { value: 'plan_change', label: 'Plan Change' },
  { value: 'address_change', label: 'Address Change' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'dependent_add', label: 'Dependent Add' },
  { value: 'dependent_remove', label: 'Dependent Remove' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ignored', label: 'Ignored' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'outline' },
    approved: { label: 'Approved', variant: 'default' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    ignored: { label: 'Ignored', variant: 'secondary' },
    applied: { label: 'Applied', variant: 'default' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' as const };

  return <Badge variant={variant}>{label}</Badge>;
}

export default function VendorChangesPage() {
  const [changes, setChanges] = useState<VendorChange[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);

  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [severityFilter, setSeverityFilter] = useState('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVendorChanges({
        vendorId: vendorFilter !== 'all' ? vendorFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      if (result.success && result.data) {
        setChanges(result.data.changes);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch changes:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorFilter, statusFilter, severityFilter, page, pageSize]);

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
    fetchChanges();
  }, [fetchChanges]);

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

  const handleBulkAction = async (action: 'approve' | 'reject' | 'ignore') => {
    if (selectedIds.size === 0) return;

    setActionLoading('bulk');
    try {
      const result = await bulkReviewChanges(Array.from(selectedIds), action);
      if (result.success) {
        setSelectedIds(new Set());
        fetchChanges();
      }
    } catch (error) {
      console.error('Failed to bulk review changes:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === changes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(changes.map((c) => c.id)));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

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
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
              <GitBranch className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Review Changes</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Review and approve vendor data changes
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={fetchChanges} disabled={loading} className="gap-2">
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

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  {selectedIds.size} selected
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={actionLoading === 'bulk'}>
                      {actionLoading === 'bulk' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Bulk Actions'
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleBulkAction('approve')}>
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Approve All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('reject')}>
                      <XCircle className="w-4 h-4 mr-2 text-red-500" />
                      Reject All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('ignore')}>
                      <Ban className="w-4 h-4 mr-2 text-slate-400" />
                      Ignore All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Changes List */}
      <Card className="glass-card border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Changes</CardTitle>
              <CardDescription>{total} total changes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                No Changes Found
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {statusFilter === 'pending'
                  ? 'All changes have been reviewed!'
                  : 'No changes match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm font-medium text-slate-500">
                <Checkbox
                  checked={selectedIds.size === changes.length && changes.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <div className="w-32">Vendor</div>
                <div className="w-40">Change Type</div>
                <div className="flex-1">Details</div>
                <div className="w-20">Severity</div>
                <div className="w-24">Status</div>
                <div className="w-32">Detected</div>
                <div className="w-32">Actions</div>
              </div>

              {/* Change Rows */}
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(change.id)}
                    onCheckedChange={() => toggleSelect(change.id)}
                  />
                  <div className="w-32 text-sm font-medium text-slate-900 dark:text-white truncate">
                    {change.vendor_name}
                  </div>
                  <div className="w-40 text-sm text-slate-600 dark:text-slate-400">
                    {change.change_type.replace(/_/g, ' ')}
                  </div>
                  <div className="flex-1 text-sm">
                    {change.field_changed ? (
                      <div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {change.field_changed}:
                        </span>{' '}
                        <span className="text-red-500 line-through">
                          {change.old_value || 'null'}
                        </span>{' '}
                        →{' '}
                        <span className="text-green-600">
                          {change.new_value || 'null'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">No field details</span>
                    )}
                  </div>
                  <div className="w-20">
                    <SeverityBadge severity={change.severity} />
                  </div>
                  <div className="w-24">
                    <StatusBadge status={change.status} />
                  </div>
                  <div className="w-32 text-xs text-slate-400">
                    {formatDistanceToNow(new Date(change.detected_at), { addSuffix: true })}
                  </div>
                  <div className="w-32 flex items-center gap-1">
                    {change.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-50"
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
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleReviewChange(change.id, 'reject')}
                          disabled={actionLoading === change.id}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          onClick={() => handleReviewChange(change.id, 'ignore')}
                          disabled={actionLoading === change.id}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-sm text-slate-500">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-500">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
