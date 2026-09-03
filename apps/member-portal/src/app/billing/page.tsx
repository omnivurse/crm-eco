'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  CreditCard, 
  CurrencyDollar,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  CircleNotch,
  WarningCircle,
  Receipt,
  Wallet,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@crm-eco/ui/components/tabs';
import { toast } from 'sonner';
import { ReceiptDownloadButton } from '@/components/billing/ReceiptDownloadButton';
import {
  formatCoverageDateRange,
  formatCoverageReason,
} from '@crm-eco/lib';
import type { CoverageChangeSummary } from '@crm-eco/lib';
import { PageHeader } from '@/components/PageHeader';

interface BillingRecord {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  billing_type: string;
  created_at: string;
}

interface PaymentProfile {
  id: string;
  card_last4: string | null;
  last_four?: string | null;
  card_type: string | null;
  expiration_date: string | null;
  is_default: boolean | null;
  status: string | null;
}

interface MemberTransactionRow {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  billing_period_end: string | null;
  settled_at: string | null;
  transaction_type: string;
  created_at: string;
}

function mapTransactionRow(row: MemberTransactionRow): BillingRecord {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    status: row.status,
    due_date: row.billing_period_end,
    paid_at: row.settled_at,
    billing_type: row.transaction_type,
    created_at: row.created_at,
  };
}

export default function BillingPage() {
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [paymentProfiles, setPaymentProfiles] = useState<PaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState<{ amount: number; date: string } | null>(null);
  const [familyCoveredCount, setFamilyCoveredCount] = useState(0);
  const [familyRecentChanges, setFamilyRecentChanges] = useState<CoverageChangeSummary[]>([]);

  const fetchBillingData = useCallback(async () => {
    setLoading(true);

    try {
      const [profileRes, txRes, profilesRes, scheduleRes, familyRes] = await Promise.all([
        fetch('/api/member/profile'),
        fetch('/api/member/transactions?limit=50'),
        fetch('/api/member/payment-profiles'),
        fetch('/api/member/billing-schedule'),
        fetch('/api/member/dependents'),
      ]);

      if (profileRes.status === 401) return;
      if (!profileRes.ok) {
        console.error('[billing] profile fetch failed', profileRes.status);
        return;
      }

      const profilePayload = (await profileRes.json()) as {
        member?: { id: string };
      };
      if (!profilePayload.member?.id) return;

      setMemberId(profilePayload.member.id);

      if (txRes.ok) {
        const txPayload = (await txRes.json()) as { transactions?: MemberTransactionRow[] };
        setBillingHistory((txPayload.transactions ?? []).map(mapTransactionRow));
      }

      if (profilesRes.ok) {
        const profilesPayload = (await profilesRes.json()) as { profiles?: PaymentProfile[] };
        setPaymentProfiles(profilesPayload.profiles ?? []);
      }

      if (scheduleRes.ok) {
        const schedulePayload = (await scheduleRes.json()) as {
          schedule?: { amount: number; next_billing_date: string } | null;
        };
        if (schedulePayload.schedule) {
          setNextPayment({
            amount: schedulePayload.schedule.amount,
            date: schedulePayload.schedule.next_billing_date,
          });
        } else {
          setNextPayment(null);
        }
      }

      if (familyRes.ok) {
        const familyPayload = (await familyRes.json()) as {
          covered_count?: number;
          recent_changes?: CoverageChangeSummary[];
        };
        setFamilyCoveredCount(familyPayload.covered_count ?? 0);
        setFamilyRecentChanges(familyPayload.recent_changes ?? []);
      }
    } catch (error) {
      console.error('[billing] fetch failed', error);
      toast.error('Unable to load billing data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchBillingData());
  }, [fetchBillingData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircle weight="light" className="h-4 w-4 text-green-500" aria-hidden />;
      case 'Pending': return <Clock weight="light" className="h-4 w-4 text-amber-500" aria-hidden />;
      case 'Failed': return <XCircle weight="light" className="h-4 w-4 text-red-500" aria-hidden />;
      default: return <WarningCircle weight="light" className="h-4 w-4 text-slate-400" aria-hidden />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Failed': return 'bg-red-100 text-red-700';
      case 'Cancelled': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getCardIcon = (cardType: string | null) => {
    return <CreditCard weight="light" className="h-5 w-5" aria-hidden />;
  };

  const totalPaid = billingHistory
    .filter(b => b.status === 'Paid')
    .reduce((sum, b) => sum + b.amount, 0);

  const pendingAmount = billingHistory
    .filter(b => b.status === 'Pending')
    .reduce((sum, b) => sum + b.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--mp-teal)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Payments"
        description="View your billing history and manage payment methods"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(11,109,133,0.06)] flex items-center justify-center">
                <CurrencyDollar weight="light" className="h-6 w-6 text-[var(--mp-teal)]" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Paid</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${totalPaid.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(11,109,133,0.06)] flex items-center justify-center">
                <Clock weight="light" className="h-6 w-6 text-[var(--mp-teal)]" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${pendingAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(11,109,133,0.06)] flex items-center justify-center">
                <Calendar weight="light" className="h-6 w-6 text-[var(--mp-teal)]" aria-hidden />
              </div>
              <div>
                <p className="text-sm text-slate-500">Next Payment</p>
                {nextPayment ? (
                  <>
                    <p className="text-2xl font-bold text-slate-900">
                      ${nextPayment.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Due {new Date(nextPayment.date).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-medium text-slate-400">No upcoming</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Family on your plan</CardTitle>
          <CardDescription>
            Coverage changes can affect your household share amount
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{familyCoveredCount}</span> family
            member{familyCoveredCount === 1 ? '' : 's'} currently covered.
          </p>
          {familyRecentChanges.length > 0 ? (
            <ul className="space-y-2">
              {familyRecentChanges.map((change) => (
                <li
                  key={change.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{change.dependent_name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCoverageDateRange(change.effective_from, change.effective_to)}
                      {change.reason ? ` · ${formatCoverageReason(change.reason)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No recent family coverage changes.</p>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/dependents">Manage family members</Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history" className="gap-2">
            <Receipt weight="light" className="h-4 w-4" aria-hidden />
            Payment History
          </TabsTrigger>
          <TabsTrigger value="methods" className="gap-2">
            <Wallet weight="light" className="h-4 w-4" aria-hidden />
            Payment Methods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>View all your past payments and pending charges</CardDescription>
            </CardHeader>
            <CardContent>
              {billingHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" aria-hidden />
                  <p className="text-slate-500">No billing history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {billingHistory.map((record) => (
                    <div 
                      key={record.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(record.status)}
                        <div>
                          <p className="font-medium text-slate-900">
                            {record.description || 'Monthly Share'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {record.paid_at 
                              ? `Paid ${new Date(record.paid_at).toLocaleDateString()}`
                              : record.due_date 
                                ? `Due ${new Date(record.due_date).toLocaleDateString()}`
                                : new Date(record.created_at).toLocaleDateString()
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            ${record.amount.toFixed(2)}
                          </p>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </div>
                        {record.status === 'Paid' && (
                          <ReceiptDownloadButton
                            receipt={{
                              id: record.id,
                              description: record.description,
                              amount: record.amount,
                              paidAt: record.paid_at,
                              createdAt: record.created_at,
                              status: record.status,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your saved payment methods</CardDescription>
              </div>
              <Button className="gap-2" asChild>
                <Link href="/billing/methods/new">
                  <Plus weight="light" className="h-4 w-4" aria-hidden />
                  Add Method
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {paymentProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard weight="light" className="h-12 w-12 mx-auto mb-4 text-slate-300" aria-hidden />
                  <p className="text-slate-500 mb-4">No payment methods on file</p>
                  <Button variant="outline" className="gap-2" asChild>
                    <Link href="/billing/methods/new">
                      <Plus weight="light" className="h-4 w-4" aria-hidden />
                      Add Payment Method
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentProfiles.map((profile) => (
                    <div 
                      key={profile.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[rgba(11,109,133,0.06)] flex items-center justify-center text-[var(--mp-teal)]">
                          {getCardIcon(profile.card_type)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {profile.card_type || 'Card'} •••• {profile.card_last4 || profile.last_four}
                          </p>
                          <p className="text-sm text-slate-500">
                            Expires {profile.expiration_date || 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {profile.is_default && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-Pay Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Auto-Pay Settings</CardTitle>
              <CardDescription>
                Manage your automatic payment preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentProfiles.some((p) => p.is_default) ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle weight="light" className="h-5 w-5 text-green-600" aria-hidden />
                    <div>
                      <p className="font-medium text-green-900">Auto-Pay is Enabled</p>
                      <p className="text-sm text-green-700">
                        Your monthly share is automatically charged to your default payment method on the due date
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <WarningCircle weight="light" className="h-5 w-5 text-amber-600" aria-hidden />
                    <div>
                      <p className="font-medium text-amber-900">Auto-Pay is not set up</p>
                      <p className="text-sm text-amber-700">
                        Add a default payment method to charge your monthly share automatically.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
