/**
 * Apply Price Change Edge Function
 *
 * Picks up the next pending `price_change_schedules` row whose
 * scheduled_date <= today and applies it. Creates immutable
 * `price_change_audit` rows and updates enrollments.base_monthly_cost
 * (which cascades to billing_schedules.amount via the sync trigger).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { organization_id, schedule_id } = body as { organization_id?: string; schedule_id?: string };
    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let query = supabase
      .from('price_change_schedules')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('status', 'pending')
      .lte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(1);
    if (schedule_id) query = query.eq('id', schedule_id);

    const { data: schedules } = await query;
    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending price changes due', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const schedule = schedules[0];

    await supabase
      .from('price_change_schedules')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', schedule.id);

    const newAmount = (schedule.new_pricing_snapshot as { monthly_share?: number } | null)?.monthly_share ?? 0;

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, base_monthly_cost')
      .eq('organization_id', organization_id)
      .eq('selected_plan_id', schedule.plan_id)
      .eq('status', 'approved');

    let processed = 0;
    let failed = 0;
    const errors: Array<{ enrollment_id: string; error: string }> = [];

    for (const enrollment of enrollments ?? []) {
      try {
        const oldAmount = Number(enrollment.base_monthly_cost ?? 0);

        const { error: auditErr } = await supabase.from('price_change_audit').insert({
          organization_id,
          schedule_id: schedule.id,
          enrollment_id: enrollment.id,
          old_amount: oldAmount,
          new_amount: newAmount,
          change_reason: schedule.notes ?? 'scheduled price change',
        });
        if (auditErr) throw auditErr;

        const { error: updErr } = await supabase
          .from('enrollments')
          .update({
            base_monthly_cost: newAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);
        if (updErr) throw updErr;

        processed++;
      } catch (err) {
        failed++;
        errors.push({
          enrollment_id: enrollment.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    await supabase
      .from('price_change_schedules')
      .update({
        status: failed === 0 ? 'completed' : 'failed',
        processed_count: processed,
        failed_count: failed,
        executed_at: new Date().toISOString(),
        error_log: errors.length ? errors : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule.id);

    return new Response(
      JSON.stringify({ schedule_id: schedule.id, processed, failed, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[APPLY-PRICE-CHANGE] Fatal:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
