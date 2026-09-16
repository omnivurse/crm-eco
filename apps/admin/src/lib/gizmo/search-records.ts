import 'server-only';

import type { GizmoRecordHit } from '@crm-eco/lib/gizmo';
import { hrefAllowed, sanitizeRecordHits } from '@crm-eco/lib/gizmo';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, '').trim();
}

export async function searchAdminRecords(query: string): Promise<GizmoRecordHit[]> {
  const tenant = await getActiveTenant();
  if (!tenant) return [];
  const q = escapeIlike(query);
  if (!q) return [];

  const supabase = await createServerSupabaseClient();
  const orgId = tenant.organizationId;
  const hits: GizmoRecordHit[] = [];

  let memberIds: string[] = [];
  const rpc = await supabase.rpc('search_members_with_dependents' as never, {
    p_org_id: orgId,
    p_search: q,
  } as never);
  if (Array.isArray(rpc.data)) {
    memberIds = (rpc.data as Array<string | { id?: string }>).map((row) =>
      typeof row === 'string' ? row : String(row.id ?? ''),
    ).filter(Boolean);
  }

  let memberQuery = supabase
    .from('members')
    .select('id, first_name, last_name, email, phone, status')
    .eq('organization_id', orgId)
    .limit(8);

  if (memberIds.length) {
    memberQuery = memberQuery.in('id', memberIds.slice(0, 8));
  } else {
    memberQuery = memberQuery.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const { data: members } = await memberQuery;
  const foundMemberIds: string[] = [];
  for (const m of members ?? []) {
    const title = [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email || 'Member';
    const href = `/members/${m.id}`;
    if (!hrefAllowed('admin', href)) continue;
    foundMemberIds.push(m.id);
    hits.push({
      title,
      subtitle: [m.email, m.phone, m.status].filter(Boolean).join(' · '),
      href,
      module: 'members',
    });
  }

  const enrollSelect =
    'id, enrollment_number, status, primary_member:members!enrollments_primary_member_id_fkey(first_name, last_name)';
  const [byNumber, byMember] = await Promise.all([
    supabase
      .from('enrollments')
      .select(enrollSelect)
      .eq('organization_id', orgId)
      .ilike('enrollment_number', `%${q}%`)
      .limit(4),
    foundMemberIds.length
      ? supabase
          .from('enrollments')
          .select(enrollSelect)
          .eq('organization_id', orgId)
          .in('primary_member_id', foundMemberIds)
          .limit(4)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const enrollments = [...(byNumber.data ?? []), ...(byMember.data ?? [])];

  for (const e of enrollments ?? []) {
    const href = `/enrollments/${e.id}`;
    if (!hrefAllowed('admin', href)) continue;
    const primary = Array.isArray(e.primary_member) ? e.primary_member[0] : e.primary_member;
    const name = primary
      ? [primary.first_name, primary.last_name].filter(Boolean).join(' ')
      : '';
    hits.push({
      title: e.enrollment_number ? `Enrollment ${e.enrollment_number}` : 'Enrollment',
      subtitle: [name, e.status].filter(Boolean).join(' · '),
      href,
      module: 'enrollments',
    });
  }

  return sanitizeRecordHits('admin', hits, 8);
}
