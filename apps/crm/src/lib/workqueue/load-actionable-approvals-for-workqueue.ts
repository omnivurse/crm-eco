import type { SupabaseClient } from '@supabase/supabase-js';
import {
  filterApprovalsActionableByProfile,
  type PendingApprovalRow,
  type ProcessStepRow,
  type RecordOwnerRow,
} from '@/lib/workqueue/filter-actionable-approvals';

const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_LIST_CAP = 20;

export interface ActionableApprovalListEntry {
  row: PendingApprovalRow;
  processName: string;
  recordTitle: string | null;
}

/**
 * Loads **all** org pending approvals in stable pages, filters each page to rows
 * where the current step approver is this user (`isUserApprover`), and returns an
 * exact actionable count plus the newest actionable rows for the workqueue list.
 *
 * Uses offset range pagination with a deterministic sort `(created_at desc, id desc)`
 * so pages do not overlap or skip rows when many approvals share the same timestamp.
 */
export async function loadActionableApprovalsForWorkqueue(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  crmRole: string | null,
  options?: { pageSize?: number; listCap?: number },
): Promise<{ totalActionable: number; topForUi: ActionableApprovalListEntry[] }> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const listCap = options?.listCap ?? DEFAULT_LIST_CAP;

  let totalActionable = 0;
  const topForUi: ActionableApprovalListEntry[] = [];
  let offset = 0;

  for (;;) {
    const { data: page, error } = await supabase
      .from('crm_approvals')
      .select('id, status, current_step, context, requested_by, created_at, record_id, process_id')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.warn('[Workqueue] approvals page:', error.message);
      break;
    }

    const rows = (page ?? []) as PendingApprovalRow[];
    if (rows.length === 0) {
      break;
    }

    const processIds = [...new Set(rows.map((r) => r.process_id))];
    const { data: processes } = await supabase
      .from('crm_approval_processes')
      .select('id, name, steps')
      .eq('org_id', orgId)
      .in('id', processIds);

    const processById = new Map<string, ProcessStepRow>(
      (processes ?? []).map((p: { id: string; name: string; steps: unknown }) => [
        p.id,
        { name: p.name, steps: p.steps },
      ]),
    );

    const recordIds = [...new Set(rows.map((r) => r.record_id))];
    const { data: records } = await supabase
      .from('crm_records')
      .select('id, title, owner_id')
      .eq('org_id', orgId)
      .in('id', recordIds);

    const recordById = new Map<string, RecordOwnerRow>(
      (records ?? []).map((r: { id: string; title: string | null; owner_id: string | null }) => [
        r.id,
        { title: r.title, owner_id: r.owner_id },
      ]),
    );

    const actionable = filterApprovalsActionableByProfile(
      rows,
      processById,
      recordById,
      profileId,
      crmRole,
    );

    for (const a of actionable) {
      totalActionable += 1;
      if (topForUi.length < listCap) {
        const proc = processById.get(a.process_id);
        const rec = recordById.get(a.record_id);
        topForUi.push({
          row: a,
          processName: proc?.name || 'Approval',
          recordTitle: rec?.title ?? null,
        });
      }
    }

    offset += rows.length;
    if (rows.length < pageSize) {
      break;
    }
  }

  return { totalActionable, topForUi };
}
