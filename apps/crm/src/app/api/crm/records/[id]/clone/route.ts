import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * POST /api/crm/records/[id]/clone
 * Clone a CRM record (duplicates data, resets ownership to current user)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the source record (org-scoped)
    const { data: source, error: fetchError } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Clone: copy data but assign to current user, reset timestamps
    const { data: cloned, error: insertError } = await supabase
      .from('crm_records')
      .insert({
        org_id: source.org_id,
        module_id: source.module_id,
        owner_id: profile.id,
        title: source.title ? `${source.title} (Copy)` : null,
        data: source.data,
        status: source.status,
        stage: source.stage,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Clone insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: cloned.id, ...cloned });
  } catch (error) {
    console.error('Error in POST /api/crm/records/[id]/clone:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
