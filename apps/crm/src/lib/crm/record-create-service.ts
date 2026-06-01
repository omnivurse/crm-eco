import { revalidatePath } from 'next/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { executeMatchingWorkflows, applyScoring } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import {
  mergeCrmDataJsonIntoRowColumns,
  sanitizeCrmDataJsonPatch,
} from '@/lib/crm/merge-crm-data-json-to-row';
import type { CrmPatchAuthProfile } from '@/lib/crm/record-patch-service';

export interface ExecuteCrmRecordCreateInput {
  org_id: string;
  module_id: string;
  owner_id?: string;
  data: Record<string, unknown>;
  status?: string;
  stage?: string;
  force?: boolean;
}

export type CrmRecordCreateResult =
  | { ok: true; record: CrmRecord }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Single implementation of CRM record create (duplicate check, indexed columns from JSONB, workflows, scoring).
 * Used by `POST /api/crm/records` and server-side `createRecord()`.
 */
export async function executeCrmRecordCreate(params: {
  supabase: SupabaseClient;
  profile: CrmPatchAuthProfile;
  user: User;
  input: ExecuteCrmRecordCreateInput;
}): Promise<CrmRecordCreateResult> {
  const { supabase, profile, user, input } = params;

  if (input.org_id !== profile.organization_id) {
    return { ok: false, status: 400, body: { error: 'org_id does not match your organization' } };
  }

  const { data: moduleRow, error: moduleErr } = await supabase
    .from('crm_modules')
    .select('id, org_id, key')
    .eq('id', input.module_id)
    .single();

  if (moduleErr || !moduleRow || moduleRow.org_id !== profile.organization_id) {
    return { ok: false, status: 404, body: { error: 'Module not found' } };
  }

  const emailToCheck = (input.data?.email as string) || null;
  const phoneToCheck = (input.data?.phone as string) || null;

  if (!input.force && (emailToCheck || phoneToCheck)) {
    const { data: duplicates } = await (supabase as any).rpc('check_crm_duplicate', {
      p_org_id: profile.organization_id,
      p_module_id: input.module_id,
      p_email: emailToCheck,
      p_phone: phoneToCheck,
    });

    if (duplicates && duplicates.length > 0) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'A record with this email already exists',
          code: 'DUPLICATE_RECORD',
          duplicates,
        },
      };
    }
  }

  const d = sanitizeCrmDataJsonPatch(input.data as Record<string, unknown>);
  const rowFromData = mergeCrmDataJsonIntoRowColumns(d, { moduleKey: moduleRow.key });

  const insertRow: Record<string, unknown> = {
    org_id: profile.organization_id,
    module_id: input.module_id,
    owner_id: input.owner_id || profile.id,
    data: d,
    created_by: profile.id,
    ...rowFromData,
  };

  if (input.status !== undefined) insertRow.status = input.status;
  if (input.stage !== undefined) insertRow.stage = input.stage;

  const laneOrCarrierTouched =
    d.market_type !== undefined || d.carrier_id !== undefined;
  if (laneOrCarrierTouched) {
    const mt = insertRow.market_type as string | null | undefined;
    const carrierId = insertRow.carrier_id;
    if (mt === 'healthshare') {
      insertRow.normalization_status = 'normalized';
    } else if (mt === 'traditional_insurance' && carrierId) {
      insertRow.normalization_status = 'normalized';
    }
  }

  const { data: record, error } = await supabase
    .from('crm_records')
    .insert(insertRow)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return {
        ok: false,
        status: 409,
        body: { error: 'A record with this email already exists', code: 'DUPLICATE_RECORD' },
      };
    }
    return { ok: false, status: 500, body: { error: error.message } };
  }

  if (!record) {
    return { ok: false, status: 500, body: { error: 'Insert returned no data' } };
  }

  const typedRecord = record as CrmRecord;

  executeMatchingWorkflows({
    orgId: typedRecord.org_id,
    moduleId: typedRecord.module_id,
    record: typedRecord,
    trigger: 'on_create',
    dryRun: false,
    userId: user.id,
    profileId: profile.id,
  }).catch(err => {
    console.error('Workflow execution error:', err);
  });

  applyScoring(typedRecord, {
    orgId: typedRecord.org_id,
    moduleId: typedRecord.module_id,
    record: typedRecord,
    trigger: 'on_create',
    dryRun: false,
  }).catch(err => {
    console.error('Scoring error:', err);
  });

  revalidatePath('/crm');

  return { ok: true, record: typedRecord };
}
