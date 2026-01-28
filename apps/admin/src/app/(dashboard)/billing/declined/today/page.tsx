'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  XCircle,
  CheckCircle,
  Phone,
  Mail,
  User,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';

interface DeclinedTransaction {
  id: string;
  member_id: string;
  amount: number;
  payment_method: string;
  status: string;
  decline_code: string | null;
  decline_category: string | null;
  error_message: string | null;
  retry_count: number;
  original_transaction_id: string | null;
  created_at: string;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  payment_profile?: {
    id: string;
    payment_type: string;
    last_four: string;
    card_type: string | null;
    bank_name: string | null;
  };
}

const DECLINE_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'insufficient_funds', label: 'Insufficient Funds' },
  { value: 'card_expired', label: 'Card Expired' },
  { value: 'card_declined', label: 'Card Declined' },
  { value: 'invalid_account', label: 'Invalid Account' },
  { value: 'fraud', label: 'Fraud Suspected' },
  { value: 'network_error', label: 'Network Error' },
  { value: 'other', label: 'Other' },
];

export default function DeclinedTodayPage() {
  const [transactions, setTransactions] = useState<DeclinedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<DeclinedTransaction | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const supabase = createClient();

  const fetchDeclinedToday = async () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from('billing_transactions')
        .select(`
          *,
          member:members(id, first_name, last_name, email, phone),
          payment_profile:payment_profiles(id, payment_type, last_four, card_type, bank_name)
        `)
        .eq('status', 'failed')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching declined transactions:', error);
      toast.error('Failed to load declined transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeclinedToday();
  }, []);

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      !searchQuery ||
      txn.member?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.member?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.member?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !categoryFilter || txn.decline_category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleRetry = async (transaction: DeclinedTransaction) => {
    setRetryingId(transaction.id);
    try {
      // Create a new retry transaction
      const { data: newTxn, error } = await supabase
        .from('billing_transactions')
        .insert({
          member_id: transaction.member_id,
          payment_profile_id: transaction.payment_profile?.id,
          amount: transaction.amount,
          payment_method: transaction.payment_method,
          status: 'pending',
          original_transaction_id: transaction.original_transaction_id || transaction.id,
          retry_count: (transaction.retry_count || 0) + 1,
          transaction_type: 'retry',
        })
        .select()
        .single();

      if (error) throw error;

      // Log the retry action to audit
      await supabase.from('billing_audit_log').insert({
        action: 'transaction_retry',
        entity_type: 'billing_transaction',
        entity_id: newTxn.id,
        details: {
          original_transaction_id: transaction.id,
          amount: transaction.amount,
          retry_count: (transaction.retry_count || 0) + 1,
        },
      });

      toast.success('Payment retry initiated');
      setShowRetryModal(false);
      setSelectedTransaction(null);
      fetchDeclinedToday();
    } catch (error) {
      console.error('Error retrying payment:', error);
      toast.error('Failed to retry payment');
    } finally {
      setRetryingId(null);
    }
  };

  const handleBulkRetry = async () => {
    if (selectedIds.size === 0) {
      toast.error('No transactions selected');
      return;
    }

    setBulkRetrying(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      const transaction = transactions.find((t) => t.id === id);
      if (!transaction) continue;

      try {
        const { error } = await supabase.from('billing_transactions').insert({
          member_id: transaction.member_id,
          payment_profile_id: transaction.payment_profile?.id,
          amount: transaction.amount,
          payment_method: transaction.payment_method,
          status: 'pending',
          original_transaction_id: transaction.original_transaction_id || transaction.id,
          retry_count: (transaction.retry_count || 0) + 1,
          transaction_type: 'retry',
        });

        if (error) throw error;
        successCount++;
      } catch {
        failCount++;
      }
    }

    // Log bulk retry to audit
    await supabase.from('billing_audit_log').insert({
      action: 'bulk_transaction_retry',
      entity_type: 'billing_transaction',
      entity_id: null,
      details: {
        transaction_count: selectedIds.size,
        success_count: successCount,
        fail_count: failCount,
      },
    });

    toast.success(`Retried ${successCount} transactions${failCount > 0 ? `, ${failCount} failed` : ''}`);
    setSelectedIds(new Set());
    setBulkRetrying(false);
    fetchDeclinedToday();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransactions.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getCategoryBadgeColor = (category: string | null) => {
    switch (category) {
      case 'insufficient_funds':
        return 'bg-amber-100 text-amber-700';
      case 'card_expired':
        return 'bg-orange-100 text-orange-700';
      case 'card_declined':
        return 'bg-red-100 text-red-700';
      case 'fraud':
        return 'bg-purple-100 text-purple-700';
      case 'network_error':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const exportDeclines = () => {
    const csv = [
      ['Transaction ID', 'Member', 'Email', 'Amount', 'Payment Method', 'Decline Code', 'Decline Category', 'Error', 'Retry Count', 'Time'].join(','),
      ...filteredTransactions.map((txn) =>
        [
          txn.id,
          `"${txn.member?.first_name || ''} ${txn.member?.last_name || ''}"`,
          txn.member?.email || '',
          txn.amount,
          txn.payment_method,
          txn.decline_code || '',
          txn.decline_category || '',
          `"${txn.error_message || ''}"`,
          txn.retry_count || 0,
          new Date(txn.created_at).toLocaleString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `declined-today-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDeclinedAmount = filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const categoryCounts = filteredTransactions.reduce((acc, t) => {
    const cat = t.decline_category || 'uncategorized';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today's Declined Payments</h1>
          <p className="text-muted-foreground">
            {filteredTransactions.length} declined transactions totaling {formatCurrency(totalDeclinedAmount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportDeclines}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={fetchDeclinedToday}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Declined</p>
                <p className="text-lg font-bold">{filteredTransactions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {Object.entries(categoryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, count]) => (
            <Card key={category}>
              <CardContent className="pt-4">
                <div>
                  <p className="text-xs text-muted-foreground capitalize">{category.replace('_', ' ')}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <select
                className="border rounded px-3 py-2 text-sm"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {DECLINE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <Button onClick={handleBulkRetry} disabled={bulkRetrying}>
                  {bulkRetrying ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Retry Selected ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="animate-pulse p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded" />
              ))}
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No declined payments today</p>
              <p className="text-sm text-muted-foreground">All payments are processing successfully</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="py-3 px-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginatedTransactions.length && paginatedTransactions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="py-3 px-4 text-left font-medium text-slate-600">Member</th>
                    <th className="py-3 px-4 text-left font-medium text-slate-600">Payment Method</th>
                    <th className="py-3 px-4 text-right font-medium text-slate-600">Amount</th>
                    <th className="py-3 px-4 text-left font-medium text-slate-600">Decline Reason</th>
                    <th className="py-3 px-4 text-center font-medium text-slate-600">Retries</th>
                    <th className="py-3 px-4 text-left font-medium text-slate-600">Time</th>
                    <th className="py-3 px-4 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(txn.id)}
                          onChange={() => toggleSelect(txn.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-full">
                            <User className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {txn.member?.first_name} {txn.member?.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{txn.member?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {txn.payment_profile?.payment_type === 'card' ? (
                            <CreditCard className="h-4 w-4 text-slate-500" />
                          ) : (
                            <Building2 className="h-4 w-4 text-slate-500" />
                          )}
                          <span className="text-sm">
                            {txn.payment_profile?.card_type || txn.payment_profile?.bank_name || 'Unknown'} ****
                            {txn.payment_profile?.last_four}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-red-600">{formatCurrency(txn.amount)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {txn.decline_category && (
                            <Badge className={getCategoryBadgeColor(txn.decline_category)}>
                              {txn.decline_category.replace('_', ' ')}
                            </Badge>
                          )}
                          {txn.decline_code && (
                            <p className="text-xs text-muted-foreground font-mono">{txn.decline_code}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={txn.retry_count > 2 ? 'destructive' : 'secondary'}>
                          {txn.retry_count || 0}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(txn.created_at).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTransaction(txn);
                              setShowRetryModal(true);
                            }}
                            disabled={retryingId === txn.id}
                          >
                            {retryingId === txn.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-1">Retry</span>
                          </Button>
                          {txn.member?.phone && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`tel:${txn.member.phone}`}>
                                <Phone className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {txn.member?.email && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={`mailto:${txn.member.email}`}>
                                <Mail className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Retry Confirmation Modal */}
      <Dialog open={showRetryModal} onOpenChange={setShowRetryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry Payment</DialogTitle>
            <DialogDescription>
              Are you sure you want to retry this payment? The member will be charged again.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <div className="p-2 bg-white rounded-full">
                  <User className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedTransaction.member?.first_name} {selectedTransaction.member?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedTransaction.member?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Previous Retries</p>
                  <p className="text-lg font-bold">{selectedTransaction.retry_count || 0}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedTransaction.payment_profile?.payment_type === 'card' ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  <span>
                    {selectedTransaction.payment_profile?.card_type ||
                      selectedTransaction.payment_profile?.bank_name ||
                      'Unknown'}{' '}
                    ****{selectedTransaction.payment_profile?.last_four}
                  </span>
                </div>
              </div>

              {selectedTransaction.error_message && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    {selectedTransaction.error_message}
                  </p>
                </div>
              )}

              {(selectedTransaction.retry_count || 0) >= 3 && (
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    This payment has already been retried {selectedTransaction.retry_count} times. Consider contacting
                    the member to update their payment method.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetryModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTransaction && handleRetry(selectedTransaction)}
              disabled={retryingId !== null}
            >
              {retryingId ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
