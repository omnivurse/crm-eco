import 'server-only';

import {
  crmRecordToLeadListItem,
  isConvertedLeadRow,
  resolveLeadsModuleId,
} from '@crm-eco/lib';
import { hrefAllowed, sanitizeRecordHits, speakableFields, type GizmoRecordHit } from '@crm-eco/lib/gizmo';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, '').trim();
}

export async function searchAdvisorRecords(query: string): Promise<GizmoRecordHit[]> {
  const q = escapeIlike(query);
  if (!q) return [];

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('advisor_id, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile?.advisor_id || !profile.organization_id) return [];

  const orgId = profile.organization_id;
  const advisorId = profile.advisor_id;
  const hits: GizmoRecordHit[] = [];
  const like = `%${q}%`;

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, phone, status, date_of_birth, member_number')
    .eq('organization_id', orgId)
    .eq('advisor_id', advisorId)
    .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like},member_number.ilike.${like}`)
    .limit(6);

  for (const m of members ?? []) {
    const href = `/contacts/member/${m.id}`;
    if (!hrefAllowed('advisor_portal', href)) continue;
    const title = [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || m.email || 'Member';
    hits.push({
      title,
      subtitle: [m.email, m.phone, m.status].filter(Boolean).join(' · '),
      href,
      module: 'members',
      phone: m.phone,
      email: m.email,
      fields: speakableFields({
        email: m.email,
        phone: m.phone,
        status: m.status,
        title,
        data: {
          first_name: m.first_name,
          last_name: m.last_name,
          dob: m.date_of_birth,
          date_of_birth: m.date_of_birth,
          member_number: m.member_number,
        },
      }),
    });
  }

  const leadsModuleId = await resolveLeadsModuleId(supabase, orgId);
  if (leadsModuleId) {
    const { data: leadRows } = await supabase
      .from('crm_records')
      .select('id, title, email, phone, status, created_at, data')
      .eq('org_id', orgId)
      .eq('module_id', leadsModuleId)
      .eq('advisor_id', advisorId)
      .or(`title.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(8);

    for (const row of (leadRows ?? []).filter((r) => !isConvertedLeadRow({
      module_key: 'leads',
      status: r.status,
      data: r.data && typeof r.data === 'object' && !Array.isArray(r.data)
        ? (r.data as Record<string, unknown>)
        : null,
    }))) {
      const item = crmRecordToLeadListItem({
        ...row,
        data: row.data as import('@crm-eco/lib/types').Json | null,
      });
      const href = `/contacts/lead/${item.id}`;
      if (!hrefAllowed('advisor_portal', href)) continue;
      const title = [item.first_name, item.last_name].filter(Boolean).join(' ').trim() || item.email || 'Lead';
      const data =
        row.data && typeof row.data === 'object' && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {};
      hits.push({
        title,
        subtitle: [item.email, item.phone, item.status].filter(Boolean).join(' · '),
        href,
        module: 'leads',
        phone: item.phone,
        email: item.email,
        fields: speakableFields({
          email: item.email,
          phone: item.phone,
          status: item.status,
          title,
          data,
        }),
      });
    }
  }

  return sanitizeRecordHits('advisor_portal', hits, 8);
}
