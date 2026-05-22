import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getActiveTenant } from '@/lib/tenant';
import { JobRunsClient } from './JobRunsClient';

interface JobRun {
  id: string;
  job_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  total_eligible: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  error_log: unknown[] | null;
  metadata: Record<string, unknown> | null;
  triggered_by: string;
  trigger_details: string | null;
  created_at: string;
}

export default async function BillingJobRunsPage() {
  const supabase = await createServerSupabaseClient();
  const tenant = await getActiveTenant();

  let jobRuns: JobRun[] = [];

  if (tenant) {
    const { data, error } = await (supabase as any)
      .from('billing_job_runs')
      .select('*')
      .eq('organization_id', tenant.organizationId)
      .order('started_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      jobRuns = data as unknown as JobRun[];
    }
  }

  return <JobRunsClient jobRuns={jobRuns} />;
}
