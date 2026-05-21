import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel Cron: Monthly commission accrual sweep.
 *
 * Runs on the 1st of each month at 02:00 UTC. Re-invokes the
 * `process-commissions` edge function which iterates all
 * uncommissioned billing_transactions and creates direct + override
 * commissions for the prior month.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: configs } = await supabase
      .from('billing_automation_config')
      .select('organization_id')
      .eq('commission_enabled', true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: 'No orgs with commission enabled', processed: 0 });
    }

    const results: Array<{ organization_id: string; status: 'success' | 'error'; data?: unknown; error?: string }> = [];

    for (const config of configs) {
      try {
        const { data, error } = await supabase.functions.invoke('process-commissions', {
          body: { organization_id: config.organization_id, source: 'monthly_accrual' },
        });
        if (error) {
          results.push({ organization_id: config.organization_id, status: 'error', error: error.message });
          await supabase.from('billing_job_runs').insert({
            organization_id: config.organization_id,
            job_type: 'commission_accrual',
            triggered_by: 'cron',
            status: 'failed',
            error_log: [error.message],
          });
        } else {
          results.push({ organization_id: config.organization_id, status: 'success', data });
          await supabase.from('billing_job_runs').insert({
            organization_id: config.organization_id,
            job_type: 'commission_accrual',
            triggered_by: 'cron',
            status: 'completed',
            metadata: data,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ organization_id: config.organization_id, status: 'error', error: message });
      }
    }

    return NextResponse.json({
      message: 'Commission accrual cron completed',
      summary: {
        total: configs.length,
        success: results.filter((r) => r.status === 'success').length,
        errored: results.filter((r) => r.status === 'error').length,
      },
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
