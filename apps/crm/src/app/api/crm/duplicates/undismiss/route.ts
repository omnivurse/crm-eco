import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * POST /api/crm/duplicates/undismiss
 *
 * Removes a dismissal so the pair re-appears in /crm/duplicates.
 * Used by the "bring back" affordance when the operator changes
 * their mind.
 *
 * Body: { left_id: uuid, right_id: uuid }
 */

const bodySchema = z.object({
  left_id: z.string().uuid(),
  right_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json(
        { success: false, error: 'Only CRM admins and managers can undismiss duplicate pairs' },
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

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('undismiss_duplicate_pair', {
      p_a_id: parsed.data.left_id,
      p_b_id: parsed.data.right_id,
    });

    if (error) {
      console.error('[duplicates/undismiss] RPC error:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to undismiss pair' },
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
      console.error('[duplicates/undismiss] revalidatePath failed:', err);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[duplicates/undismiss] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
