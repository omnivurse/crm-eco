import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * POST /api/crm/duplicates/bulk-merge
 *
 * Triggers the tenant-generic `bulk_auto_merge_duplicates` RPC for the
 * caller's org. Returns per-rule merge counts so the Review Duplicates
 * page can render a summary toast.
 *
 * Body: { max_per_rule?: number (1..5000, default 1000) }
 *
 * Admin-only. The RPC also re-checks role + org membership server-side.
 */

const bodySchema = z.object({
  max_per_rule: z.coerce.number().int().min(1).max(5000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    // Bulk merge can touch thousands of records — admins only.
    if (profile.crm_role !== 'crm_admin') {
      return NextResponse.json(
        { success: false, error: 'Only CRM admins can run a bulk merge' },
        { status: 403 },
      );
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid body' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('bulk_auto_merge_duplicates', {
      p_org_id: profile.organization_id,
      p_max_per_rule: parsed.data.max_per_rule ?? 1000,
    });

    if (error) {
      console.error('[duplicates/bulk-merge] RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Bulk merge failed' },
        { status: 500 },
      );
    }

    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (result.success === false) {
      return NextResponse.json(result, { status: 400 });
    }

    try {
      revalidatePath('/crm');
      revalidatePath('/crm/duplicates');
    } catch (err) {
      console.error('[duplicates/bulk-merge] revalidatePath failed:', err);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[duplicates/bulk-merge] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
