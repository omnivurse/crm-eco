import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';

const bulkUpdateSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1),
  updates: z.object({
    owner_id: z.string().uuid().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }),
});

const bulkDeleteSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1),
});

/**
 * PATCH /api/crm/records/bulk
 * Bulk update records (assign owner, change status, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden - requires admin or manager role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    // Build update object, only including non-undefined fields
    const updateObj: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.updates.owner_id !== undefined) {
      updateObj.owner_id = parsed.data.updates.owner_id;
    }
    if (parsed.data.updates.status !== undefined) {
      updateObj.status = parsed.data.updates.status;
    }
    if (parsed.data.updates.stage !== undefined) {
      updateObj.stage = parsed.data.updates.stage;
    }

    // Update records
    const { data, error } = await supabase
      .from('crm_records')
      .update(updateObj)
      .in('id', parsed.data.record_ids)
      .eq('org_id', profile.organization_id)
      .select('id');

    if (error) {
      console.error('Error bulk updating records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated_count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error in PATCH /api/crm/records/bulk:', error);
    return NextResponse.json({ error: 'Failed to bulk update records' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/records/bulk
 * Bulk delete records
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden - requires admin or manager role' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const supabase = await createCrmClient();

    const { error } = await supabase
      .from('crm_records')
      .delete()
      .in('id', parsed.data.record_ids)
      .eq('org_id', profile.organization_id);

    if (error) {
      console.error('Error bulk deleting records:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: parsed.data.record_ids.length,
    });
  } catch (error) {
    console.error('Error in DELETE /api/crm/records/bulk:', error);
    return NextResponse.json({ error: 'Failed to bulk delete records' }, { status: 500 });
  }
}
