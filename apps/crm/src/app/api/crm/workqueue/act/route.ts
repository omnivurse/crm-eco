import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile, getAuthUser } from '@/lib/supabase-server';
import { createCrmClient } from '@/lib/crm/queries';
import { executeApprovalAction } from '@/lib/approvals';
import { z } from 'zod';
import type { WorkqueueActRequest, WorkqueueActResponse } from '@/lib/workqueue/types';

const actSchema = z.object({
  itemId: z.string().uuid(),
  itemType: z.enum([
    'pending_approval',
    'overdue_task',
    'today_task',
    'follow_up',
    'at_risk_deal',
    'unread_message',
    'new_lead',
  ]),
  action: z.enum([
    'approve',
    'reject',
    'request_changes',
    'complete',
    'snooze',
    'open',
    'dismiss',
    'reply',
  ]),
  comment: z.string().optional(),
});

/**
 * POST /api/crm/workqueue/act
 * Quick-action handler for workqueue items.
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies WorkqueueActResponse, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' } satisfies WorkqueueActResponse, { status: 403 });
    }

    const body = await request.json();
    const parsed = actSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' } satisfies WorkqueueActResponse,
        { status: 400 },
      );
    }

    const { itemId, itemType, action, comment } = parsed.data;

    // -------------------------------------------------------------------
    // Approval actions
    // -------------------------------------------------------------------
    if (itemType === 'pending_approval') {
      if (!['approve', 'reject', 'request_changes'].includes(action)) {
        return NextResponse.json(
          { success: false, error: `Action "${action}" not valid for approvals` } satisfies WorkqueueActResponse,
          { status: 400 },
        );
      }

      const { user } = await getAuthUser();
      if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' } satisfies WorkqueueActResponse, { status: 401 });
      }

      const result = await executeApprovalAction(
        {
          approvalId: itemId,
          action: action as 'approve' | 'reject' | 'request_changes',
          comment: comment || undefined,
        },
        {
          profileId: profile.id,
          userId: user.id,
          userRole: profile.crm_role,
        },
      );

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Approval action failed' } satisfies WorkqueueActResponse,
          { status: 400 },
        );
      }

      return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
    }

    // -------------------------------------------------------------------
    // Task actions (overdue_task, today_task, follow_up)
    // -------------------------------------------------------------------
    if (['overdue_task', 'today_task', 'follow_up'].includes(itemType)) {
      const supabase = await createCrmClient();

      if (action === 'complete') {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('org_id', profile.organization_id)
          .select('id')
          .single();

        if (error) {
          const msg = error.code === 'PGRST116' ? 'Task not found or access denied' : error.message;
          return NextResponse.json(
            { success: false, error: msg } satisfies WorkqueueActResponse,
            { status: error.code === 'PGRST116' ? 404 : 500 },
          );
        }

        return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
      }

      if (action === 'snooze') {
        const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ reminder_at: snoozeUntil, updated_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('org_id', profile.organization_id)
          .select('id')
          .single();

        if (error) {
          const msg = error.code === 'PGRST116' ? 'Task not found or access denied' : error.message;
          return NextResponse.json(
            { success: false, error: msg } satisfies WorkqueueActResponse,
            { status: error.code === 'PGRST116' ? 404 : 500 },
          );
        }

        return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
      }

      if (action === 'dismiss') {
        const { data, error } = await supabase
          .from('crm_tasks')
          .update({ reminder_at: null, updated_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('org_id', profile.organization_id)
          .select('id')
          .single();

        if (error) {
          const msg = error.code === 'PGRST116' ? 'Task not found or access denied' : error.message;
          return NextResponse.json(
            { success: false, error: msg } satisfies WorkqueueActResponse,
            { status: error.code === 'PGRST116' ? 404 : 500 },
          );
        }

        return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
      }

      // 'open' is handled client-side (navigation)
      return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
    }

    // -------------------------------------------------------------------
    // Message actions (dismiss / mark read)
    // -------------------------------------------------------------------
    if (itemType === 'unread_message') {
      if (action === 'dismiss') {
        const supabase = await createCrmClient();
        const { error } = await supabase
          .from('inbox_conversations')
          .update({ unread_count: 0, last_read_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('org_id', profile.organization_id);

        if (error) {
          return NextResponse.json(
            { success: false, error: error.message } satisfies WorkqueueActResponse,
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
      }

      // 'open' / 'reply' handled client-side
      return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
    }

    // -------------------------------------------------------------------
    // Lead actions (dismiss updates stage to "Contacted")
    // -------------------------------------------------------------------
    if (itemType === 'new_lead') {
      if (action === 'dismiss') {
        const supabase = await createCrmClient();
        const { error } = await supabase
          .from('crm_records')
          .update({ stage: 'Contacted', updated_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('org_id', profile.organization_id);

        if (error) {
          return NextResponse.json(
            { success: false, error: error.message } satisfies WorkqueueActResponse,
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
      }

      // 'open' handled client-side
      return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
    }

    // -------------------------------------------------------------------
    // Deal actions -- all client-side navigation
    // -------------------------------------------------------------------
    if (itemType === 'at_risk_deal') {
      return NextResponse.json({ success: true } satisfies WorkqueueActResponse);
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported item type' } satisfies WorkqueueActResponse,
      { status: 400 },
    );
  } catch (error) {
    console.error('[Workqueue] Act error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } satisfies WorkqueueActResponse,
      { status: 500 },
    );
  }
}
