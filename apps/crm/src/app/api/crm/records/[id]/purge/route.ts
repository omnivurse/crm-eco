import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { logPHIAccess } from '@/lib/security';

/**
 * DELETE /api/crm/records/[id]/purge
 *
 * Permanently delete a trashed record (physical delete → existing ON DELETE
 * CASCADE removes children). Only trashed records can be purged. Attachment
 * storage-blob cleanup is handled by the retention/GC cron (Phase 6); this
 * removes the DB rows. The RPC re-checks org + crm_admin/crm_manager.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();

    // Guard: only permanently delete a record that is already in the Trash.
    const { data: rec } = await (supabase as any)
      .from('crm_records')
      .select('id, title, module_id, deleted_at')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    if (!(rec as { deleted_at?: string | null }).deleted_at) {
      return NextResponse.json(
        { error: 'Only records in Trash can be permanently deleted' },
        { status: 409 },
      );
    }

    const { data, error } = await (supabase as any).rpc('crm_purge_record', {
      p_record_id: id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    try {
      await logPHIAccess({
        userId: profile.id,
        organizationId: profile.organization_id,
        action: 'delete',
        resourceType: 'record',
        resourceId: id,
        recordName: (rec as { title?: string }).title || 'permanent delete',
        metadata: { module_id: (rec as { module_id?: string }).module_id, purge: true },
      });
    } catch (err) {
      console.error('PHI audit logging error (purge):', err);
    }

    return NextResponse.json({ success: true, purged: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
