'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@crm-eco/ui';
import { createClient } from '@crm-eco/lib/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CreditCard,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentProfileCard } from './PaymentProfileCard';

interface PaymentProfile {
  id: string;
  paymentType: 'credit_card' | 'bank_account';
  lastFour: string;
  cardType?: string;
  expirationDate?: string;
  accountType?: string;
  bankName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  isDefault: boolean;
  nickname?: string;
}

interface BillingSchedule {
  id: string;
  amount: number;
  frequency: string;
  billingDay: number;
  nextBillingDate: string;
  status: string;
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
}

interface MemberBillingTabProps {
  memberId: string;
}

export function MemberBillingTab({ memberId }: MemberBillingTabProps) {
  const [paymentProfiles, setPaymentProfiles] = useState<PaymentProfile[]>([]);
  const [billingSchedules, setBillingSchedules] = useState<BillingSchedule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadBillingData();
  }, [memberId]);

  async function loadBillingData() {
    setLoading(true);
    try {
      const db = supabase as any;
      
      const [profilesRes, schedulesRes, transactionsRes] = await Promise.all([
        db
          .from('payment_profiles')
          .select('*')
          .eq('member_id', memberId)
          .eq('is_active', true)
          .order('is_default', { ascending: false }),
        db
          .from('billing_schedules')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        db
          .from('billing_transactions')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (profilesRes.data) {
        setPaymentProfiles(
          (profilesRes.data as Array<Record<string, unknown>>).map((p) => ({
            id: p.id as string,
            paymentType: p.payment_type as 'credit_card' | 'bank_account',
            lastFour: p.last_four as string,
            cardType: p.card_type as string | undefined,
            expirationDate: p.expiration_date as string | undefined,
            accountType: p.account_type as string | undefined,
            bankName: p.bank_name as string | undefined,
            billingFirstName: p.billing_first_name as string | undefined,
            billingLastName: p.billing_last_name as string | undefined,
            isDefault: p.is_default as boolean,
            nickname: p.nickname as string | undefined,
          }))
        );
      }

      if (schedulesRes.data) {
        setBillingSchedules(
          (schedulesRes.data as Array<Record<string, unknown>>).map((s) => ({
            id: s.id as string,
            amount: s.amount as number,
            frequency: s.frequency as string,
            billingDay: s.billing_day as number,
            nextBillingDate: s.next_billing_date as string,
            status: s.status as string,
          }))
        );
      }

      if (transactionsRes.data) {
        setTransactions(
          (transactionsRes.data as Array<Record<string, unknown>>).map((t) => ({
            id: t.id as string,
            transactionType: t.transaction_type as string,
            amount: t.amount as number,
            status: t.status as string,
            createdAt: t.created_at as string,
            description: t.description as string | undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(profileId: string) {
    setProcessingId(profileId);
    try {
      const db = supabase as any;
      
      // Unset all defaults
      await db
        .from('payment_profiles')
        .update({ is_default: false })
        .eq('member_id', memberId)
        .eq('is_active', true);

      // Set new default
      await db
        .from('payment_profiles')
        .update({ is_default: true })
        .eq('id', profileId);

      toast.success('Default payment method updated');
      await loadBillingData();
    } catch (error) {
      toast.error('Failed to update default payment method');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteProfile(profileId: string) {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    setProcessingId(profileId);
    try {
      await (supabase as any)
        .from('payment_profiles')
        .update({ is_active: false, is_default: false })
        .eq('id', profileId);

      toast.success('Payment method deleted');
      setPaymentProfiles((prev) => prev.filter((p) => p.id !== profileId));
    } catch (error) {
      toast.error('Failed to delete payment method');
    } finally {
      setProcessingId(null);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  }

  function getStatusBadgeColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <Button size="sm" disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </CardHeader>
        <CardContent>
          {paymentProfiles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {paymentProfiles.map((profile) => (
                <PaymentProfileCard
                  key={profile.id}
                  profile={profile}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDeleteProfile}
                  isProcessing={processingId === profile.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <CreditCard className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No payment methods on file
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Billing Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {billingSchedules.length > 0 ? (
            <div className="space-y-3">
              {billingSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">${schedule.amount.toFixed(2)}</p>
                      <span className="text-sm text-slate-500 capitalize">
                        / {schedule.frequency}
                      </span>
                      <Badge className={getStatusBadgeColor(schedule.status)}>
                        {schedule.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      Billed on day {schedule.billingDay} of each{' '}
                      {schedule.frequency === 'monthly'
                        ? 'month'
                        : schedule.frequency === 'quarterly'
                        ? 'quarter'
                        : 'year'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Next billing</p>
                    <p className="font-medium">
                      {format(new Date(schedule.nextBillingDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No billing schedules
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(txn.status)}
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {txn.description || txn.transactionType}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(txn.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`font-semibold ${
                      txn.transactionType === 'refund' ? 'text-red-600' : 'text-slate-900'
                    }`}
                  >
                    {txn.transactionType === 'refund' ? '-' : ''}${Math.abs(txn.amount).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No transactions yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
