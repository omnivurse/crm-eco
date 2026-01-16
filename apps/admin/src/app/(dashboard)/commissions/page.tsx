import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@crm-eco/ui';
import { DollarSign, Users, TrendingUp, Clock, Layers, FileText, CreditCard } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
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
  gross_amount: number;
  rate_pct: number;
  commission_amount: number;
  source_advisor_id: string | null;
  override_level: number | null;
  status: string;
  paid_at: string | null;
  payout_id: string | null;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface RecentCommission extends CommissionTransaction {
  advisor: { first_name: string; last_name: string } | null;
}

async function getCommissionStats() {
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

  const [tiersResult, pendingResult, paidThisMonthResult, payoutsResult] = await Promise.all([
    // Active commission tiers
    (supabase.from('commission_tiers') as any)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),
    // Pending commissions
    (supabase.from('commission_transactions') as any)
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'pending') as { data: { commission_amount: number }[] | null },
    // Paid this month
    (supabase.from('commission_transactions') as any)
      .select('commission_amount')
      .eq('organization_id', orgId)
      .eq('status', 'paid')
      .gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()) as { data: { commission_amount: number }[] | null },
    // Pending payouts
    (supabase.from('commission_payouts') as any)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['draft', 'pending', 'approved']),
  ]);

  const pendingAmount = (pendingResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );

  const paidThisMonth = (paidThisMonthResult.data || []).reduce(
    (sum, t) => sum + (t.commission_amount || 0),
    0
  );

  return {
    activeTiers: tiersResult.count ?? 0,
    pendingAmount,
    paidThisMonth,
    pendingPayouts: payoutsResult.count ?? 0,
  };
}

async function getRecentCommissions(): Promise<RecentCommission[]> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single() as { data: { organization_id: string } | null };

  if (!profile) return [];

  const { data: transactions, error } = await (supabase
    .from('commission_transactions') as any)
    .select(`
      id,
      advisor_id,
      commission_amount,
      rate_pct,
      status,
      transaction_type,
      created_at,
      advisor:advisors(first_name, last_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching commissions:', error);
    return [];
  }

  return (transactions || []) as unknown as RecentCommission[];
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'approved':
      return 'secondary';
    case 'pending':
      return 'outline';
    case 'held':
      return 'destructive';
    case 'reversed':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getTransactionTypeLabel = (type: string) => {
  switch (type) {
    case 'new_business':
      return 'New Business';
    case 'renewal':
      return 'Renewal';
    case 'override':
      return 'Override';
    case 'bonus':
      return 'Bonus';
    case 'chargeback':
      return 'Chargeback';
    default:
      return type;
  }
};

export default async function CommissionsPage() {
  const stats = await getCommissionStats();
  const recentCommissions = await getRecentCommissions();

  const statCards = [
    {
      title: 'Active Tiers',
      value: stats?.activeTiers ?? 0,
      description: 'Commission levels',
      icon: Layers,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      href: '/commissions/tiers',
    },
    {
      title: 'Pending Commissions',
      value: `$${(stats?.pendingAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      description: 'Awaiting approval',
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
      href: '/commissions/transactions?status=pending',
    },
    {
      title: 'Paid This Month',
      value: `$${(stats?.paidThisMonth ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      description: 'Commissions disbursed',
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-100',
      href: '/commissions/transactions?status=paid',
    },
    {
      title: 'Pending Payouts',
      value: stats?.pendingPayouts ?? 0,
      description: 'Ready for processing',
      icon: CreditCard,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      href: '/commissions/payouts',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commissions</h1>
        <p className="text-slate-500">Manage commission tiers, transactions, and payouts</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          </Link>
        ))}
      </div>

      {/* Recent Transactions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Commissions</CardTitle>
            <CardDescription>Latest commission transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCommissions.length > 0 ? (
              <ul className="space-y-3">
                {recentCommissions.map((commission) => (
                  <li key={commission.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {commission.advisor?.first_name} {commission.advisor?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getTransactionTypeLabel(commission.transaction_type)} @ {commission.rate_pct}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        ${commission.commission_amount?.toFixed(2)}
                      </p>
                      <Badge variant={getStatusBadgeVariant(commission.status)} className="text-xs">
                        {commission.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-500 py-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                No recent commissions to display
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common commission tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/commissions/tiers"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm">Manage Commission Tiers</p>
                  <p className="text-xs text-slate-500">Configure rates and thresholds</p>
                </div>
              </div>
            </Link>
            <Link
              href="/commissions/transactions"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Review Transactions</p>
                  <p className="text-xs text-slate-500">Approve or hold commissions</p>
                </div>
              </div>
            </Link>
            <Link
              href="/commissions/payouts"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Process Payouts</p>
                  <p className="text-xs text-slate-500">Generate and approve agent payouts</p>
                </div>
              </div>
            </Link>
            <Link
              href="/agents"
              className="block p-3 rounded-lg border hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-sm">Agent Commission Assignments</p>
                  <p className="text-xs text-slate-500">Assign tiers and view production</p>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
