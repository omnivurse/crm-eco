'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format } from 'date-fns';
import Link from 'next/link';
import { ArrowLeft, Download, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  member_id: string;
  enrollment_id?: string;
  transaction_type: string;
  amount: number;
  processing_fee: number;
  status: string;
  authorize_transaction_id?: string;
  error_message?: string;
  description?: string;
  invoice_number?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  created_at: string;
  processed_at?: string;
  member?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  payment_profile?: {
    payment_type: string;
    last_four: string;
    card_type?: string;
  };
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'refunded':
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    case 'pending':
    case 'processing':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'pending':
    case 'processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'refunded':
      return 'bg-blue-100 text-blue-800';
    case 'voided':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getTransactionTypeBadge(type: string) {
  switch (type) {
    case 'charge':
      return 'bg-green-50 text-green-700';
    case 'refund':
      return 'bg-red-50 text-red-700';
    case 'void':
      return 'bg-gray-50 text-gray-700';
    case 'adjustment':
      return 'bg-blue-50 text-blue-700';
    default:
      return 'bg-gray-50 text-gray-700';
  }
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadTransactions();
  }, []);

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

      const { data, error } = await (supabase.from('billing_transactions') as any)
        .select(`
          *,
          member:members(first_name, last_name, email),
          payment_profile:payment_profiles(payment_type, last_four, card_type)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching transactions:', error);
        toast.error('Failed to load transactions');
      } else {
        setTransactions((data || []) as unknown as Transaction[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    setExporting(true);
    try {
      // CSV headers
      const headers = [
        'Date',
        'Time',
        'Member Name',
        'Member Email',
        'Type',
        'Amount',
        'Processing Fee',
        'Status',
        'Payment Method',
        'Last 4',
        'Transaction ID',
        'Description',
      ];

      // CSV rows
      const rows = transactions.map((txn) => [
        format(new Date(txn.created_at), 'yyyy-MM-dd'),
        format(new Date(txn.created_at), 'HH:mm:ss'),
        txn.member ? `${txn.member.first_name} ${txn.member.last_name}` : '',
        txn.member?.email || '',
        txn.transaction_type,
        txn.transaction_type === 'refund' ? -Math.abs(txn.amount) : txn.amount,
        txn.processing_fee,
        txn.status,
        txn.payment_profile?.card_type || txn.payment_profile?.payment_type || '',
        txn.payment_profile?.last_four || '',
        txn.authorize_transaction_id || '',
        txn.description || '',
      ]);

      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => {
            const str = String(cell);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${transactions.length} transactions`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/billing">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
            <p className="text-slate-500">All payment transactions</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportToCSV} disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-slate-500 text-sm">Date</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Member</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Type</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Payment Method</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Amount</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Status</th>
                  <th className="pb-3 font-medium text-slate-500 text-sm">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length > 0 ? (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="py-3 text-sm">
                        <div>
                          <p className="font-medium">
                            {format(new Date(txn.created_at), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(txn.created_at), 'h:mm a')}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 text-sm">
                        {txn.member ? (
                          <Link
                            href={`/members/${txn.member_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {txn.member.first_name} {txn.member.last_name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Unknown</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getTransactionTypeBadge(txn.transaction_type)}`}
                        >
                          {txn.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        {txn.payment_profile ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600">
                              {txn.payment_profile.card_type || txn.payment_profile.payment_type}
                            </span>
                            <span className="text-slate-400">
                              •••• {txn.payment_profile.last_four}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <span
                          className={`font-semibold ${
                            txn.transaction_type === 'refund' ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {txn.transaction_type === 'refund' ? '-' : ''}$
                          {Math.abs(txn.amount).toFixed(2)}
                        </span>
                        {txn.processing_fee > 0 && (
                          <p className="text-xs text-slate-500">
                            Fee: ${txn.processing_fee.toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(txn.status)}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(txn.status)}`}
                          >
                            {txn.status}
                          </span>
                        </div>
                        {txn.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                            {txn.error_message}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-sm text-slate-500">
                        {txn.authorize_transaction_id ? (
                          <code className="text-xs bg-slate-100 px-1 rounded">
                            {txn.authorize_transaction_id}
                          </code>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
