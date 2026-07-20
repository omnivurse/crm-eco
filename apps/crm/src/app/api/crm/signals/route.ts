/**
 * POST /api/crm/signals
 *
 * Fire-and-forget habit beacon. Validates auth + org, inserts into
 * crm_user_signals. Never blocks UX — clients ignore non-2xx.
 *
 * Body: { signal_type, module_key?, entity_id?, meta? }
 *   - search_query: meta.q_hash required (client hashes; never send raw PII)
 */

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { HABIT_SIGNAL_TYPES } from '@/lib/crm/habits/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  signal_type: z.enum(HABIT_SIGNAL_TYPES),
  module_key: z.string().min(1).max(64).nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    const { user } = await getAuthUser();
    if (!profile || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid signal', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { signal_type, module_key, entity_id } = parsed.data;
    let meta = { ...(parsed.data.meta ?? {}) } as Record<string, unknown>;

    // Never persist raw search strings — hash if a client slips.
    if (signal_type === 'search_query') {
      if (typeof meta.q === 'string' && meta.q.length > 0) {
        meta.q_hash = createHash('sha256').update(meta.q.toLowerCase().trim()).digest('hex').slice(0, 32);
        delete meta.q;
      }
      if (typeof meta.q_hash !== 'string') {
        return NextResponse.json(
          { error: 'search_query requires meta.q_hash' },
          { status: 400 },
        );
      }
    }

    // Cap meta size
    const metaJson = JSON.stringify(meta);
    if (metaJson.length > 2000) {
      return NextResponse.json({ error: 'meta too large' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from('crm_user_signals').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      signal_type,
      module_key: module_key ?? null,
      entity_id: entity_id ?? null,
      meta,
    });

    if (error) {
      // Table may not exist yet on some envs — fail soft so UX never breaks.
      if (error.code === '42P01' || error.message?.includes('crm_user_signals')) {
        console.warn('[signals] table missing — migration not applied');
        return NextResponse.json({ ok: true, skipped: true });
      }
      console.error('[signals] insert error:', error);
      return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[signals] unexpected:', err);
    return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 });
  }
}
