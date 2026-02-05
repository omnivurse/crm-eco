import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { applyApprovedAction, getApproval } from '@/lib/approvals';
import { createClient, getAuthProfile, getAuthUser } from '@/lib/supabase-server';

const applyApprovalSchema = z.object({
  approvalId: z.string().uuid(),
});

/**
 * POST /api/approvals/apply
 * Apply an approved action (idempotent)
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = applyApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors }, { status: 400 });
    }

    const { approvalId } = parsed.data;

    // Verify approval belongs to user's org
    const approval = await getApproval(approvalId);
    if (!approval || approval.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    // Get user for applyApprovedAction
    const { user } = await getAuthUser();

    // Apply the approved action
    const result = await applyApprovedAction({
      approvalId,
      profileId: profile.id,
      userId: user!.id,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      applied: result.applied,
    });
  } catch (error) {
    console.error('Apply approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
