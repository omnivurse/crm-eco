import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { logPHIAccess } from '@/lib/security';

/**
 * POST /api/crm/records/[id]/restore
 *
 * Restore a single trashed record from the recycle bin. The RPC re-checks
 * org + crm_admin/crm_manager; the route adds a friendly gate + PHI log.
 */
export async function POST(
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
    const { data, error } = await (supabase as any).rpc('crm_restore_record', {
      p_record_id: id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Record not found or already restored' },
        { status: 404 },
      );
    }

    try {
      await logPHIAccess({
        userId: profile.id,
        organizationId: profile.organization_id,
        action: 'update',
        resourceType: 'record',
        resourceId: id,
        recordName: 'restore from trash',
        metadata: { restored: true },
      });
    } catch (err) {
      console.error('PHI audit logging error (restore):', err);
    }

    return NextResponse.json({ success: true, restored: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
