import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { resolveMemberCrmRecordIds } from '@/lib/crm/resolve-member-crm-record-query';

export const dynamic = 'force-dynamic';

/**
 * GET /api/members?status=active|inactive|futureActive|futureInactive
 * Returns member records filtered by status category.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const orgId = profile.organization_id;
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('status');
    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysOut = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    let query = supabase
      .from('members')
      .select(
        `id, first_name, last_name, email, phone, member_number, status, state,
         plan_name, effective_date, termination_date, created_at,
         advisor:advisors(id, first_name, last_name)`
      )
      .eq('organization_id', orgId);

    switch (filter) {
      case 'active':
        query = query.eq('status', 'active');
        break;
      case 'inactive':
        query = query.in('status', ['inactive', 'terminated', 'paused']);
        break;
      case 'futureActive':
        query = query.in('status', ['pending', 'prospect']);
        break;
      case 'futureInactive':
        query = query
          .eq('status', 'active')
          .gte('termination_date', today)
          .lte('termination_date', ninetyDaysOut);
        break;
      case 'healthshare':
      case 'insurance':
      case 'medicaid':
      case 'short_term':
        query = query.eq('status', 'active').eq('active_plan_type', filter);
        break;
      default:
        break;
    }

    const { data: members, error } = await query
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[Members List] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Resolve each enrollment member to the best matching CRM record. When a
    // Zoho contact and a sparse enrollment_sync stub both exist, prefer the
    // record with richer health-sharing coverage (member_number match wins).
    type MemberRow = NonNullable<typeof members>[number] & {
      email: string | null;
      crm_record_id?: string | null;
    };
    const list = (members ?? []) as MemberRow[];

    const recordIdsByMember = await resolveMemberCrmRecordIds(supabase, orgId, list);

    const enriched = list.map((m) => ({
      ...m,
      crm_record_id: recordIdsByMember.get(m.id) ?? null,
    }));

    return NextResponse.json({ members: enriched });
  } catch (error) {
    console.error('[Members List] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

