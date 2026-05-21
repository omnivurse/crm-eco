import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { listMemberNotifications, countUnreadNotifications } from '@/lib/data/member';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [notifications, unread] = await Promise.all([
    listMemberNotifications(),
    countUnreadNotifications(),
  ]);
  return NextResponse.json({ notifications, unread });
}

/** Mark notifications as read. Body: `{ ids?: string[]; all?: boolean }`. */
export async function PATCH(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const body = (await request.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  let q = supabase
    .from('member_notifications')
    .update({ is_read: true, read_at: now })
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id);

  if (!body.all) {
    if (!body.ids?.length) {
      return NextResponse.json({ error: 'missing_ids' }, { status: 400 });
    }
    q = q.in('id', body.ids);
  }

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
