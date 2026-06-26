import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit, findRecentDuplicate } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);

  const { data } = await supabase
    .from('needs')
    .select('id, need_type, description, total_amount, eligible_amount, status, urgency_light, incident_date, created_at, updated_at')
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  return NextResponse.json({ needs: data ?? [] });
}

interface SubmitNeedBody {
  need_type: string;
  description: string;
  total_amount?: number;
  incident_date?: string | null;
  facility_name?: string | null;
  custom_fields?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const ctx = await requireActiveMembership();

  const limited = memberRateLimit(ctx.member.id, 'needs:create', { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const body = (await request.json().catch(() => ({}))) as SubmitNeedBody;

  if (!body.need_type || !body.description) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Idempotency: a double-submit of the same need (same member + type +
  // description) within the look-back window returns the existing record instead
  // of creating a duplicate.
  const duplicateId = await findRecentDuplicate(supabase, 'needs', {
    member_id: ctx.member.id,
    organization_id: ctx.member.organization_id,
    need_type: body.need_type,
    description: body.description,
  });
  if (duplicateId) {
    return NextResponse.json(
      { need: { id: duplicateId, need_type: body.need_type, status: 'open' }, deduplicated: true },
      { headers: limited.headers },
    );
  }

  const { data, error } = await supabase
    .from('needs')
    .insert({
      organization_id: ctx.member.organization_id,
      member_id: ctx.member.id,
      need_type: body.need_type,
      description: body.description,
      total_amount: body.total_amount ?? null,
      incident_date: body.incident_date ?? null,
      facility_name: body.facility_name ?? null,
      custom_fields: (body.custom_fields ?? {}) as never,
      status: 'open',
    })
    .select('id, need_type, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit event
  await supabase.from('need_events').insert({
    organization_id: ctx.member.organization_id,
    need_id: data.id,
    event_type: 'submitted',
    description: 'Member submitted need via portal',
    new_status: 'open',
    created_by_profile_id: ctx.profile.id,
  });

  return NextResponse.json({ need: data }, { headers: limited.headers });
}
