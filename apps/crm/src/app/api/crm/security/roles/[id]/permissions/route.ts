import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/crm/security/roles/[id]/permissions
 * Returns permission IDs assigned to a catalog role (for Security Control editor).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: role } = await supabase
      .from('crm_roles')
      .select('id, organization_id')
      .eq('id', id)
      .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('crm_role_permissions')
      .select('permission_id')
      .eq('role_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      role_id: id,
      permission_ids: (data || []).map((r) => r.permission_id as string),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
