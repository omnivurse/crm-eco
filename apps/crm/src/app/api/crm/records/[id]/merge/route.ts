import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getAuthProfile } from '@/lib/supabase-server';

const bodySchema = z.object({
  duplicate_id: z.string().uuid(),
  merged_data: z.record(z.unknown()).optional(),
  merged_status: z.string().optional(),
  merged_email: z.string().optional(),
  merged_phone: z.string().optional(),
  merged_owner: z.string().uuid().optional(),
});

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for record merging');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * POST /api/crm/records/:id/merge
 *
 * Collapse a duplicate CRM record into this one (the keeper).
 *
 * Thin wrapper around the `merge_crm_records` RPC. The RPC handles the
 * real work (org/module guard, re-parenting every child row, audit log,
 * deleting the duplicate). This route just authenticates, validates, and
 * revalidates the affected pages.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: keeperId } = await params;

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Merging is destructive and touches audit/PHI — admins and managers only.
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to merge records' },
        { status: 403 },
      );
    }

    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid request body' },
        { status: 400 },
      );
    }

    if (parsed.data.duplicate_id === keeperId) {
      return NextResponse.json(
        { success: false, error: 'Cannot merge a record with itself' },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin.rpc('merge_crm_records', {
      p_keeper_id: keeperId,
      p_duplicate_id: parsed.data.duplicate_id,
      p_user_id: profile.id,
      p_merged_data: parsed.data.merged_data ?? null,
      p_merged_status: parsed.data.merged_status ?? null,
      p_merged_email: parsed.data.merged_email ?? null,
      p_merged_phone: parsed.data.merged_phone ?? null,
      p_merged_owner: parsed.data.merged_owner ?? null,
    });

    if (error) {
      console.error('[records/merge] RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    // The RPC returns `{ success, error?, kept_id, deleted_id, moved_* }`.
    // Honor a business-rule failure (same record, cross-module, etc.) with 400.
    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (result.success === false) {
      return NextResponse.json(
        { success: false, error: result.error || 'Merge failed' },
        { status: 400 },
      );
    }

    // Cache revalidation is best-effort: the DB transaction already
    // committed, so a revalidatePath failure must not bubble up as "merge
    // failed" to the user (same pattern as the record PATCH fix).
    try {
      revalidatePath('/crm');
      revalidatePath(`/crm/r/${keeperId}`);
      revalidatePath(`/crm/r/${parsed.data.duplicate_id}`);
    } catch (err) {
      console.error('[records/merge] revalidatePath error (merge already committed):', err);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[records/merge] unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
