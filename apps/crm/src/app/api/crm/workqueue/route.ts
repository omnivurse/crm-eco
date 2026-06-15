import { NextRequest, NextResponse } from 'next/server';
import { applyHideConvertedLeadsFilter, isConvertedLeadRow } from '@/lib/crm/record-search';
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
import { loadActionableApprovalsForWorkqueue } from '@/lib/workqueue/load-actionable-approvals-for-workqueue';

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

const LEAD_ACTIONS: WorkqueueAction[] = [
  { key: 'open', label: 'View Lead', variant: 'primary' },
  { key: 'dismiss', label: 'Dismiss', variant: 'secondary' },
];

const MESSAGE_ACTIONS: WorkqueueAction[] = [
  { key: 'reply', label: 'Reply', variant: 'primary' },
  { key: 'open', label: 'Open', variant: 'secondary' },
];

/** Deal stages treated as closed for at-risk/stale logic */
const CLOSED_DEAL_STAGES =
  '("Closed Won","Closed Lost","closed_won","closed_lost")';

/** Lead stages that should not appear in the "new leads" workqueue */
const LEAD_WORKQUEUE_OR_FILTER =
  'stage.is.null,stage.not.in.(Converted,converted,Disqualified,disqualified,Closed,closed,"Closed Won","Closed Lost",closed_won,closed_lost)';

async function fetchExactCount(
  label: string,
  req: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  try {
    const { count, error } = await req;
    if (error) {
      console.warn(`[Workqueue] ${label} count:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.warn(`[Workqueue] ${label} count failed:`, e);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// GET /api/crm/workqueue
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !profile.organization_id ||
      (typeof profile.organization_id === 'string' && profile.organization_id.trim() === '')
    ) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const tab = (searchParams.get('tab') || 'all') as WorkqueueTab;

    const supabase = await createCrmClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    // Run all queries in parallel (pending approvals: paginated load after this — see below)
    const [
      overdueResult,
      todayResult,
      followUpResult,
      dealsModuleResult,
      messagesResult,
      leadsModuleResult,
    ] = await Promise.allSettled([
      // 1. Overdue tasks
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

      // 2. Today's tasks
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

      // 3. Follow-ups (tasks with reminder_at in next 24h)
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

      // 4. Deals module ID (needed to query at-risk deals)
      tab === 'all' || tab === 'deals'
        ? supabase
            .from('crm_modules')
            .select('id')
            .eq('org_id', profile.organization_id)
            .eq('key', 'deals')
            .single()
        : Promise.resolve({ data: null, error: null }),

      // 5. Unread inbox conversations
      tab === 'all' || tab === 'messages'
        ? supabase
            .from('inbox_conversations')
            .select('id, subject, preview, channel, status, assigned_to, contact_name, contact_email, unread_count, last_message_at, created_at')
            .eq('org_id', profile.organization_id)
            .eq('assigned_to', profile.id)
            .gt('unread_count', 0)
            .in('status', ['open', 'pending'])
            .order('last_message_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),

      // 6. Leads module ID (needed to query new leads)
      tab === 'all' || tab === 'leads'
        ? supabase
            .from('crm_modules')
            .select('id')
            .eq('org_id', profile.organization_id)
            .eq('key', 'leads')
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Fetch at-risk deals if we have the module ID
    let atRiskDeals: any[] = [];
    if (tab === 'all' || tab === 'deals') {
      const dealsModule = dealsModuleResult.status === 'fulfilled' ? dealsModuleResult.value.data : null;
      if (dealsModule?.id) {
        const { data } = await supabase
          .from('crm_records')
          .select('id, title, status, stage, updated_at, created_at')
          .eq('org_id', profile.organization_id)
          .eq('module_id', dealsModule.id)
          .eq('owner_id', profile.id)
          .lt('updated_at', weekAgo)
          .not('stage', 'in', CLOSED_DEAL_STAGES)
          .order('updated_at', { ascending: true })
          .limit(10);
        atRiskDeals = data || [];
      }
    }

    // Normalize all results into WorkqueueItem[]
    const items: WorkqueueItem[] = [];
    /** Actionable pending approvals for this user (same rules as approvals engine). */
    let actionableApprovalCount = 0;

    // -- Approvals (exact count: scan all pending rows in stable pages) -----
    if (tab === 'all' || tab === 'approvals') {
      const { totalActionable, topForUi } = await loadActionableApprovalsForWorkqueue(
        supabase,
        profile.organization_id,
        profile.id,
        profile.crm_role ?? null,
      );
      actionableApprovalCount = totalActionable;
      for (const { row: a, processName, recordTitle } of topForUi) {
        items.push({
          id: a.id,
          type: 'pending_approval',
          priority: 'high',
          title: recordTitle || 'Approval Request',
          subtitle: `${processName} - Step ${(a.current_step || 0) + 1}`,
          recordId: a.record_id,
          recordTitle: recordTitle || undefined,
          meta: { context: a.context, processId: a.process_id },
          createdAt: a.created_at,
          actions: APPROVAL_ACTIONS,
        });
      }
    }

    // -- Overdue tasks ----------------------------------------------------
    const overdueTasks = overdueResult.status === 'fulfilled'
      ? (overdueResult.value as { data: any[] | null }).data || []
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
      ? (todayResult.value as { data: any[] | null }).data || []
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
      ? (followUpResult.value as { data: any[] | null }).data || []
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

    // -- New leads --------------------------------------------------------
    let newLeads: any[] = [];
    if (tab === 'all' || tab === 'leads') {
      const leadsModule = leadsModuleResult.status === 'fulfilled' ? leadsModuleResult.value.data : null;
      if (leadsModule?.id) {
        let leadsQuery = supabase
          .from('crm_records')
          .select('id, title, status, stage, data, owner_id, created_at, updated_at')
          .eq('org_id', profile.organization_id)
          .eq('module_id', leadsModule.id)
          .or(`owner_id.eq.${profile.id},owner_id.is.null`)
          .or(LEAD_WORKQUEUE_OR_FILTER);

        leadsQuery = applyHideConvertedLeadsFilter(leadsQuery);

        const { data, error: leadsError } = await leadsQuery
          .order('created_at', { ascending: false })
          .limit(20);
        if (leadsError) {
          console.error('[Workqueue] Leads query error:', leadsError.message);
        }
        newLeads = (data || []).filter(
          (row) => !isConvertedLeadRow({ module_key: 'leads', status: row.status, data: row.data }),
        );
      } else {
        console.warn('[Workqueue] No leads module found for org:', profile.organization_id);
      }
    }

    for (const l of newLeads) {
      const isNew = (Date.now() - new Date(l.created_at).getTime()) < 48 * 3600000; // Created in last 48h
      items.push({
        id: l.id,
        type: 'new_lead',
        priority: isNew ? 'high' : 'normal',
        title: l.title || 'Untitled Lead',
        subtitle: l.stage
          ? `${l.stage}${l.data?.company ? ' · ' + l.data.company : ''}`
          : l.data?.company ? String(l.data.company) : 'New lead — needs attention',
        recordId: l.id,
        recordTitle: l.title || undefined,
        moduleKey: 'leads',
        meta: { stage: l.stage, status: l.status, ownerId: l.owner_id },
        createdAt: l.created_at,
        actions: LEAD_ACTIONS,
      });
    }

    // -- Unread messages --------------------------------------------------
    const messages = messagesResult.status === 'fulfilled'
      ? (messagesResult.value as { data: any[] | null }).data || []
      : [];

    for (const m of messages) {
      items.push({
        id: m.id,
        type: 'unread_message',
        priority: 'normal',
        title: m.contact_name || m.contact_email || 'Unknown Contact',
        subtitle: m.preview || m.subject || 'New message',
        meta: {
          channel: m.channel,
          unreadCount: m.unread_count,
          contactEmail: m.contact_email,
        },
        createdAt: m.last_message_at || m.created_at,
        actions: MESSAGE_ACTIONS,
      });
    }

    // ---------------------------------------------------------------------
    // Exact summary counts (not limited to list fetch caps)
    // ---------------------------------------------------------------------
    const dealsModuleForCount =
      dealsModuleResult.status === 'fulfilled' ? dealsModuleResult.value.data : null;
    const leadsModuleForCount =
      leadsModuleResult.status === 'fulfilled' ? leadsModuleResult.value.data : null;
    const reminderHorizon = new Date(now.getTime() + 86400000).toISOString();

    const [
      overdueCount,
      todayCount,
      followUpCount,
      atRiskCount,
      msgCount,
      leadCount,
    ] = await Promise.all([
      fetchExactCount(
        'overdue-tasks',
        supabase
          .from('crm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('assigned_to', profile.id)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .lt('due_at', today),
      ),
      fetchExactCount(
        'today-tasks',
        supabase
          .from('crm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('assigned_to', profile.id)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .gte('due_at', today)
          .lte('due_at', `${today}T23:59:59`),
      ),
      fetchExactCount(
        'follow-ups',
        supabase
          .from('crm_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('assigned_to', profile.id)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .not('reminder_at', 'is', null)
          .lte('reminder_at', reminderHorizon),
      ),
      dealsModuleForCount?.id
        ? fetchExactCount(
            'at-risk-deals',
            supabase
              .from('crm_records')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', profile.organization_id)
              .eq('module_id', dealsModuleForCount.id)
              .eq('owner_id', profile.id)
              .lt('updated_at', weekAgo)
              .not('stage', 'in', CLOSED_DEAL_STAGES),
          )
        : Promise.resolve(0),
      fetchExactCount(
        'messages',
        supabase
          .from('inbox_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', profile.organization_id)
          .eq('assigned_to', profile.id)
          .gt('unread_count', 0)
          .in('status', ['open', 'pending']),
      ),
      leadsModuleForCount?.id
        ? (async () => {
            let q = supabase
              .from('crm_records')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', profile.organization_id)
              .eq('module_id', leadsModuleForCount.id)
              .or(`owner_id.eq.${profile.id},owner_id.is.null`)
              .or(LEAD_WORKQUEUE_OR_FILTER);
            q = applyHideConvertedLeadsFilter(q);
            return fetchExactCount('new-leads', q);
          })()
        : Promise.resolve(0),
    ]);

    // Sort: priority first, then most recent
    items.sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Build summary counts
    const summary: WorkqueueSummary = {
      approvals: actionableApprovalCount,
      overdueTasks: overdueCount,
      todayTasks: todayCount,
      followUps: followUpCount,
      atRiskDeals: atRiskCount,
      messages: msgCount,
      newLeads: leadCount,
      total:
        actionableApprovalCount +
        overdueCount +
        todayCount +
        followUpCount +
        atRiskCount +
        msgCount +
        leadCount,
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
