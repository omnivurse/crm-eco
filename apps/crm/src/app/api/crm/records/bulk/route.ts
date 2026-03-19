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

    // When assigning a new owner, also sync canonical ownership fields
    if (parsed.data.updates.owner_id) {
      // Look up the owner's profile to find their advisor record
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, advisor_id')
        .eq('id', parsed.data.updates.owner_id)
        .single();

      if (ownerProfile) {
        // Get the records being updated to check their lane
        const { data: records } = await supabase
          .from('crm_records')
          .select('id, market_type')
          .in('id', parsed.data.record_ids)
          .eq('org_id', profile.organization_id);

        if (records && records.length > 0) {
          const healthshareIds = records
            .filter((r: any) => r.market_type === 'healthshare')
            .map((r: any) => r.id);
          const insuranceIds = records
            .filter((r: any) => r.market_type === 'traditional_insurance')
            .map((r: any) => r.id);
          const otherIds = records
            .filter((r: any) => r.market_type !== 'healthshare' && r.market_type !== 'traditional_insurance')
            .map((r: any) => r.id);

          // HealthShare records: set canonical_advisor_id + normalized_advisor_name
          if (healthshareIds.length > 0) {
            await supabase
              .from('crm_records')
              .update({
                canonical_advisor_id: ownerProfile.advisor_id || null,
                normalized_advisor_name: ownerProfile.full_name || null,
                normalization_status: 'normalized',
                updated_at: new Date().toISOString(),
              } as any)
              .in('id', healthshareIds)
              .eq('org_id', profile.organization_id);
          }

          // Traditional Insurance records: set normalized_agent_name
          if (insuranceIds.length > 0) {
            await supabase
              .from('crm_records')
              .update({
                normalized_agent_name: ownerProfile.full_name || null,
                normalization_status: 'normalized',
                updated_at: new Date().toISOString(),
              } as any)
              .in('id', insuranceIds)
              .eq('org_id', profile.organization_id);
          }

          // Unknown lane: set both for safety
          if (otherIds.length > 0) {
            await supabase
              .from('crm_records')
              .update({
                canonical_advisor_id: ownerProfile.advisor_id || null,
                normalized_advisor_name: ownerProfile.full_name || null,
                normalized_agent_name: ownerProfile.full_name || null,
                updated_at: new Date().toISOString(),
              } as any)
              .in('id', otherIds)
              .eq('org_id', profile.organization_id);
          }
        }
      }
    }

    // Update records with base fields (owner_id, status, stage)
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
