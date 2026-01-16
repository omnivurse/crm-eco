'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  Calendar,
  ArrowUpRight,
  Filter,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';

interface CommissionTransaction {
  id: string;
  advisor_id: string;
  enrollment_id: string | null;
  member_id: string | null;
  transaction_type: string;
  commission_amount: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  paid_at: string | null;
  members?: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function AgentCommissionsPage() {
  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const supabase = createClient();

  useEffect(() => {
    fetchCommissions();
  }, []);

  const fetchCommissions = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('user_id', user.id)
      .single() as { data: { id: string } | null };

    if (!advisor) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('commission_transactions')
        .select(`
          *,
          members (
            first_name,
            last_name
          )
        `)
        .eq('advisor_id', advisor.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTransactions(data);
      }
    } catch {
      // Commission tables may not exist
    }
    setLoading(false);
  };

  // Calculate stats
  const stats = {
    totalEarned: transactions.reduce((sum, t) => sum + (t.commission_amount || 0), 0),
    pendingPayout: transactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
    paid: transactions
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
    thisMonth: transactions
      .filter(t => {
        const date = new Date(t.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, t) => sum + (t.commission_amount || 0), 0),
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    
    if (periodFilter !== 'all') {
      const date = new Date(t.created_at);
      const now = new Date();
      
      if (periodFilter === 'this_month') {
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (periodFilter === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        if (date.getMonth() !== lastMonth.getMonth() || date.getFullYear() !== lastMonth.getFullYear()) {
          return false;
        }
      } else if (periodFilter === 'this_year') {
        if (date.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }
    }
    
    return true;
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <DollarSign className="h-12 w-12 animate-pulse text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Commissions</h1>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Earned</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${stats.totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">This Month</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${stats.thisMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending Payout</p>
                <p className="text-2xl font-bold text-amber-600">
                  ${stats.pendingPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Next Payout Date</p>
              <p className="text-sm text-blue-700">25th of each month</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-blue-900">Estimated Payout</p>
            <p className="text-lg font-bold text-blue-700">
              ${stats.pendingPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <CardTitle>Commission History</CardTitle>
            <div className="flex gap-2">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No commissions yet</h3>
              <p className="text-slate-500">
                Your commissions will appear here as you enroll members.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-slate-600">Date</th>
                    <th className="pb-3 font-medium text-slate-600">Member</th>
                    <th className="pb-3 font-medium text-slate-600">Type</th>
                    <th className="pb-3 font-medium text-slate-600">Amount</th>
                    <th className="pb-3 font-medium text-slate-600">Status</th>
                    <th className="pb-3 font-medium text-slate-600">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50">
                      <td className="py-4 text-sm text-slate-600">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4">
                        <p className="font-medium text-slate-900">
                          {transaction.members?.first_name} {transaction.members?.last_name}
                        </p>
                      </td>
                      <td className="py-4">
                        <Badge variant="outline">
                          {transaction.transaction_type}
                        </Badge>
                      </td>
                      <td className="py-4 font-medium text-green-600">
                        +${transaction.commission_amount.toFixed(2)}
                      </td>
                      <td className="py-4">
                        {getStatusBadge(transaction.status)}
                      </td>
                      <td className="py-4 text-sm text-slate-600">
                        {transaction.paid_at 
                          ? new Date(transaction.paid_at).toLocaleDateString()
                          : '-'}
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
