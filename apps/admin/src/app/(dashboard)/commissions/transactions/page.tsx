'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui';
import { Loader2, MoreVertical, CheckCircle, XCircle, Clock, Pause, RotateCcw, DollarSign } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
// Commission transaction type (tables may not be in generated types yet)
interface CommissionTransaction {
  id: string;
  organization_id: string;
  advisor_id: string;
  enrollment_id: string | null;
  member_id: string | null;
  transaction_type: string;
  period_start: string;
  period_end: string;
  gross_amount: number | null;
  rate_pct: number | null;
  commission_amount: number | null;
  source_advisor_id: string | null;
  override_level: number | null;
  status: string;
  paid_at: string | null;
  payout_id: string | null;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  advisor: { first_name: string; last_name: string } | null;
  member: { first_name: string; last_name: string } | null;
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'held', label: 'Held' },
  { value: 'reversed', label: 'Reversed' },
];

const transactionTypeLabels: Record<string, string> = {
  new_business: 'New Business',
  renewal: 'Renewal',
  override: 'Override',
  bonus: 'Bonus',
  chargeback: 'Chargeback',
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'approved':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'held':
    case 'reversed':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function CommissionTransactionsPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTransactions();
  }, [statusFilter]);

  async function loadTransactions() {
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

      let query = (supabase
        .from('commission_transactions') as any)
        .select(`
          *,
          advisor:advisors(first_name, last_name),
          member:members(first_name, last_name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading transactions:', error);
        toast.error('Failed to load transactions');
      } else {
        setTransactions((data || []) as unknown as CommissionTransaction[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTransactionStatus(transactionId: string, newStatus: string, notes?: string) {
    setProcessingId(transactionId);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await (supabase
        .from('commission_transactions') as any)
        .update(updateData)
        .eq('id', transactionId);

      if (error) throw error;

      toast.success(`Transaction ${newStatus}`);
      await loadTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error('Failed to update transaction');
    } finally {
      setProcessingId(null);
    }
  }

  async function bulkUpdateStatus(newStatus: string) {
    if (selectedIds.size === 0) {
      toast.error('No transactions selected');
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await (supabase
        .from('commission_transactions') as any)
        .update(updateData)
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} transactions updated to ${newStatus}`);
      setSelectedIds(new Set());
      await loadTransactions();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update transactions');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  }

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const totalSelected = transactions
    .filter(t => selectedIds.has(t.id))
    .reduce((sum, t) => sum + (t.commission_amount || 0), 0);

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-3 text-slate-500">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Transactions</h1>
          <p className="text-slate-500">
            Review and manage individual commission transactions
          </p>
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {pendingCount > 0 && (
                <Badge variant="outline">
                  {pendingCount} pending
                </Badge>
              )}
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">
                  {selectedIds.size} selected (${totalSelected.toFixed(2)})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkUpdateStatus('approved')}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => bulkUpdateStatus('held')}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Hold
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>{transactions.length} transactions found</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">Commission transactions will appear here once enrollments are processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Agent</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Type</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Gross</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Rate</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Commission</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Period</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Status</th>
                    <th className="pb-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(transaction.id)}
                          onChange={() => toggleSelect(transaction.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium">
                            {transaction.advisor?.first_name} {transaction.advisor?.last_name}
                          </p>
                          {transaction.member && (
                            <p className="text-xs text-slate-500">
                              Member: {transaction.member.first_name} {transaction.member.last_name}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={transaction.transaction_type === 'chargeback' ? 'text-red-600' : ''}>
                          {transactionTypeLabels[transaction.transaction_type] || transaction.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        ${transaction.gross_amount?.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {transaction.rate_pct}%
                      </td>
                      <td className="py-3 pr-4 font-mono font-medium">
                        <span className={transaction.transaction_type === 'chargeback' ? 'text-red-600' : 'text-green-600'}>
                          {transaction.transaction_type === 'chargeback' ? '-' : ''}${Math.abs(transaction.commission_amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {format(new Date(transaction.period_start), 'MMM yyyy')}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={getStatusBadgeVariant(transaction.status)}>
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={processingId === transaction.id}>
                              {processingId === transaction.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {transaction.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => updateTransactionStatus(transaction.id, 'approved')}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateTransactionStatus(transaction.id, 'held')}>
                                  <Pause className="mr-2 h-4 w-4 text-yellow-600" />
                                  Hold
                                </DropdownMenuItem>
                              </>
                            )}
                            {transaction.status === 'held' && (
                              <DropdownMenuItem onClick={() => updateTransactionStatus(transaction.id, 'approved')}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {transaction.status === 'approved' && (
                              <>
                                <DropdownMenuItem onClick={() => updateTransactionStatus(transaction.id, 'held')}>
                                  <Pause className="mr-2 h-4 w-4 text-yellow-600" />
                                  Hold
                                </DropdownMenuItem>
                              </>
                            )}
                            {['pending', 'approved', 'held'].includes(transaction.status) && (
                              <DropdownMenuItem
                                onClick={() => updateTransactionStatus(transaction.id, 'reversed')}
                                className="text-red-600"
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reverse
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
