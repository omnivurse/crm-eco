import { NextResponse } from 'next/server';
import { planAbandonedEnrollmentReminders } from '@crm-eco/lib';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Finds stale draft/in-progress enrollments and optionally enrolls them in a
 * CRM sequence. Real send stays off unless ABANDONED_ENROLLMENT_EMAIL_ENABLED=true
 * and ABANDONED_ENROLLMENT_SEQUENCE_ID is set.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient() as any;
  const staleDays = Number(process.env.ABANDONED_ENROLLMENT_STALE_DAYS || 2);
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, organization_id, status, updated_at, primary_member_id')
    .in('status', ['draft', 'in_progress'])
    .lt('updated_at', cutoff)
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const send = process.env.ABANDONED_ENROLLMENT_EMAIL_ENABLED === 'true';
  const sequenceId = process.env.ABANDONED_ENROLLMENT_SEQUENCE_ID || '';
  const rows = (data ?? []) as Array<{
    id: string;
    organization_id: string;
    status: string;
    updated_at: string;
    primary_member_id?: string | null;
  }>;
  const memberIds = [...new Set(rows.map((row) => row.primary_member_id).filter(Boolean))] as string[];
  const emails = new Map<string, string>();
  if (memberIds.length) {
    const { data: members } = await supabase
      .from('members')
      .select('id, email')
      .in('id', memberIds);
    for (const member of members ?? []) {
      if (member.email) emails.set(member.id, member.email);
    }
  }
  const candidates = rows.map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    status: row.status,
    updated_at: row.updated_at,
    email: row.primary_member_id ? emails.get(row.primary_member_id) ?? null : null,
  }));

  const planned = planAbandonedEnrollmentReminders(candidates, {
    staleBeforeIso: cutoff,
    sendEnabled: send && !!sequenceId,
  });

  let enrolled = 0;
  if (!planned.dryRun && sequenceId) {
    const { data: steps } = await supabase
      .from('email_sequence_steps')
      .select('id, step_order, delay_days, delay_hours, delay_minutes, send_time, send_days')
      .eq('sequence_id', sequenceId)
      .order('step_order', { ascending: true })
      .limit(1);
    const firstStep = steps?.[0];
    if (firstStep) {
      const inserts = planned.toEnroll.map((row) => ({
        sequence_id: sequenceId,
        record_id: row.id,
        module_key: 'enrollments',
        email: row.email,
        current_step_id: firstStep.id,
        current_step_order: firstStep.step_order,
        status: 'active',
        next_step_at: new Date().toISOString(),
        metadata: { source: 'abandoned_enrollment_cron', dry_run_recipient: process.env.ABANDONED_ENROLLMENT_DRY_RUN_TO || null },
      }));
      if (inserts.length) {
        const { data: created, error: insertError } = await supabase
          .from('email_sequence_enrollments')
          .insert(inserts)
          .select('id');
        if (!insertError) enrolled = created?.length ?? 0;
      }
    }
  }

  return NextResponse.json({
    stale: planned.stale,
    emailed: enrolled,
    dryRun: planned.dryRun,
    enrollments: planned.enrollmentIds,
  });
}
