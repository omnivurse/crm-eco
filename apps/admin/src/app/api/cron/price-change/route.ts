import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Vercel Cron: Applies due price-change schedules.
 * Runs daily at 10:00 UTC.
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
      .eq('billing_enabled', true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: 'No orgs with billing enabled', processed: 0 });
    }

    const results: Array<{ organization_id: string; status: 'success' | 'error'; data?: unknown; error?: string }> = [];

    for (const config of configs) {
      try {
        const { data, error } = await supabase.functions.invoke('apply-price-change', {
          body: { organization_id: config.organization_id },
        });
        if (error) {
          results.push({ organization_id: config.organization_id, status: 'error', error: error.message });
        } else {
          results.push({ organization_id: config.organization_id, status: 'success', data });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ organization_id: config.organization_id, status: 'error', error: message });
      }
    }

    return NextResponse.json({
      message: 'Price-change cron completed',
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
