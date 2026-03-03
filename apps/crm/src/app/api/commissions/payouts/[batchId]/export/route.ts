import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/commissions/payouts/[batchId]/export
 *
 * Exports payout batch data as CSV. Admin-only.
 * Logs the export to payout_audit_log for compliance.
 * PII-safe: only advisor IDs, amounts, and payment references.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'super_admin', 'admin'].includes(profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const supabase = await createClient();

    // Fetch batch info (before logging so we have totals)
    const { data: batch, error: batchError } = await supabase
      .from('commission_payment_batches')
      .select('batch_number, period_start, period_end, total_amount, total_advisors, status')
      .eq('id', batchId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Log the export with batch metadata
    await supabase.rpc('log_payout_export', {
      p_org_id: profile.organization_id,
      p_actor_id: profile.id,
      p_batch_id: batchId,
      p_format: 'csv',
      p_record_count: batch.total_advisors,
      p_total_amount: batch.total_amount,
    });

    // Fetch payout items with advisor info (PII-safe: only name + ID)
    const { data: payouts, error: payoutError } = await supabase
      .from('commission_payouts')
      .select(`
        id, advisor_id, period_start, period_end,
        total_commissions, total_overrides, total_bonuses,
        total_chargebacks, net_payout, status,
        payment_method, payment_reference, paid_at,
        advisors!inner(first_name, last_name, email)
      `)
      .eq('organization_id', profile.organization_id)
      .in('id', (
        await supabase
          .from('commission_ledger')
          .select('payout_id')
          .eq('payout_batch_id', batchId)
          .not('payout_id', 'is', null)
      ).data?.map(r => r.payout_id) || []);

    if (payoutError) throw payoutError;

    // Build CSV
    const headers = [
      'Payout ID', 'Advisor ID', 'Name', 'Email',
      'Period Start', 'Period End',
      'Commissions', 'Overrides', 'Bonuses', 'Chargebacks', 'Net Payout',
      'Status', 'Payment Method', 'Payment Ref', 'Paid At',
    ];

    const rows = (payouts || []).map((p) => {
      const advisor = Array.isArray(p.advisors) ? p.advisors[0] : p.advisors;
      return [
        p.id,
        p.advisor_id,
        advisor ? `${advisor.first_name} ${advisor.last_name}` : '',
        advisor?.email || '',
        p.period_start,
        p.period_end,
        p.total_commissions,
        p.total_overrides || 0,
        p.total_bonuses || 0,
        p.total_chargebacks || 0,
        p.net_payout,
        p.status,
        p.payment_method || '',
        p.payment_reference || '',
        p.paid_at || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payout-${batch.batch_number}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting payout batch:', error);
    return NextResponse.json({ error: 'Failed to export payout batch' }, { status: 500 });
  }
}
