/**
 * GET /api/crm/ai/usage — light admin glance: calls / tokens / degrade rate today.
 * Managers + admins only. Metadata only (no PHI).
 */

import { NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createClient();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('crm_ai_audit')
      .select('purpose, tokens, mode, created_at')
      .eq('org_id', profile.organization_id)
      .gte('created_at', dayStart.toISOString())
      .limit(5000);

    if (error) {
      return NextResponse.json(
        {
          calls: 0,
          tokens: 0,
          byPurpose: {},
          degradeRate: 0,
          note: 'Audit table unavailable',
        },
        { status: 200 },
      );
    }

    const rows = data ?? [];
    let tokens = 0;
    let degraded = 0;
    const byPurpose: Record<string, { calls: number; tokens: number }> = {};
    for (const row of rows) {
      tokens += row.tokens ?? 0;
      if (row.mode === 'degraded') degraded += 1;
      const p = row.purpose || 'unknown';
      if (!byPurpose[p]) byPurpose[p] = { calls: 0, tokens: 0 };
      byPurpose[p].calls += 1;
      byPurpose[p].tokens += row.tokens ?? 0;
    }

    return NextResponse.json({
      day: dayStart.toISOString().slice(0, 10),
      calls: rows.length,
      tokens,
      byPurpose,
      degradeRate: rows.length ? degraded / rows.length : 0,
    });
  } catch (err) {
    console.error('[ai/usage] error', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
