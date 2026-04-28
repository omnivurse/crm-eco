import type { ApprovalStep } from '@/lib/approvals/types';
import { isUserApprover } from '@/lib/approvals/types';

/** Pending approval row shape from `crm_approvals` select (minimal fields). */
export interface PendingApprovalRow {
  id: string;
  process_id: string;
  record_id: string;
  current_step: number;
  context?: unknown;
  requested_by?: string | null;
  created_at: string;
}

export interface ProcessStepRow {
  name: string;
  steps: ApprovalStep[] | null | unknown;
}

export interface RecordOwnerRow {
  title: string | null;
  owner_id: string | null;
}

/**
 * Keep only approvals whose **current step** lists this profile as approver,
 * matching `getPendingApprovalsForUser` / `validateApprover` in the approvals engine.
 */
export function filterApprovalsActionableByProfile(
  approvals: PendingApprovalRow[],
  processById: Map<string, ProcessStepRow>,
  recordById: Map<string, RecordOwnerRow>,
  profileId: string,
  crmRole: string | null,
): PendingApprovalRow[] {
  const out: PendingApprovalRow[] = [];
  for (const a of approvals) {
    const proc = processById.get(a.process_id);
    const rawSteps = proc?.steps;
    const steps = Array.isArray(rawSteps) ? (rawSteps as ApprovalStep[]) : null;
    if (!steps?.length) continue;

    const step = steps[a.current_step];
    if (!step) continue;

    const rec = recordById.get(a.record_id);
    const ownerId = rec?.owner_id ?? null;

    if (!isUserApprover(step, profileId, crmRole, ownerId)) continue;
    out.push(a);
  }
  return out;
}
