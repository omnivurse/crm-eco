import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { listExpiringCards } from '@crm-eco/lib';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient() as any;
  const { data, error } = await supabase
    .from('payment_profiles')
    .select('id, organization_id, member_id, expiration_date, last_four, card_last4, is_active')
    .eq('is_active', true)
    .not('expiration_date', 'is', null)
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    organization_id: string;
    member_id: string;
    expiration_date: string | null;
    last_four?: string | null;
    card_last4?: string | null;
    is_active?: boolean | null;
  }>;
  const expiring = listExpiringCards(rows, 60);
  return NextResponse.json({
    scanned: rows.length,
    expiring: expiring.length,
    cards: expiring.slice(0, 100).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      member_id: row.member_id,
      last_four: row.last_four || row.card_last4,
      expiration_date: row.expiration_date,
    })),
  });
}
