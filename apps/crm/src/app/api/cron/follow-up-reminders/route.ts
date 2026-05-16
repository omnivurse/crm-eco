/**
 * GET /api/cron/follow-up-reminders
 *
 * Hourly cron that checks for due follow-up tasks and creates in-app
 * notifications.  If the task has a repeat_interval_days, it keeps
 * generating daily notifications until the task is marked completed.
 *
 * Idempotent — safe to invoke repeatedly.  De-duplicates by checking
 * whether a notification was already sent for the same task within the
 * last 24 hours (or within the repeat interval, whichever is shorter).
 *
 * Schedule: every hour (via Vercel cron)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function authorised(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role unavailable' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    // Find all due follow-up tasks that are still open
    const { data: dueTasks, error: fetchError } = await supabase
      .from('crm_tasks')
      .select(`
        id, org_id, record_id, title, due_at, priority,
        assigned_to, follow_up_note, repeat_interval_days,
        created_by
      `)
      .eq('activity_type', 'follow_up')
      .in('status', ['open', 'in_progress'])
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(200);

    if (fetchError) {
      console.error('[follow-up-cron] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!dueTasks || dueTasks.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0 });
    }

    let processed = 0;
    let skipped = 0;

    for (const task of dueTasks) {
      const userId = task.assigned_to || task.created_by;
      if (!userId) {
        skipped++;
        continue;
      }

      // De-duplicate: check for recent notification for this task
      const dedupeWindow = Math.min(
        (task.repeat_interval_days || 1) * 24,
        24,
      ); // hours
      const windowStart = new Date(
        Date.now() - dedupeWindow * 60 * 60 * 1000,
      ).toISOString();

      const { data: existing } = await supabase
        .from('crm_notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('org_id', task.org_id)
        .gte('created_at', windowStart)
        .like('meta->>task_id', task.id)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Build notification
      const noteSnippet = task.follow_up_note
        ? ` — ${task.follow_up_note.slice(0, 120)}`
        : '';
      const isOverdue = task.due_at && new Date(task.due_at) < new Date();
      const title = isOverdue
        ? `⏰ Overdue follow-up: ${task.title}`
        : `🔔 Follow-up due: ${task.title}`;

      const { error: insertError } = await supabase
        .from('crm_notifications')
        .insert({
          org_id: task.org_id,
          user_id: userId,
          title,
          body: `Follow up is due${noteSnippet}`,
          href: task.record_id ? `/crm/r/${task.record_id}` : undefined,
          icon: 'bell',
          meta: { task_id: task.id, source: 'follow_up_cron' },
        });

      if (insertError) {
        console.error(
          `[follow-up-cron] notification insert error for task ${task.id}:`,
          insertError,
        );
        skipped++;
        continue;
      }

      processed++;
    }

    return NextResponse.json({ processed, skipped, total: dueTasks.length });
  } catch (error) {
    console.error('[follow-up-cron] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
