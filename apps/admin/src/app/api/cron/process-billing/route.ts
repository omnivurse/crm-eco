import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel Cron route handler for billing processing.
 * Runs hourly; internally gated by billing_automation_config (day + hour).
 */
export async function GET(request: Request) {
  try {
    // Validate CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const db = supabase as any; // New tables not in generated types yet
    const now = new Date();
    const currentDayOfMonth = now.getUTCDate();
    const currentHourUTC = now.getUTCHours();

    // Fetch all orgs with billing enabled
    const { data: configs, error: configError } = await db
      .from('billing_automation_config')
      .select('*')
      .eq('billing_enabled', true);

    if (configError) {
      console.error('Failed to fetch billing configs:', configError);
      return NextResponse.json(
        { error: 'Failed to fetch billing configs', details: configError.message },
        { status: 500 }
      );
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({
        message: 'No orgs with billing enabled',
        processed: 0,
      });
    }

    const results: Array<{
      organization_id: string;
      status: 'skipped' | 'success' | 'error';
      reason?: string;
      error?: string;
    }> = [];

    for (const config of configs) {
      // Check if today matches run_day_of_month and current UTC hour matches run_hour_utc
      if (
        config.run_day_of_month !== currentDayOfMonth ||
        config.run_hour_utc !== currentHourUTC
      ) {
        results.push({
          organization_id: config.organization_id,
          status: 'skipped',
          reason: `Not scheduled (day=${config.run_day_of_month}, hour=${config.run_hour_utc}; now day=${currentDayOfMonth}, hour=${currentHourUTC})`,
        });
        continue;
      }

      try {
        const { data, error } = await supabase.functions.invoke('process-billing', {
          body: { organization_id: config.organization_id },
        });

        if (error) {
          results.push({
            organization_id: config.organization_id,
            status: 'error',
            error: error.message,
          });

          await db.from('billing_job_runs').insert({
            organization_id: config.organization_id,
            job_type: 'billing',
            triggered_by: 'cron',
            status: 'failed',
            error_log: [error.message],
          });
        } else {
          results.push({
            organization_id: config.organization_id,
            status: 'success',
          });

          await db.from('billing_job_runs').insert({
            organization_id: config.organization_id,
            job_type: 'billing',
            triggered_by: 'cron',
            status: 'completed',
            metadata: data,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        results.push({
          organization_id: config.organization_id,
          status: 'error',
          error: errorMessage,
        });

        await db.from('billing_job_runs').insert({
          organization_id: config.organization_id,
          job_type: 'billing',
          triggered_by: 'cron',
          status: 'failed',
          error_log: [errorMessage],
        });
      }
    }

    const processed = results.filter((r) => r.status === 'success').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errored = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      message: 'Billing cron completed',
      summary: { total: configs.length, processed, skipped, errored },
      results,
    });
  } catch (err) {
    console.error('Billing cron fatal error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
