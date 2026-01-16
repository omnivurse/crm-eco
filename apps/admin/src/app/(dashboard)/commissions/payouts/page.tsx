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
import { Loader2, MoreVertical, CheckCircle, Play, FileText, DollarSign, Plus, Users } from 'lucide-react';
import { format } from 'date-fns';
// Commission payout type (tables may not be in generated types yet)
interface CommissionPayout {
  id: string;
  organization_id: string;
  advisor_id: string;
  period_start: string;
  period_end: string;
  total_commissions: number | null;
  total_overrides: number | null;
  total_bonuses: number | null;
  total_chargebacks: number | null;
  net_payout: number | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  advisor: { first_name: string; last_name: string } | null;
}

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'approved':
    case 'processing':
      return 'secondary';
    case 'draft':
    case 'pending':
      return 'outline';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

export default function CommissionPayoutsPage() {
  const supabase = createClient();
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    loadPayouts();
  }, [statusFilter]);

  async function loadPayouts() {
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
      setOrganizationId(profile.organization_id);

      let query = (supabase
        .from('commission_payouts') as any)
        .select(`
          *,
          advisor:advisors(first_name, last_name)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading payouts:', error);
        toast.error('Failed to load payouts');
      } else {
        setPayouts((data || []) as unknown as CommissionPayout[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generatePayouts() {
    if (!organizationId) return;

    setGenerating(true);
    try {
      // Get the current period (last month)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get all approved transactions that haven't been paid out
      const { data: approvedTransactions, error: txError } = await (supabase
        .from('commission_transactions') as any)
        .select('advisor_id, commission_amount, transaction_type')
        .eq('organization_id', organizationId)
        .eq('status', 'approved')
        .is('payout_id', null) as { data: { advisor_id: string; commission_amount: number | null; transaction_type: string }[] | null; error: Error | null };

      if (txError) throw txError;

      if (!approvedTransactions || approvedTransactions.length === 0) {
        toast.info('No approved transactions to generate payouts for');
        return;
      }

      // Group by advisor
      const byAdvisor: Record<string, {
        total: number;
        overrides: number;
        bonuses: number;
        chargebacks: number;
      }> = {};

      for (const tx of approvedTransactions) {
        if (!tx.advisor_id) continue;

        if (!byAdvisor[tx.advisor_id]) {
          byAdvisor[tx.advisor_id] = { total: 0, overrides: 0, bonuses: 0, chargebacks: 0 };
        }

        const amount = tx.commission_amount || 0;

        switch (tx.transaction_type) {
          case 'override':
            byAdvisor[tx.advisor_id].overrides += amount;
            break;
          case 'bonus':
            byAdvisor[tx.advisor_id].bonuses += amount;
            break;
          case 'chargeback':
            byAdvisor[tx.advisor_id].chargebacks += Math.abs(amount);
            break;
          default:
            byAdvisor[tx.advisor_id].total += amount;
        }
      }

      // Create payout records
      let created = 0;
      for (const [advisorId, amounts] of Object.entries(byAdvisor)) {
        const netPayout = amounts.total + amounts.overrides + amounts.bonuses - amounts.chargebacks;

        if (netPayout <= 0) continue;

        const { error: insertError } = await (supabase
          .from('commission_payouts') as any)
          .insert({
            organization_id: organizationId,
            advisor_id: advisorId,
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
            total_commissions: amounts.total,
            total_overrides: amounts.overrides,
            total_bonuses: amounts.bonuses,
            total_chargebacks: amounts.chargebacks,
            net_payout: netPayout,
            status: 'draft',
          });

        if (!insertError) created++;
      }

      toast.success(`Generated ${created} payout(s)`);
      await loadPayouts();
    } catch (error) {
      console.error('Error generating payouts:', error);
      toast.error('Failed to generate payouts');
    } finally {
      setGenerating(false);
    }
  }

  async function updatePayoutStatus(payoutId: string, newStatus: string) {
    setProcessingId(payoutId);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'approved') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .single() as { data: { id: string } | null };

          updateData.approved_by = profile?.id;
          updateData.approved_at = new Date().toISOString();
        }
      }

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await (supabase
        .from('commission_payouts') as any)
        .update(updateData)
        .eq('id', payoutId);

      if (error) throw error;

      // If marked as paid, also update the linked transactions
      if (newStatus === 'paid') {
        const payout = payouts.find(p => p.id === payoutId);
        if (payout) {
          await (supabase
            .from('commission_transactions') as any)
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              payout_id: payoutId,
            })
            .eq('advisor_id', payout.advisor_id)
            .eq('status', 'approved')
            .is('payout_id', null);
        }
      }

      toast.success(`Payout ${newStatus}`);
      await loadPayouts();
    } catch (error) {
      console.error('Error updating payout:', error);
      toast.error('Failed to update payout');
    } finally {
      setProcessingId(null);
    }
  }

  const draftCount = payouts.filter(p => p.status === 'draft').length;
  const approvedTotal = payouts
    .filter(p => p.status === 'approved')
    .reduce((sum, p) => sum + (p.net_payout || 0), 0);

  if (loading && payouts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="ml-3 text-slate-500">Loading payouts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Payouts</h1>
          <p className="text-slate-500">
            Generate and process agent commission payouts
          </p>
        </div>
        <Button onClick={generatePayouts} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Generate Payouts
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Draft Payouts</p>
                <p className="text-2xl font-bold">{draftCount}</p>
              </div>
              <FileText className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ready to Pay</p>
                <p className="text-2xl font-bold text-green-600">
                  ${approvedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Payouts</p>
                <p className="text-2xl font-bold">{payouts.length}</p>
              </div>
              <Users className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
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
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payouts</CardTitle>
          <CardDescription>{payouts.length} payouts found</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No payouts found</p>
              <p className="text-sm">Generate payouts from approved commission transactions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-slate-600">Agent</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Period</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Commissions</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Overrides</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Bonuses</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Chargebacks</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Net Payout</th>
                    <th className="pb-3 pr-4 font-medium text-slate-600">Status</th>
                    <th className="pb-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium">
                        {payout.advisor?.first_name} {payout.advisor?.last_name}
                      </td>
                      <td className="py-3 pr-4 text-sm">
                        {format(new Date(payout.period_start), 'MMM d')} - {format(new Date(payout.period_end), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        ${(payout.total_commissions || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        ${(payout.total_overrides || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        ${(payout.total_bonuses || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-red-600">
                        -${(payout.total_chargebacks || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold text-green-600">
                        ${(payout.net_payout || 0).toFixed(2)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={getStatusBadgeVariant(payout.status)}>
                          {payout.status}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={processingId === payout.id}>
                              {processingId === payout.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {payout.status === 'draft' && (
                              <DropdownMenuItem onClick={() => updatePayoutStatus(payout.id, 'pending')}>
                                <Play className="mr-2 h-4 w-4" />
                                Submit for Approval
                              </DropdownMenuItem>
                            )}
                            {payout.status === 'pending' && (
                              <DropdownMenuItem onClick={() => updatePayoutStatus(payout.id, 'approved')}>
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {payout.status === 'approved' && (
                              <DropdownMenuItem onClick={() => updatePayoutStatus(payout.id, 'paid')}>
                                <DollarSign className="mr-2 h-4 w-4 text-green-600" />
                                Mark as Paid
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
