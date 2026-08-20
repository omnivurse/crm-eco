import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';

/**
 * POST /api/imports/contacts — RETIRED (410).
 *
 * This legacy importer bulk-INSERTed crm_records gated by authentication only
 * (no crm_role check), making it the weakest import door in the app and a
 * bypass of the governed import paths. It had no remaining UI callers.
 *
 * Use instead:
 *   - /crm/imports/update  → update existing records from a CSV (never inserts)
 *   - /crm/import          → governed insert importer (crm_admin / crm_manager)
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'This import endpoint has been retired. Use /crm/imports/update to update ' +
        'existing records from a CSV, or /crm/import to create new records.',
    },
    { status: 410 },
  );
}

/**
 * GET /api/imports/contacts
 * Get import job status (read-only; kept for job-history consumers)
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Get specific job
      const { data: job, error } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('org_id', profile.organization_id)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      return NextResponse.json(job);
    } else {
      // Get recent jobs
      const { data: jobs, error } = await supabase
        .from('crm_import_jobs')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
      }

      return NextResponse.json(jobs || []);
    }
  } catch (error) {
    console.error('Get import jobs error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
