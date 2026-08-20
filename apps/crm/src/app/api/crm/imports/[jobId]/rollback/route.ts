/**
 * POST /api/crm/imports/[jobId]/rollback
 * ---------------------------------------------------------------------------
 * Undo a CSV update by restoring the per-row before-images recorded when it
 * ran (`fn_rollback_csv_update`).
 *
 * The restore is CONDITIONAL, and that is the whole point: a key is put back
 * only while its live value still equals what the import wrote. Anything a
 * person edited afterwards is left alone and reported, so an undo can never
 * silently discard a month of manual work.
 *
 * Insert-style imports keep using fn_rollback_import; that function now
 * refuses csv_update jobs rather than reverting nothing while marking them
 * rolled back.
 *
 * Authz: CRM admin or manager (re-checked inside the SECURITY DEFINER
 * function against the JOB's org, not the caller's claim).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = await createClient();
  const roleGate = await requireActiveOrgCrmRoles(
    supabase,
    profile.organization_id,
    ['crm_admin', 'crm_manager'],
  );
  if (!roleGate.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Defense in depth: the RPC re-checks the role against the job's own org,
  // but never hand it a job id from another tenant in the first place.
  const { data: job, error: jobErr } = await supabase
    .from('crm_import_jobs')
    .select('id, source_type, status, started_at, created_at')
    .eq('id', jobId)
    .eq('org_id', profile.organization_id)
    .maybeSingle();

  if (jobErr) {
    return NextResponse.json({ error: jobErr.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: 'Import job not found' }, { status: 404 });
  }
  if (job.source_type !== 'csv_update') {
    return NextResponse.json(
      {
        error:
          'Only CSV updates can be undone this way. An insert import is rolled back separately.',
      },
      { status: 400 },
    );
  }
  // A resumable apply sits in 'processing' between passes, and an abandoned
  // one (closed tab, lost connection) stays there forever. Refusing every
  // 'processing' job would make exactly those half-applied runs — the ones
  // most in need of an undo — permanently un-undoable. So refuse only while a
  // run could still plausibly be live; after that the ledger is authoritative
  // and the function takes a row lock anyway.
  const STALE_AFTER_MS = 15 * 60 * 1000;
  if (job.status === 'processing') {
    const startedAt = new Date(job.started_at ?? job.created_at).getTime();
    if (Number.isFinite(startedAt) && Date.now() - startedAt < STALE_AFTER_MS) {
      return NextResponse.json(
        {
          error:
            'This update is still running. Let it finish, or try again in a few minutes.',
        },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabase.rpc('fn_rollback_csv_update', {
    p_job_id: jobId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error_message) {
    return NextResponse.json({ error: row.error_message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    restoredRecords: row?.restored_count ?? 0,
    // Keys a person changed after the import — deliberately NOT reverted.
    skippedChangedKeys: row?.skipped_changed_count ?? 0,
    skippedMissingRecords: row?.skipped_missing_count ?? 0,
  });
}
