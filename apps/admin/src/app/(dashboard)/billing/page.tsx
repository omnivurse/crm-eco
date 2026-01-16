import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@crm-eco/ui';
import {
  CreditCard,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';

interface BillingStats {
  totalCollected: number;
  pendingPayments: number;
  failedPayments: number;
  activeSchedules: number;
}

interface RecentTransaction {
  id: string;
  member_id: string;
  amount: number;
  status: string;
  transaction_type: string;
  created_at: string;
  description?: string;
  member?: {
    first_name: string;
    last_name: string;
  };
}

async function getBillingStats(): Promise<BillingStats | null> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return null;

  const orgId = profile.organization_id;

  // Get billing statistics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  
  const [
    collectedResult,
    pendingResult,
    failedResult,
    schedulesResult,
  ] = await Promise.all([
    // Total collected this month
    db
      .from('billing_transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('status', 'success')
      .eq('transaction_type', 'charge')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    // Pending payments
    db
      .from('billing_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['pending', 'processing']),
    // Failed payments (unresolved)
    db
      .from('billing_failures')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('resolved', false),
    // Active billing schedules
    db
      .from('billing_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
  ]);

  const totalCollected = ((collectedResult.data || []) as { amount: number }[]).reduce(
    (sum: number, t: { amount: number }) => sum + (t.amount || 0),
    0
  );

  return {
    totalCollected,
    pendingPayments: pendingResult.count ?? 0,
    failedPayments: failedResult.count ?? 0,
    activeSchedules: schedulesResult.count ?? 0,
  };
}

async function getRecentTransactions(): Promise<RecentTransaction[]> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: transactions, error } = await (supabase as any)
    .from('billing_transactions')
    .select(`
      id,
      member_id,
      amount,
      status,
      transaction_type,
      created_at,
      description,
      member:members(first_name, last_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (transactions || []) as unknown as RecentTransaction[];
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
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
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default async function BillingPage() {
  const [stats, recentTransactions] = await Promise.all([
    getBillingStats(),
    getRecentTransactions(),
  ]);

  const statCards = [
    {
      title: 'Collected This Month',
      value: `$${(stats?.totalCollected ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      description: 'Total successful payments',
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Active Schedules',
      value: stats?.activeSchedules ?? 0,
      description: 'Recurring billing setups',
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Pending Payments',
      value: stats?.pendingPayments ?? 0,
      description: 'Awaiting processing',
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Failed Payments',
      value: stats?.failedPayments ?? 0,
      description: 'Require attention',
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100',
      href: '/billing/failures',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-500">Manage payments, transactions, and billing schedules</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const cardContent = (
            <Card className={card.href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                </div>
                <p className="text-xs text-slate-500 mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );

          return card.href ? (
            <Link key={card.title} href={card.href}>
              {cardContent}
            </Link>
          ) : (
            <div key={card.title}>{cardContent}</div>
          );
        })}
      </div>

      {/* Recent Transactions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest payment activity</CardDescription>
            </div>
            <Link
              href="/billing/transactions"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(txn.status)}
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {txn.member
                            ? `${txn.member.first_name} ${txn.member.last_name}`
                            : 'Unknown Member'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {txn.description || txn.transaction_type} •{' '}
                          {formatDistanceToNow(new Date(txn.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          txn.transaction_type === 'refund' ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {txn.transaction_type === 'refund' ? '-' : ''}$
                        {Math.abs(txn.amount).toFixed(2)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadgeColor(txn.status)}`}
                      >
                        {txn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CreditCard className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common billing tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/billing/transactions"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">View Transactions</p>
                  <p className="text-xs text-slate-500">Browse all payment history</p>
                </div>
              </div>
            </Link>
            <Link
              href="/billing/failures"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-sm">Failed Payments</p>
                  <p className="text-xs text-slate-500">Resolve payment issues</p>
                </div>
              </div>
            </Link>
            <Link
              href="/members"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Manage Payment Methods</p>
                  <p className="text-xs text-slate-500">View member payment profiles</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
