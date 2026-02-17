import { NextRequest, NextResponse } from 'next/server';
import { getAuthProfile } from '@/lib/supabase-server';
import { createCrmClient } from '@/lib/crm/queries';
import type {
  WorkqueueItem,
  WorkqueueSummary,
  WorkqueueResponse,
  WorkqueueTab,
  WorkqueueAction,
  WorkqueuePriority,
} from '@/lib/workqueue/types';

// ---------------------------------------------------------------------------
// Priority ordering for final sort
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<WorkqueuePriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// ---------------------------------------------------------------------------
// Action presets per item type
// ---------------------------------------------------------------------------

const APPROVAL_ACTIONS: WorkqueueAction[] = [
  { key: 'approve', label: 'Approve', variant: 'primary' },
  { key: 'reject', label: 'Reject', variant: 'danger' },
  { key: 'open', label: 'View', variant: 'secondary' },
];

const TASK_ACTIONS: WorkqueueAction[] = [
  { key: 'complete', label: 'Complete', variant: 'primary' },
  { key: 'snooze', label: 'Snooze', variant: 'secondary' },
  { key: 'open', label: 'View', variant: 'secondary' },
];

const DEAL_ACTIONS: WorkqueueAction[] = [
  { key: 'open', label: 'View Deal', variant: 'primary' },
];

const MESSAGE_ACTIONS: WorkqueueAction[] = [
  { key: 'reply', label: 'Reply', variant: 'primary' },
  { key: 'open', label: 'Open', variant: 'secondary' },
];

// ---------------------------------------------------------------------------
// GET /api/crm/workqueue
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get('tab') || 'all') as WorkqueueTab;

    const supabase = await createCrmClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    // Run all queries in parallel
    const [
      approvalsResult,
      overdueResult,
      todayResult,
      followUpResult,
      dealsModuleResult,
      messagesResult,
    ] = await Promise.allSettled([
      // 1. Pending approvals assigned to current user
      tab === 'all' || tab === 'approvals'
        ? supabase
            .from('crm_approvals')
            .select(`
              id,
              status,
              current_step,
              context,
              requested_by,
              created_at,
              record_id,
              process_id
            `)
            .eq('org_id', profile.organization_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // 2. Overdue tasks
      tab === 'all' || tab === 'tasks'
        ? supabase
            .from('crm_tasks')
            .select('id, title, description, due_at, priority, status, record_id, activity_type, created_at')
            .eq('org_id', profile.organization_id)
            .eq('assigned_to', profile.id)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .lt('due_at', today)
            .order('due_at', { ascending: true })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // 3. Today's tasks
      tab === 'all' || tab === 'tasks'
        ? supabase
            .from('crm_tasks')
            .select('id, title, description, due_at, priority, status, record_id, activity_type, created_at')
            .eq('org_id', profile.organization_id)
            .eq('assigned_to', profile.id)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .gte('due_at', today)
            .lte('due_at', today + 'T23:59:59')
            .order('due_at', { ascending: true })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // 4. Follow-ups (tasks with reminder_at in next 24h)
      tab === 'all' || tab === 'tasks'
        ? supabase
            .from('crm_tasks')
            .select('id, title, description, due_at, priority, status, record_id, activity_type, reminder_at, created_at')
            .eq('org_id', profile.organization_id)
            .eq('assigned_to', profile.id)
            .neq('status', 'completed')
            .neq('status', 'cancelled')
            .not('reminder_at', 'is', null)
            .lte('reminder_at', new Date(now.getTime() + 86400000).toISOString())
            .order('reminder_at', { ascending: true })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // 5. Deals module ID (needed to query at-risk deals)
      tab === 'all' || tab === 'deals'
        ? supabase
            .from('crm_modules')
            .select('id')
            .eq('org_id', profile.organization_id)
            .eq('key', 'deals')
            .single()
        : Promise.resolve({ data: null, error: null }),

      // 6. Unread inbox conversations
      tab === 'all' || tab === 'messages'
        ? supabase
            .from('inbox_conversations')
            .select('id, subject, snippet, channel, status, assigned_to, contact_name, contact_email, unread_count, last_message_at, created_at')
            .eq('org_id', profile.organization_id)
            .eq('assigned_to', profile.id)
            .gt('unread_count', 0)
            .in('status', ['open', 'pending'])
            .order('last_message_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Fetch at-risk deals if we have the module ID
    let atRiskDeals: any[] = [];
    if (tab === 'all' || tab === 'deals') {
      const dealsModule = dealsModuleResult.status === 'fulfilled' ? dealsModuleResult.value.data : null;
      if (dealsModule?.id) {
        const { data } = await supabase
          .from('crm_records')
          .select('id, title, status, stage, updated_at, created_at')
          .eq('module_id', dealsModule.id)
          .eq('owner_id', profile.id)
          .lt('updated_at', weekAgo)
          .not('stage', 'in', '("Closed Won","Closed Lost","closed_won","closed_lost")')
          .order('updated_at', { ascending: true })
          .limit(10);
        atRiskDeals = data || [];
      }
    }

    // Normalize all results into WorkqueueItem[]
    const items: WorkqueueItem[] = [];

    // -- Approvals -------------------------------------------------------
    const approvals = approvalsResult.status === 'fulfilled'
      ? (approvalsResult.value as any).data || []
      : [];

    // Fetch process names for approvals
    if (approvals.length > 0) {
      const processIds = [...new Set(approvals.map((a: any) => a.process_id))];
      const { data: processes } = await supabase
        .from('crm_approval_processes')
        .select('id, name')
        .in('id', processIds);
      const processMap = new Map((processes || []).map((p: any) => [p.id, p.name]));

      const recordIds = [...new Set(approvals.map((a: any) => a.record_id))];
      const { data: records } = await supabase
        .from('crm_records')
        .select('id, title')
        .in('id', recordIds);
      const recordMap = new Map((records || []).map((r: any) => [r.id, r.title]));

      for (const a of approvals) {
        items.push({
          id: a.id,
          type: 'pending_approval',
          priority: 'high',
          title: recordMap.get(a.record_id) || 'Approval Request',
          subtitle: `${processMap.get(a.process_id) || 'Approval'} - Step ${(a.current_step || 0) + 1}`,
          recordId: a.record_id,
          recordTitle: recordMap.get(a.record_id) || undefined,
          meta: { context: a.context, processId: a.process_id },
          createdAt: a.created_at,
          actions: APPROVAL_ACTIONS,
        });
      }
    }

    // -- Overdue tasks ----------------------------------------------------
    const overdueTasks = overdueResult.status === 'fulfilled'
      ? (overdueResult.value as any).data || []
      : [];

    for (const t of overdueTasks) {
      items.push({
        id: t.id,
        type: 'overdue_task',
        priority: t.priority === 'urgent' ? 'urgent' : 'high',
        title: t.title || 'Untitled Task',
        subtitle: t.due_at
          ? `Due ${new Date(t.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'No due date',
        recordId: t.record_id || undefined,
        meta: { activityType: t.activity_type, priority: t.priority, status: t.status },
        createdAt: t.created_at,
        dueAt: t.due_at || undefined,
        actions: TASK_ACTIONS,
      });
    }

    // -- Today's tasks ----------------------------------------------------
    const todayTasks = todayResult.status === 'fulfilled'
      ? (todayResult.value as any).data || []
      : [];

    for (const t of todayTasks) {
      items.push({
        id: t.id,
        type: 'today_task',
        priority: t.priority === 'urgent' ? 'urgent' : t.priority === 'high' ? 'high' : 'normal',
        title: t.title || 'Untitled Task',
        subtitle: t.due_at
          ? `Due today at ${new Date(t.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          : 'Due today',
        recordId: t.record_id || undefined,
        meta: { activityType: t.activity_type, priority: t.priority, status: t.status },
        createdAt: t.created_at,
        dueAt: t.due_at || undefined,
        actions: TASK_ACTIONS,
      });
    }

    // -- Follow-ups -------------------------------------------------------
    const followUps = followUpResult.status === 'fulfilled'
      ? (followUpResult.value as any).data || []
      : [];

    // Deduplicate: skip follow-ups already in overdue / today
    const seenTaskIds = new Set([...overdueTasks, ...todayTasks].map((t: any) => t.id));
    for (const t of followUps) {
      if (seenTaskIds.has(t.id)) continue;
      items.push({
        id: t.id,
        type: 'follow_up',
        priority: 'normal',
        title: t.title || 'Follow Up',
        subtitle: t.reminder_at
          ? `Reminder: ${new Date(t.reminder_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
          : 'Follow-up reminder',
        recordId: t.record_id || undefined,
        meta: { activityType: t.activity_type, reminderAt: t.reminder_at },
        createdAt: t.created_at,
        dueAt: t.due_at || undefined,
        actions: TASK_ACTIONS,
      });
    }

    // -- At-risk deals ----------------------------------------------------
    for (const d of atRiskDeals) {
      const daysStale = Math.floor(
        (now.getTime() - new Date(d.updated_at).getTime()) / 86400000
      );
      items.push({
        id: d.id,
        type: 'at_risk_deal',
        priority: daysStale > 14 ? 'high' : 'normal',
        title: d.title || 'Untitled Deal',
        subtitle: `${d.stage || 'Unknown stage'} - ${daysStale}d without update`,
        recordId: d.id,
        recordTitle: d.title || undefined,
        moduleKey: 'deals',
        meta: { stage: d.stage, daysStale, status: d.status },
        createdAt: d.created_at,
        actions: DEAL_ACTIONS,
      });
    }

    // -- Unread messages --------------------------------------------------
    const messages = messagesResult.status === 'fulfilled'
      ? (messagesResult.value as any).data || []
      : [];

    for (const m of messages) {
      items.push({
        id: m.id,
        type: 'unread_message',
        priority: 'normal',
        title: m.contact_name || m.contact_email || 'Unknown Contact',
        subtitle: m.snippet || m.subject || 'New message',
        meta: {
          channel: m.channel,
          unreadCount: m.unread_count,
          contactEmail: m.contact_email,
        },
        createdAt: m.last_message_at || m.created_at,
        actions: MESSAGE_ACTIONS,
      });
    }

    // Sort: priority first, then most recent
    items.sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Build summary counts
    const summary: WorkqueueSummary = {
      approvals: items.filter((i) => i.type === 'pending_approval').length,
      overdueTasks: items.filter((i) => i.type === 'overdue_task').length,
      todayTasks: items.filter((i) => i.type === 'today_task').length,
      followUps: items.filter((i) => i.type === 'follow_up').length,
      atRiskDeals: items.filter((i) => i.type === 'at_risk_deal').length,
      messages: items.filter((i) => i.type === 'unread_message').length,
      total: items.length,
    };

    const response: WorkqueueResponse = { items, summary };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Workqueue] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
