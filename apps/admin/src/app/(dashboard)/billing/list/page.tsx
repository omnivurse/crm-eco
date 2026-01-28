'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@crm-eco/ui';
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Eye,
  DollarSign,
  CreditCard,
  Building,
  Calendar,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { format, subDays, startOfMonth, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  member_id: string;
  amount: number;
  processing_fee: number;
  status: string;
  transaction_type: string;
  payment_method: string;
  decline_code: string | null;
  decline_category: string | null;
  error_message: string | null;
  authorize_transaction_id: string | null;
  description: string | null;
  retry_count: number;
  created_at: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  payment_profile?: {
    payment_type: string;
    last_four: string;
    card_type: string | null;
  };
}

type DatePreset = 'TD' | 'YD' | 'MO' | '7' | '30' | '60' | '90';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'TD', label: 'Today' },
  { key: 'YD', label: 'Yesterday' },
  { key: 'MO', label: 'This Month' },
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '60', label: '60 Days' },
  { key: '90', label: '90 Days' },
];

function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);

  switch (preset) {
    case 'TD':
      return { start: startOfDay(now), end };
    case 'YD':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'MO':
      return { start: startOfMonth(now), end };
    case '7':
      return { start: startOfDay(subDays(now, 7)), end };
    case '30':
      return { start: startOfDay(subDays(now, 30)), end };
    case '60':
      return { start: startOfDay(subDays(now, 60)), end };
    case '90':
      return { start: startOfDay(subDays(now, 90)), end };
    default:
      return { start: startOfDay(subDays(now, 30)), end };
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'refunded':
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'success': return 'bg-green-100 text-green-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'refunded': return 'bg-blue-100 text-blue-800';
    case 'pending':
    case 'processing': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

export default function BillingListPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient();

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single() as { data: { organization_id: string } | null };

      if (!profile) return;

      const { start, end } = getDateRange(datePreset);

      const { data, error } = await (supabase.from('billing_transactions') as any)
        .select(`
          *,
          member:members(first_name, last_name, email),
          payment_profile:payment_profiles(payment_type, last_four, card_type)
        `)
        .eq('organization_id', profile.organization_id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [supabase, datePreset]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = !searchQuery ||
        txn.member?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.member?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.member?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.authorize_transaction_id?.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
      const matchesType = typeFilter === 'all' || txn.transaction_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [transactions, searchQuery, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const successful = filteredTransactions.filter(t => t.status === 'success' && t.transaction_type === 'charge');
    const failed = filteredTransactions.filter(t => t.status === 'failed');
    const refunds = filteredTransactions.filter(t => t.transaction_type === 'refund');

    return {
      totalCollected: successful.reduce((sum, t) => sum + t.amount, 0),
      totalFailed: failed.reduce((sum, t) => sum + t.amount, 0),
      totalRefunded: refunds.reduce((sum, t) => sum + t.amount, 0),
      count: filteredTransactions.length,
      successCount: successful.length,
      failedCount: failed.length,
    };
  }, [filteredTransactions]);

  const exportToCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      const headers = ['Date', 'Time', 'Member', 'Email', 'Type', 'Amount', 'Fee', 'Status', 'Payment Method', 'Last 4', 'Transaction ID'];
      const rows = filteredTransactions.map((txn) => [
        format(new Date(txn.created_at), 'yyyy-MM-dd'),
        format(new Date(txn.created_at), 'HH:mm:ss'),
        txn.member ? `${txn.member.first_name} ${txn.member.last_name}` : '',
        txn.member?.email || '',
        txn.transaction_type,
        txn.transaction_type === 'refund' ? -Math.abs(txn.amount) : txn.amount,
        txn.processing_fee || 0,
        txn.status,
        txn.payment_profile?.card_type || txn.payment_profile?.payment_type || '',
        txn.payment_profile?.last_four || '',
        txn.authorize_transaction_id || '',
      ]);

      const csvContent = [headers.join(','), ...rows.map(row =>
        row.map(cell => {
          const str = String(cell);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      )].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing-${datePreset}-${format(new Date(), 'yyyyMMdd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredTransactions.length} transactions`);
    } catch (error) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/billing">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Billing Transactions</h1>
            <p className="text-slate-500">View and search payment transactions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadTransactions()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={exporting || loading}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export
          </Button>
        </div>
      </div>

      {/* Date Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {DATE_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant={datePreset === preset.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDatePreset(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">Collected ({stats.successCount})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalFailed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">Failed ({stats.failedCount})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalRefunded.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-sm text-muted-foreground">Refunded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.count}</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>{filteredTransactions.length} transactions found</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search member or transaction ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
          {showFilters && (
            <div className="flex items-center gap-4 pt-4 border-t mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Status:</span>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Type:</span>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="charge">Charge</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
              {(statusFilter !== 'all' || typeFilter !== 'all' || searchQuery) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setSearchQuery('');
                }}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-slate-500 text-sm">Date</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Type</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Payment</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm text-right">Amount</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                    <th className="pb-3 font-medium text-slate-500 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-3 text-sm">
                        <div>
                          <p className="font-medium">{format(new Date(txn.created_at), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-slate-500">{format(new Date(txn.created_at), 'h:mm a')}</p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        {txn.member ? (
                          <Link href={`/members/${txn.member_id}`} className="text-blue-600 hover:underline">
                            {txn.member.first_name} {txn.member.last_name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <Badge variant="outline" className="capitalize">{txn.transaction_type}</Badge>
                      </td>
                      <td className="py-3 text-sm">
                        {txn.payment_profile ? (
                          <span className="text-slate-600">
                            {txn.payment_profile.card_type || txn.payment_profile.payment_type} •••• {txn.payment_profile.last_four}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 text-sm text-right">
                        <span className={`font-semibold ${txn.transaction_type === 'refund' ? 'text-red-600' : ''}`}>
                          {txn.transaction_type === 'refund' ? '-' : ''}${Math.abs(txn.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(txn.status)}
                          <Badge className={getStatusBadgeColor(txn.status)}>{txn.status}</Badge>
                        </div>
                      </td>
                      <td className="py-3 text-sm text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(txn)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction?.authorize_transaction_id || selectedTransaction?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Member</p>
                  <p className="font-medium">
                    {selectedTransaction.member
                      ? `${selectedTransaction.member.first_name} ${selectedTransaction.member.last_name}`
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{selectedTransaction.member?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Amount</p>
                  <p className="font-medium text-lg">${selectedTransaction.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Processing Fee</p>
                  <p className="font-medium">${(selectedTransaction.processing_fee || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <Badge variant="outline" className="capitalize">{selectedTransaction.transaction_type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={getStatusBadgeColor(selectedTransaction.status)}>{selectedTransaction.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Payment Method</p>
                  <p className="font-medium">
                    {selectedTransaction.payment_profile
                      ? `${selectedTransaction.payment_profile.card_type || selectedTransaction.payment_profile.payment_type} •••• ${selectedTransaction.payment_profile.last_four}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="font-medium">{format(new Date(selectedTransaction.created_at), 'PPp')}</p>
                </div>
              </div>
              {selectedTransaction.status === 'failed' && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-800">Decline Reason</p>
                  <p className="text-sm text-red-700">{selectedTransaction.error_message || 'Unknown error'}</p>
                  {selectedTransaction.decline_code && (
                    <p className="text-xs text-red-600 mt-1">Code: {selectedTransaction.decline_code}</p>
                  )}
                </div>
              )}
              {selectedTransaction.description && (
                <div>
                  <p className="text-sm text-slate-500">Description</p>
                  <p className="text-sm">{selectedTransaction.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Close</Button>
            {selectedTransaction?.member_id && (
              <Link href={`/members/${selectedTransaction.member_id}`}>
                <Button>View Member</Button>
              </Link>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
