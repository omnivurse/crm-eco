import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

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
        `id, first_name, last_name, email, phone, status, state,
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

    // Resolve each `members.id` (Admin-Portal sync) to its matching
    // `crm_records.id` (where the record drawer + record detail page live)
    // so clicks on /crm/members navigate to a real record page instead of
    // 404'ing. Members and crm_records share email within the org; we
    // prefer a `contacts` module match, then `members`, then any record.
    type MemberRow = NonNullable<typeof members>[number] & {
      email: string | null;
      crm_record_id?: string | null;
    };
    const list = (members ?? []) as MemberRow[];

    const emails = Array.from(
      new Set(
        list
          .map((m) => m.email?.trim().toLowerCase())
          .filter((e): e is string => !!e),
      ),
    );

    const recordByEmail = new Map<
      string,
      { id: string; module_key: string }
    >();

    if (emails.length > 0) {
      // Stored emails in crm_records are mixed-case (~14% of rows). Use a
      // case-insensitive OR of `ilike` clauses — `ilike.foo@bar.com` (no
      // wildcards) is exact match ignoring case in PostgREST.
      const orClause = emails
        .map((e) => `email.ilike.${escapeIlikeExact(e)}`)
        .join(',');
      const { data: crmRecords } = await supabase
        .from('crm_records')
        .select('id, email, crm_modules!inner(key)')
        .eq('org_id', orgId)
        .or(orClause);

      type RecordRow = {
        id: string;
        email: string | null;
        crm_modules: { key: string } | { key: string }[] | null;
      };
      // Module preference order: contacts → members → leads → anything else.
      const PRIORITY: Record<string, number> = {
        contacts: 0,
        members: 1,
        leads: 2,
      };
      for (const raw of (crmRecords ?? []) as RecordRow[]) {
        const email = raw.email?.toLowerCase();
        if (!email) continue;
        const modules = Array.isArray(raw.crm_modules)
          ? raw.crm_modules
          : raw.crm_modules
            ? [raw.crm_modules]
            : [];
        const key = modules[0]?.key ?? 'unknown';
        const existing = recordByEmail.get(email);
        const newPri = PRIORITY[key] ?? 99;
        const oldPri = existing ? (PRIORITY[existing.module_key] ?? 99) : 99;
        if (!existing || newPri < oldPri) {
          recordByEmail.set(email, { id: raw.id, module_key: key });
        }
      }
    }

    const enriched = list.map((m) => ({
      ...m,
      crm_record_id:
        m.email
          ? recordByEmail.get(m.email.trim().toLowerCase())?.id ?? null
          : null,
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

/**
 * Escape an email for use as a PostgREST `ilike.` operand: SQL `%` and `_`
 * are wildcards under ilike; backslash is the escape character. Emails can
 * legitimately contain `_` so we have to escape it. We also strip newlines /
 * commas so a malicious email can't break out of the `or=(...)` list.
 */
function escapeIlikeExact(value: string): string {
  return value
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[\r\n,()]/g, '');
}
