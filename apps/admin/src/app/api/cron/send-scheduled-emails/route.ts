import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Validate CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Invoke the send-scheduled-emails edge function (runs for all orgs)
    const { data, error } = await supabase.functions.invoke('send-scheduled-emails');

    if (error) {
      console.error('Failed to send scheduled emails:', error);
      return NextResponse.json(
        {
          message: 'Scheduled emails cron failed',
          status: 'error',
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Scheduled emails cron completed',
      status: 'success',
      data,
    });
  } catch (err) {
    console.error('Scheduled emails cron fatal error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
