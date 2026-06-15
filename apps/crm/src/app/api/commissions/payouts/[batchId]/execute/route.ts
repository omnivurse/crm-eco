import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase-server';
import { executeBatch } from '@/lib/payouts/execute-batch';
import {
  assertCommissionBatchOrgAccess,
  requireCrmOrgContext,
} from '@/lib/crm/require-crm-org';

export const dynamic = 'force-dynamic';

// Use service role for provider transaction management
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/commissions/payouts/[batchId]/execute
 *
 * Executes a payout batch through the configured payment provider.
 * Batch must be in 'processing' state (approved).
 *
 * Body:
 *   providerId – optional specific provider ID (uses org default if omitted)
 *
 * Idempotent: re-executing a completed batch is a no-op.
 * Concurrency safe: DB advisory locks prevent double execution.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const orgCtx = await requireCrmOrgContext();
    if (!orgCtx.ok) {
      return NextResponse.json({ error: orgCtx.error }, { status: orgCtx.status });
    }

    if (!['owner', 'super_admin', 'admin'].includes(orgCtx.profile.role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;
    const body = await request.json().catch(() => ({}));
    const { providerId } = body;

    const sessionClient = await createSessionClient();
    const batchAccess = await assertCommissionBatchOrgAccess(
      sessionClient,
      batchId,
      orgCtx.orgId,
    );
    if (!batchAccess.ok) {
      return NextResponse.json({ error: batchAccess.error }, { status: batchAccess.status });
    }

    const supabase = getServiceClient();

    const result = await executeBatch(supabase, batchId, providerId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error executing payout batch:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute payout batch' },
      { status: 500 }
    );
  }
}
