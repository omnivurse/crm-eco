/**
 * After a billing membership activates (scheduled plan change), project the
 * new plan onto linked CRM contacts. The CRM apply cron skips synced rows;
 * this is the matching write for the MMS lane.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { applyPlanChangeFieldsToData } from '@/lib/crm/scheduled-plan-change-apply';

export function buildCrmProjectionFromActivatedPlan(args: {
  data: Record<string, unknown> | null;
  planName: string;
  monthly?: string | number | null;
  iua?: string | number | null;
  effectiveDate: string;
}): Record<string, unknown> {
  const data =
    args.data && typeof args.data === 'object' && !Array.isArray(args.data)
      ? { ...args.data }
      : {};
  const scheduled =
    data.scheduled_plan_change &&
    typeof data.scheduled_plan_change === 'object' &&
    !Array.isArray(data.scheduled_plan_change)
      ? (data.scheduled_plan_change as Record<string, unknown>)
      : {};

  const toMonthly =
    args.monthly != null && args.monthly !== ''
      ? String(args.monthly)
      : typeof scheduled.to_monthly === 'string'
        ? scheduled.to_monthly
        : undefined;
  const toIua =
    args.iua != null && args.iua !== ''
      ? String(args.iua)
      : typeof scheduled.to_iua === 'string'
        ? scheduled.to_iua
        : undefined;

  const applied = applyPlanChangeFieldsToData(data, {
    change_id: typeof scheduled.change_id === 'string' ? scheduled.change_id : undefined,
    effective_date: args.effectiveDate,
    to_plan: args.planName,
    to_monthly: toMonthly,
    to_iua: toIua,
  });
  return applied.data;
}

export async function projectActivatedPlanToCrmRecords(
  supabase: SupabaseClient,
  args: {
    memberId: string;
    organizationId: string;
    planName: string;
    monthly?: string | number | null;
    iua?: string | number | null;
    effectiveDate: string;
  },
): Promise<{ updated: number; error?: string }> {
  const { data: records, error } = await supabase
    .from('crm_records')
    .select('id, data')
    .eq('org_id', args.organizationId)
    .eq('data->>linked_member_id', args.memberId)
    .eq('deleted_at', null);

  if (error) {
    return { updated: 0, error: `crm project ${args.memberId}: ${error.message}` };
  }

  const rows = Array.isArray(records) ? records : [];
  let updated = 0;
  for (const row of rows) {
    const next = buildCrmProjectionFromActivatedPlan({
      data: (row.data as Record<string, unknown> | null) ?? null,
      planName: args.planName,
      monthly: args.monthly,
      iua: args.iua,
      effectiveDate: args.effectiveDate,
    });
    const { error: updateError } = await supabase
      .from('crm_records')
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('org_id', args.organizationId);
    if (updateError) {
      return { updated, error: `crm project ${row.id}: ${updateError.message}` };
    }
    updated += 1;
  }
  return { updated };
}
