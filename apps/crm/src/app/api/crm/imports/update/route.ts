/**
 * POST /api/crm/imports/update
 * ---------------------------------------------------------------------------
 * Thin auth adapter over the Entity Reupload orchestrator
 * (`runCsvUpdate` in `@/lib/imports/run-csv-update`).
 *
 * - Matches each CSV row by zoho_id → email → phone → name+DOB
 * - Updates ONLY matched records; unmatched ignored; ambiguous fail closed
 * - Empty CSV cells never overwrite unless `overwriteEmpty: true`
 * - `dryRun` (default) returns match counts + previews without writing
 *
 * Authz: CRM admin or manager. Defense-in-depth `org_id` filters on top of RLS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import {
  DEFAULT_MATCH_PRIORITY,
  MAX_CSV_ROWS,
} from '@/lib/imports/csv-update';
import { runCsvUpdate } from '@/lib/imports/run-csv-update';
import {
  createSupabaseCsvUpdateWriter,
  createSupabaseRecordLookup,
} from '@/lib/imports/supabase-csv-update-adapters';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const matchKeyEnum = z.enum(['zoho_id', 'email', 'phone', 'name_dob']);

const requestSchema = z.object({
  moduleKey: z.string().min(1),
  rows: z
    .array(
      z.object({
        index: z.number().int().min(0),
        raw: z.record(z.string(), z.string()),
        normalized: z.record(z.string(), z.string()),
      }),
    )
    .min(1)
    .max(MAX_CSV_ROWS),
  matchPriority: z
    .array(matchKeyEnum)
    .min(1)
    .default([...DEFAULT_MATCH_PRIORITY]),
  dryRun: z.boolean().default(true),
  overwriteEmpty: z.boolean().default(false),
  fileName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const profile = await getAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = await createClient();
  const roleGate = await requireActiveOrgCrmRoles(
    supabase,
    profile.organization_id,
    ['crm_admin', 'crm_manager'],
  );
  if (!roleGate.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const orgId = profile.organization_id;
  const { rows, moduleKey, matchPriority, dryRun, overwriteEmpty, fileName } =
    parsed.data;

  const { data: moduleRow, error: moduleErr } = await supabase
    .from('crm_modules')
    .select('id, key, name')
    .eq('org_id', orgId)
    .eq('key', moduleKey)
    .maybeSingle();

  if (moduleErr) {
    return NextResponse.json({ error: moduleErr.message }, { status: 500 });
  }
  if (!moduleRow) {
    return NextResponse.json(
      { error: `Module "${moduleKey}" not found in your organization` },
      { status: 404 },
    );
  }

  try {
    const result = await runCsvUpdate({
      rows,
      moduleKey: moduleRow.key,
      matchPriority,
      dryRun,
      overwriteEmpty,
      fileName: fileName ?? null,
      lookup: createSupabaseRecordLookup({
        supabase,
        orgId,
        moduleId: moduleRow.id,
        moduleKey: moduleRow.key,
      }),
      writer: dryRun
        ? undefined
        : createSupabaseCsvUpdateWriter({
            supabase,
            orgId,
            moduleId: moduleRow.id,
            moduleKey: moduleRow.key,
            actorId: profile.id,
          }),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
