import { revalidatePath } from 'next/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { executeMatchingWorkflows, applyScoring } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import {
  mergeCrmDataJsonIntoRowColumns,
  sanitizeCrmDataJsonPatch,
} from '@/lib/crm/merge-crm-data-json-to-row';
import type { CrmPatchAuthProfile } from '@/lib/crm/record-patch-service';
import { assertCrmPendingHasStartDate } from '@/lib/crm/pending-start-date-invariant';

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

/** Candidate row shape returned by the `check_crm_duplicate` RPC. */
interface DuplicateCandidate {
  id: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
}

/** Normalize a name for comparison: lowercase, collapse whitespace, trim. */
function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Comparable display name for a record's `data` — first + last, falling back to
 * an explicit title/name. Used to distinguish a true duplicate (same email AND
 * name) from a family member who legitimately shares a parent's email.
 */
function recordDisplayName(data: Record<string, unknown>): string {
  const first = typeof data.first_name === 'string' ? data.first_name : '';
  const last = typeof data.last_name === 'string' ? data.last_name : '';
  const combined = `${first} ${last}`.trim();
  const fallback =
    (typeof data.title === 'string' ? data.title : '') ||
    (typeof data.name === 'string' ? data.name : '');
  return normalizeName(combined || fallback);
}

/**
 * Drop blank values before a CREATE so a fresh record does not get hundreds of
 * `""` / `null` keys for fields the user never touched. On CREATE an absent key
 * and a blank key are semantically identical (nothing on file yet), so this
 * never loses information — unlike PATCH, where a blank is an intentional
 * clear and MUST be preserved (see record-patch-service). Arrays/objects pass
 * through untouched.
 */
export function stripBlankCreateValues(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key] = value;
  }
  return out;
}

/**
 * Single implementation of CRM record create (duplicate check, indexed columns from JSONB, workflows, scoring).
 * Used by `POST /api/crm/records` and server-side `createRecord()`.
 *
 * Duplicate handling: returns `{ ok:false, status:409, body:{ code:'DUPLICATE_RECORD', duplicates } }`
 * unless `input.force` is true, in which case the RPC pre-check is skipped and
 * only the DB unique index can still reject (also surfaced as DUPLICATE_RECORD).
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

  // Blank keys are dropped up-front (see stripBlankCreateValues) so the
  // duplicate check, the pending-start-date invariant and the insert all see
  // the same, minimal payload.
  const createData = stripBlankCreateValues(
    (input.data ?? {}) as Record<string, unknown>,
  );

  const emailToCheck = typeof createData.email === 'string' ? createData.email : null;
  // Raw phone is passed through — `check_crm_duplicate` compares digits server-side
  // (migration 20260817180000), so "(303) 555-1212" and "3035551212" both match.
  const phoneToCheck = typeof createData.phone === 'string' ? createData.phone : null;

  if (!input.force && (emailToCheck || phoneToCheck)) {
    const { data: duplicates } = await (supabase as any).rpc('check_crm_duplicate', {
      p_org_id: profile.organization_id,
      p_module_id: input.module_id,
      p_email: emailToCheck,
      p_phone: phoneToCheck,
    });

    // Family members legitimately share one email/phone — e.g. a child dependent
    // with their own record who is reachable at a parent's address. Treat a
    // candidate as a blocking duplicate only when the NAME also matches; the same
    // email with a DIFFERENT name is allowed, consistent with the (email + name)
    // idx_crm_records_unique_email index and the members table's shared-email rule.
    const newName = recordDisplayName(createData);
    const realDuplicates = ((duplicates as DuplicateCandidate[] | null) ?? []).filter(
      (d) => !newName || normalizeName(d.title) === newName,
    );

    if (realDuplicates.length > 0) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'A record with this name and email already exists',
          code: 'DUPLICATE_RECORD',
          duplicates: realDuplicates,
        },
      };
    }
  }

  const d = sanitizeCrmDataJsonPatch(createData);
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

  const pendingStart = assertCrmPendingHasStartDate(
    (insertRow.status as string | null | undefined) ?? null,
    {
      current_year_start_date: insertRow.current_year_start_date as string | null | undefined,
      original_start_date: insertRow.original_start_date as string | null | undefined,
      data: d,
    },
    moduleRow.key,
  );
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
