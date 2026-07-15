import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { z } from 'zod';

const schema = z.object({ batch_id: z.string().uuid() });

/**
 * POST /api/crm/records/trash/restore  { batch_id }
 *
 * Restore every record in a trash batch — powers the "Undo" toast shown right
 * after a single or bulk delete. The RPC re-checks org + crm_admin/crm_manager.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'batch_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc('crm_restore_batch', {
      p_batch_id: parsed.data.batch_id,
    });

    if (error) {
      // A batch restore is one UPDATE, so a single re-created (email + name) slot
      // (the index excludes trashed rows since Phase 6a-2) fails the whole undo.
      // Surface it clearly rather than as a raw 500.
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json(
          {
            error:
              'Cannot restore — one or more of these records conflict with an existing record (same email and name). Resolve the conflict, then try again.',
            code: 'RESTORE_CONFLICT',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, restoredCount: (data as number) ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
