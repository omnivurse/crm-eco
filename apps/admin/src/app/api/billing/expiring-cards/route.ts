import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { listExpiringCards } from '@crm-eco/lib';
import { requireAdminRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient);
  if (error || !profile) return error;

  const withinDays = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get('withinDays') ?? 60) || 60, 1),
    365
  );

  const supabase = createServiceRoleClient() as any;
  const { data, error: queryError } = await supabase
    .from('payment_profiles')
    .select('id, organization_id, member_id, expiration_date, last_four, card_last4, is_active, members ( first_name, last_name, email )')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .not('expiration_date', 'is', null)
    .limit(2000);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    id: string;
    member_id: string;
    expiration_date: string | null;
    last_four?: string | null;
    card_last4?: string | null;
    is_active?: boolean | null;
    members?: { first_name: string | null; last_name: string | null; email: string | null } | Array<{
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>;
  }>;
  const expiring = listExpiringCards(rows, withinDays);
  return NextResponse.json({
    withinDays,
    scanned: rows.length,
    expiring: expiring.length,
    cards: expiring.map((row) => {
      const member = Array.isArray(row.members) ? row.members[0] : row.members;
      return {
        id: row.id,
        member_id: row.member_id,
        last_four: row.last_four || row.card_last4,
        expiration_date: row.expiration_date,
        member_name: member ? `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() : null,
        email: member?.email ?? null,
      };
    }),
  });
}
