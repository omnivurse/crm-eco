import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { applySponsorEligibilityEndings, isSponsorEligibilityJobEnabled } from '@crm-eco/lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily job: end memberships whose sponsor roster eligibility has passed.
 * Service-role only. Gated by CRON_SECRET.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSponsorEligibilityJobEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'SPONSOR_ELIGIBILITY_JOB_ENABLED=false' });
  }

  const supabase = createServiceRoleClient() as any;
  const { data: rows, error } = await supabase
    .from('sponsors')
    .select('organization_id')
    .eq('status', 'active');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgIds = [
    ...new Set(
      ((rows ?? []) as Array<{ organization_id: string }>).map((r) => r.organization_id)
    ),
  ];
  const results: Array<{ organization_id: string; ended: number; skipped: number; error?: string }> = [];

  for (const organizationId of orgIds) {
    try {
      const outcome = await applySponsorEligibilityEndings(supabase, organizationId);
      results.push({ organization_id: organizationId, ...outcome });
    } catch (err) {
      results.push({
        organization_id: organizationId,
        ended: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : 'failed',
      });
    }
  }

  return NextResponse.json({
    processed: orgIds.length,
    ended: results.reduce((sum, r) => sum + r.ended, 0),
    skipped: results.reduce((sum, r) => sum + r.skipped, 0),
    results,
  });
}
