import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * POST /api/crm/duplicates/dismiss
 *
 * Marks a probable-duplicate pair as "not actually a duplicate" so it
 * stops showing up in /crm/duplicates. Idempotent — re-dismissing an
 * already-dismissed pair just refreshes the reason/timestamp.
 *
 * Body: { left_id: uuid, right_id: uuid, reason?: string }
 */

const bodySchema = z.object({
  left_id: z.string().uuid(),
  right_id: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { success: false, error: 'Only CRM admins and managers can dismiss duplicate pairs' },
        { status: 403 },
      );
    }

    const raw = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Invalid body' },
        { status: 400 },
      );
    }
    if (parsed.data.left_id === parsed.data.right_id) {
      return NextResponse.json(
        { success: false, error: 'Two different record ids are required' },
        { status: 400 },
      );
    }

    // Use the user-scoped client so the SECURITY DEFINER RPC sees auth.uid()
    // and can enforce the "admin in the same org" check itself.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('dismiss_duplicate_pair', {
      p_a_id: parsed.data.left_id,
      p_b_id: parsed.data.right_id,
      p_reason: parsed.data.reason ?? null,
    });

    if (error) {
      console.error('[duplicates/dismiss] RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to dismiss pair' },
        { status: 500 },
      );
    }

    const result = (data ?? {}) as { success?: boolean; error?: string };
    if (result.success === false) {
      return NextResponse.json(result, { status: 400 });
    }

    try {
      revalidatePath('/crm/duplicates');
    } catch (err) {
      console.error('[duplicates/dismiss] revalidatePath failed (dismissal already committed):', err);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[duplicates/dismiss] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
