import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@crm-eco/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Calendar, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

interface PayoutRow {
  id: string;
  advisor_id: string;
  period_start: string;
  period_end: string;
  total_commissions: number | null;
  total_overrides: number | null;
  total_bonuses: number | null;
  total_chargebacks: number | null;
  net_payout: number | null;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  advisor?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

interface CommissionTransaction {
  id: string;
  commission_amount: number | null;
  transaction_type: string;
  status: string;
  enrollment_id: string | null;
  created_at: string;
}

async function getPayout(id: string): Promise<PayoutRow | null> {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data } = await (supabase.from('commission_payouts') as any)
    .select(`*, advisor:advisors!commission_payouts_advisor_id_fkey(first_name, last_name, email)`)
    .eq('id', id)
    .eq('organization_id', tenant.organizationId)
    .single();

  return (data as unknown as PayoutRow) ?? null;
}

async function getTransactions(payoutId: string, advisorId: string): Promise<CommissionTransaction[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await (supabase.from('commission_transactions') as any)
    .select('id, commission_amount, transaction_type, status, enrollment_id, created_at')
    .eq('advisor_id', advisorId)
    .or(`payout_id.eq.${payoutId},and(payout_id.is.null,status.eq.approved)`)
    .order('created_at', { ascending: false });
  return (data ?? []) as CommissionTransaction[];
}

export default async function PayoutBatchDetailPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const payout = await getPayout(batchId);
  if (!payout) notFound();

  const transactions = await getTransactions(batchId, payout.advisor_id);

  const advisorName = `${payout.advisor?.first_name ?? ''} ${payout.advisor?.last_name ?? ''}`.trim() || 'Unknown advisor';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/commissions/payouts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{advisorName}</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(payout.period_start), 'MMM d')} – {format(new Date(payout.period_end), 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {payout.status === 'approved' && (
            <form action={`/api/payouts/${batchId}/process`} method="POST">
              <Button type="submit" size="sm">
                <Play className="mr-2 h-4 w-4" />
                Process Payment
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{payout.status}</Badge>
            {payout.approved_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Approved {format(new Date(payout.approved_at), 'MMM d, yyyy')}
              </p>
            )}
            {payout.paid_at && (
              <p className="text-xs text-muted-foreground">
                Paid {format(new Date(payout.paid_at), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Net Payout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Commissions</p>
                <p className="font-mono">${(payout.total_commissions ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Overrides</p>
                <p className="font-mono">${(payout.total_overrides ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bonuses</p>
                <p className="font-mono">${(payout.total_bonuses ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Chargebacks</p>
                <p className="font-mono text-red-600">-${(payout.total_chargebacks ?? 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Net</span>
              <span className="text-2xl font-bold text-green-600">${(payout.net_payout ?? 0).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commission transactions in this payout</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-mono text-xs">{t.id.slice(0, 8)}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(t.created_at), 'MMM d, yyyy')}
                        <Badge variant="outline" className="text-xs">{t.transaction_type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={t.transaction_type === 'chargeback' ? 'font-mono text-red-600' : 'font-mono'}>
                      ${(t.commission_amount ?? 0).toFixed(2)}
                    </div>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(payout.payment_method || payout.payment_reference || payout.notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payout.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span>{payout.payment_method}</span>
              </div>
            )}
            {payout.payment_reference && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono">{payout.payment_reference}</span>
              </div>
            )}
            {payout.notes && (
              <div>
                <p className="text-muted-foreground">Notes</p>
                <p className="mt-1">{payout.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
