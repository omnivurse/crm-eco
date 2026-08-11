/**
 * POST /api/crm/ai/briefing
 * Body: { recordId: uuid, preferLlm?: boolean }
 * Returns RecordBriefing (rules path always; LLM when configured).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { getRecordBriefing } from '@/lib/crm/ai';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  recordId: z.string().uuid(),
  preferLlm: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const briefing = await getRecordBriefing(supabase, {
      orgId: profile.organization_id,
      recordId: parsed.data.recordId,
      actorId: profile.id,
      preferLlm: parsed.data.preferLlm !== false,
    });

    if (!briefing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json(briefing);
  } catch (err) {
    console.error('[ai/briefing] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
