import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { escapeCsvCell } from '@crm-eco/lib/csv/escape';

export const dynamic = 'force-dynamic';

const MAX_EXPORT_ROWS = 10_000;

// Was a local copy; now the shared escaper, which additionally neutralises
// formula injection (`=`, `+`, `-`, `@` prefixes) so an export opened in Excel
// cannot execute attacker-controlled record content.
const csvEscape = escapeCsvCell;

/**
 * GET /api/commissions/export
 * CSV export of commission_transactions for the caller's org.
 * Accepts the same filters as GET /api/commissions: advisorId, status, periodStart, periodEnd.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const profile = await getAuthProfile();

    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const advisorId = searchParams.get('advisorId');
    const status = searchParams.get('status');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    let query = supabase
      .from('commission_transactions')
      .select(
        `
        id,
        transaction_type,
        period_start,
        period_end,
        gross_amount,
        rate_pct,
        commission_amount,
        status,
        override_level,
        created_at,
        advisors:advisor_id (id, first_name, last_name, email),
        source_advisor:source_advisor_id (id, first_name, last_name),
        members:member_id (id, first_name, last_name)
      `,
        { count: 'exact' },
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(MAX_EXPORT_ROWS);

    if (advisorId) {
      query = query.eq('advisor_id', advisorId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (periodStart) {
      query = query.gte('period_start', periodStart);
    }
    if (periodEnd) {
      query = query.lte('period_end', periodEnd);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Commissions export error:', error);
      return NextResponse.json({ error: 'Failed to export commissions' }, { status: 500 });
    }

    if ((count ?? 0) > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          error: `Export exceeds ${MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow filters (advisor or status) and try again.`,
        },
        { status: 413 },
      );
    }

    type AdvisorJoin = { first_name?: string; last_name?: string; email?: string } | null;
    type MemberJoin = { first_name?: string; last_name?: string } | null;

    const headers = [
      'Transaction ID',
      'Advisor',
      'Advisor Email',
      'Member',
      'Type',
      'Period Start',
      'Period End',
      'Gross Amount',
      'Rate %',
      'Commission Amount',
      'Status',
      'Override Level',
      'Source Advisor',
      'Created At',
    ];

    const rows = (transactions || []).map((tx) => {
      // Supabase typings may treat joins as arrays; normalize to a single object.
      const advisorRaw = tx.advisors as AdvisorJoin | AdvisorJoin[] | undefined;
      const advisor = Array.isArray(advisorRaw) ? advisorRaw[0] : advisorRaw;
      const memberRaw = tx.members as MemberJoin | MemberJoin[] | undefined;
      const member = Array.isArray(memberRaw) ? memberRaw[0] : memberRaw;
      const sourceRaw = tx.source_advisor as AdvisorJoin | AdvisorJoin[] | undefined;
      const source = Array.isArray(sourceRaw) ? sourceRaw[0] : sourceRaw;

      return [
        tx.id,
        [advisor?.first_name, advisor?.last_name].filter(Boolean).join(' '),
        advisor?.email ?? '',
        [member?.first_name, member?.last_name].filter(Boolean).join(' '),
        tx.transaction_type,
        tx.period_start,
        tx.period_end,
        tx.gross_amount,
        tx.rate_pct,
        tx.commission_amount,
        tx.status,
        tx.override_level ?? '',
        [source?.first_name, source?.last_name].filter(Boolean).join(' '),
        tx.created_at,
      ]
        .map(csvEscape)
        .join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="commissions-report-${dateStr}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Commissions export API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
