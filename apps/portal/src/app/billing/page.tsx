'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { 
  CreditCard, 
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Download,
  Loader2,
  AlertCircle,
  Receipt,
  Wallet,
} from 'lucide-react';
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

interface BillingRecord {
  id: string;
  description: string;
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
  card_type: string | null;
  expiration_date: string | null;
  is_default: boolean;
  status: string;
}

export default function BillingPage() {
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [paymentProfiles, setPaymentProfiles] = useState<PaymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState<{ amount: number; date: string } | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get profile to find member
    const { data: profile } = await supabase
      .from('profiles')
      .select('member_id')
      .eq('user_id', user.id)
      .single() as { data: { member_id: string } | null };

    if (!profile?.member_id) {
      setLoading(false);
      return;
    }

    setMemberId(profile.member_id);

    // Fetch billing history
    const { data: billing } = await (supabase as any)
      .from('billing')
      .select('*')
      .eq('member_id', profile.member_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (billing) {
      setBillingHistory(billing);
    }

    // Fetch payment profiles
    const { data: profiles } = await (supabase as any)
      .from('payment_profiles')
      .select('*')
      .eq('member_id', profile.member_id)
      .eq('status', 'active')
      .order('is_default', { ascending: false });

    if (profiles) {
      setPaymentProfiles(profiles);
    }

    // Fetch next scheduled payment from billing_schedules
    const { data: schedule } = await (supabase as any)
      .from('billing_schedules')
      .select('amount, next_billing_date')
      .eq('member_id', profile.member_id)
      .eq('status', 'active')
      .single();

    if (schedule) {
      setNextPayment({
        amount: schedule.amount,
        date: schedule.next_billing_date,
      });
    }

    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'Pending': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'Failed': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-slate-400" />;
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
    return <CreditCard className="h-5 w-5" />;
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Payments</h1>
        <p className="text-slate-500">View your billing history and manage payment methods</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
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
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
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
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
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

      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history" className="gap-2">
            <Receipt className="h-4 w-4" />
            Payment History
          </TabsTrigger>
          <TabsTrigger value="methods" className="gap-2">
            <Wallet className="h-4 w-4" />
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
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300" />
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
                          <Button variant="ghost" size="icon" title="Download Receipt">
                            <Download className="h-4 w-4" />
                          </Button>
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
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Method
              </Button>
            </CardHeader>
            <CardContent>
              {paymentProfiles.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500 mb-4">No payment methods on file</p>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Payment Method
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
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                          {getCardIcon(profile.card_type)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {profile.card_type || 'Card'} •••• {profile.card_last4}
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
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
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
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Auto-Pay is Enabled</p>
                    <p className="text-sm text-green-700">
                      Your monthly share will be automatically charged on the due date
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
