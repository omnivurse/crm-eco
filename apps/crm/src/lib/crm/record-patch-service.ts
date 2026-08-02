import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeMatchingWorkflows, applyScoring } from '@/lib/automation';
import { getModuleBlueprint } from '@/lib/blueprints';
import { getRecordPendingApproval } from '@/lib/approvals';
import { logPHIAccess, identifyPHIFields } from '@/lib/security';
import type { CrmRecord } from '@/lib/crm/types';
import {
  mergeCrmDataJsonIntoRowColumns,
  normalizeRowColumnValue,
  normalizeDateColumnValue,
  pickUpdateMirrorColumns,
  sanitizeCrmDataJsonPatch,
} from '@/lib/crm/merge-crm-data-json-to-row';
import { alignMisalignedRecordModule } from '@/lib/crm/align-record-module';
import { buildScheduledCancellationUpdates } from '@/lib/crm/membership-lifecycle';
import { assertCrmPendingHasStartDate } from '@/lib/crm/pending-start-date-invariant';
import {
  CRM_RECORD_PATCH_CANONICAL_KEYS,
  CRM_RECORD_DATE_COLUMN_KEYS,
  CRM_RECORD_UUID_COLUMN_KEYS,
} from '@/lib/crm/record-field-registry';
import {
  applyStatusToRecordUpdates,
  patchTouchesStatus,
} from '@/lib/crm/status-sync';

/** Matches `getAuthProfile()` shape used by CRM API routes */
/** Profile fields required by CRM record create/patch (matches `getAuthProfile()`). */
export interface CrmPatchAuthProfile {
  id: string;
  organization_id: string;
  crm_role: string | null;
  /** Auth user id (profiles.user_id) */
  user_id: string;
}

export type CrmRecordPatchResult =
  | { ok: true; record: CrmRecord; previousRecord: CrmRecord }
  | { ok: false; status: number; body: Record<string, unknown> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Single implementation of CRM record PATCH logic (workflows, scoring, PHI, revalidation).
 * Used by `PATCH /api/crm/records/[id]` and server-side `updateRecord()`.
 */
export async function executeCrmRecordPatch(params: {
  supabase: SupabaseClient;
  profile: CrmPatchAuthProfile;
  id: string;
  body: Record<string, unknown>;
  /**
   * Optional optimistic-concurrency token. When provided, the PATCH
   * fails with HTTP 409 if the stored `updated_at` no longer matches —
   * i.e. someone else modified the record since the client last saw it.
   * Used by the V2 inline editors via an `If-Match` header.
   */
  ifMatchUpdatedAt?: string | null;
}): Promise<CrmRecordPatchResult> {
  const { supabase, profile, id, body, ifMatchUpdatedAt } = params;

  await alignMisalignedRecordModule(profile.organization_id, id);

  const { data: previousRecord, error: fetchError } = await supabase
    .from('crm_records')
    .select('*, module:crm_modules!crm_records_module_id_fkey(key)')
    .eq('id', id)
    .eq('org_id', profile.organization_id)
    .single();

  if (fetchError || !previousRecord) {
    return { ok: false, status: 404, body: { error: 'Record not found' } };
  }

  if (
    ifMatchUpdatedAt &&
    previousRecord.updated_at &&
    new Date(previousRecord.updated_at).getTime() !==
      new Date(ifMatchUpdatedAt).getTime()
  ) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Record was updated by someone else',
        code: 'CONFLICT',
        currentUpdatedAt: previousRecord.updated_at,
      },
    };
  }

  const updates: Record<string, unknown> = {};

  type RecordWithModule = typeof previousRecord & {
    module?: { key: string } | null;
  };
  const moduleKey = (previousRecord as RecordWithModule).module?.key ?? null;

  if (body.data !== undefined) {
    const patch = sanitizeCrmDataJsonPatch(body.data as Record<string, unknown>);
    const prevData =
      previousRecord.data && typeof previousRecord.data === 'object'
        ? { ...(previousRecord.data as Record<string, unknown>) }
        : {};
    const mergedData = { ...prevData, ...patch };
    updates.data = mergedData;
    const mirrored = mergeCrmDataJsonIntoRowColumns(mergedData, {
      previousTitle: previousRecord.title,
      moduleKey,
    });
    // Drop out-of-band columns (status/advisor/…) unless this patch intentionally
    // set them — otherwise stale JSONB remirrors clobber Kanban/bulk/owner writes.
    const allowKeys: string[] = [];
    if (patchTouchesStatus(patch)) allowKeys.push('status');
    if (patch.advisor_id !== undefined) allowKeys.push('advisor_id');
    if (patch.stage !== undefined) allowKeys.push('stage');
    if (patch.normalization_status !== undefined) {
      allowKeys.push(
        'normalization_status',
        'canonical_advisor_id',
        'normalized_advisor_name',
        'normalized_agent_name',
      );
    }
    Object.assign(updates, pickUpdateMirrorColumns(mirrored, [], allowKeys));
  }

  if (body.owner_id !== undefined) {
    const ownerId = normalizeRowColumnValue(body.owner_id) as string | null;
    updates.owner_id = ownerId;

    if (ownerId) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, advisor_id')
        .eq('id', ownerId)
        .single();

      if (ownerProfile) {
        const marketType = previousRecord.market_type;
        if (marketType === 'healthshare') {
          updates.canonical_advisor_id = ownerProfile.advisor_id || null;
          updates.normalized_advisor_name = ownerProfile.full_name || null;
          updates.normalization_status = 'normalized';
        } else if (marketType === 'traditional_insurance') {
          updates.normalized_agent_name = ownerProfile.full_name || null;
          updates.normalization_status = 'normalized';
        } else {
          updates.canonical_advisor_id = ownerProfile.advisor_id || null;
          updates.normalized_advisor_name = ownerProfile.full_name || null;
          updates.normalized_agent_name = ownerProfile.full_name || null;
        }
      }
    }
  }

  // Top-level status: keep JSONB mirrors in lockstep (Kanban / list / clients).
  if (body.status !== undefined) {
    const prevData =
      updates.data && typeof updates.data === 'object'
        ? (updates.data as Record<string, unknown>)
        : previousRecord.data && typeof previousRecord.data === 'object'
          ? (previousRecord.data as Record<string, unknown>)
          : {};
    applyStatusToRecordUpdates(
      updates,
      (body.status as string | null) ?? null,
      moduleKey,
      prevData,
    );
  }
  if (body.title !== undefined) updates.title = body.title;

  if (body.stage !== undefined && body.stage !== previousRecord.stage) {
    const blueprint = await getModuleBlueprint(previousRecord.module_id);

    if (blueprint) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Stage changes must go through the transition API when a blueprint is active',
          code: 'BLUEPRINT_STAGE_PROTECTION',
          hint: 'Use POST /api/crm/transition instead',
        },
      };
    }

    updates.stage = body.stage;
  } else if (body.stage !== undefined) {
    updates.stage = body.stage;
  }

  for (const key of CRM_RECORD_PATCH_CANONICAL_KEYS) {
    if (body[key] !== undefined) {
      if (CRM_RECORD_DATE_COLUMN_KEYS.has(key)) {
        (updates as Record<string, unknown>)[key] = normalizeDateColumnValue(body[key]);
      } else if (CRM_RECORD_UUID_COLUMN_KEYS.has(key)) {
        // UUID columns reject non-UUID text. Free-text carrier/advisor
        // values must stay in JSONB only.
        const v = normalizeRowColumnValue(body[key]);
        (updates as Record<string, unknown>)[key] =
          v === null || (typeof v === 'string' && UUID_RE.test(v)) ? v : null;
      } else {
        (updates as Record<string, unknown>)[key] = normalizeRowColumnValue(body[key]);
      }
    }
  }

  const dataObj =
    body.data && typeof body.data === 'object'
      ? ({
          ...(previousRecord.data && typeof previousRecord.data === 'object'
            ? (previousRecord.data as Record<string, unknown>)
            : {}),
          ...(body.data as Record<string, unknown>),
        } as Record<string, unknown>)
      : null;
  const laneOrCarrierTouched =
    body.market_type !== undefined ||
    body.carrier_id !== undefined ||
    (dataObj && (dataObj.market_type !== undefined || dataObj.carrier_id !== undefined));

  if (laneOrCarrierTouched && body.normalization_status === undefined) {
    const mt = (updates.market_type ?? previousRecord.market_type) as string | null | undefined;
    const carrierId =
      updates.carrier_id !== undefined ? updates.carrier_id : previousRecord.carrier_id;
    if (mt === 'healthshare') {
      updates.normalization_status = 'normalized';
    } else if (mt === 'traditional_insurance' && carrierId) {
      updates.normalization_status = 'normalized';
    }
  }

  const pendingApproval = await getRecordPendingApproval(id);
  if (pendingApproval && pendingApproval.context.action_type === 'stage_transition') {
    if (body.stage !== undefined && body.stage !== previousRecord.stage) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Cannot modify stage while an approval is pending',
          code: 'PENDING_APPROVAL',
          approvalId: pendingApproval.id,
        },
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      status: 400,
      body: { error: 'No fields to update', code: 'EMPTY_UPDATE' },
    };
  }

  // Fail closed: Pending-class status requires a resolvable coverage start date.
  {
    const resultingStatus = (updates.status ?? previousRecord.status) as string | null;
    const resultingRecord = {
      current_year_start_date: (updates.current_year_start_date ??
        previousRecord.current_year_start_date) as string | null,
      original_start_date: (updates.original_start_date ??
        previousRecord.original_start_date) as string | null,
      data: (updates.data ?? previousRecord.data) as Record<string, unknown> | null,
    };
    const pendingStart = assertCrmPendingHasStartDate(resultingStatus, resultingRecord);
    if (!pendingStart.ok) {
      return {
        ok: false,
        status: 400,
        body: {
          error: pendingStart.error,
          code: 'PENDING_REQUIRES_START_DATE',
        },
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const mergedForCancelCheck = {
    status: (updates.status ?? previousRecord.status) as string | null,
    cancellation_date: (updates.cancellation_date ??
      previousRecord.cancellation_date) as string | null,
    data: (updates.data ?? previousRecord.data) as Record<string, unknown> | null,
    id: previousRecord.id,
    org_id: previousRecord.org_id,
    title: previousRecord.title,
  };
  const autoCancelUpdates = buildScheduledCancellationUpdates(mergedForCancelCheck, today);
  if (autoCancelUpdates) {
    Object.assign(updates, autoCancelUpdates);
  }

  const { data: record, error } = await supabase
    .from('crm_records')
    .update(updates)
    .eq('id', id)
    .eq('org_id', profile.organization_id)
    .select()
    .single();

  if (error) {
    console.error('[Records] PATCH error:', { id, error: error.message, code: error.code });
    if (error.code === 'PGRST116') {
      return {
        ok: false,
        status: 404,
        body: {
          error: 'Update affected 0 rows — record may have been deleted or access denied',
          code: 'ZERO_ROWS',
        },
      };
    }
    return { ok: false, status: 500, body: { error: error.message } };
  }

  if (!record) {
    return { ok: false, status: 500, body: { error: 'Update returned no data', code: 'NO_DATA' } };
  }

  if (autoCancelUpdates) {
    const { error: histError } = await supabase.from('crm_stage_history').insert({
      record_id: id,
      org_id: previousRecord.org_id,
      from_stage: previousRecord.status,
      to_stage: 'Cancelled',
      reason: 'Auto-cancelled on save: scheduled end date reached',
    });
    if (histError) {
      console.error('[Records] auto-cancel stage_history error:', histError.message);
    }
  }

  const typedRecord = record as CrmRecord;

  executeMatchingWorkflows({
    orgId: typedRecord.org_id,
    moduleId: typedRecord.module_id,
    record: typedRecord,
    trigger: 'on_update',
    previousRecord: previousRecord as CrmRecord,
    dryRun: false,
    userId: profile.user_id,
    profileId: profile.id,
  }).catch(err => {
    console.error('Workflow execution error:', err);
  });

  applyScoring(typedRecord, {
    orgId: typedRecord.org_id,
    moduleId: typedRecord.module_id,
    record: typedRecord,
    trigger: 'on_update',
    dryRun: false,
  }).catch(err => {
    console.error('Scoring error:', err);
  });

  try {
    const phiFields = identifyPHIFields(typedRecord.data || {});
    if (phiFields.length > 0) {
      await logPHIAccess({
        userId: profile.id,
        organizationId: typedRecord.org_id,
        action: 'update',
        resourceType: 'record',
        resourceId: id,
        recordName: typedRecord.title || undefined,
        phiFieldsAccessed: phiFields,
        metadata: { module_id: typedRecord.module_id },
      });
    }
  } catch (err) {
    console.error('PHI audit logging error:', err);
  }

  // Best-effort cache revalidation. Must never surface as a failure:
  // the DB UPDATE already committed, so a thrown `revalidatePath` would
  // make the client show "Failed to save" while the change is actually
  // persisted — the worst possible UX.
  try {
    revalidatePath('/crm');
    revalidatePath(`/crm/r/${id}`);
    // Module list pages render from their own RSC payload; without this,
    // navigating back to e.g. /crm/modules/leads showed the pre-edit row
    // (stale FIRST NAME / EMAIL / STATUS) until a hard refresh. We only have
    // module_id here, so revalidate the dynamic route as a whole.
    revalidatePath('/crm/modules/[moduleKey]', 'page');
  } catch (err) {
    console.error('[Records] revalidatePath error (record already saved):', err);
  }

  return { ok: true, record: typedRecord, previousRecord: previousRecord as CrmRecord };
}
