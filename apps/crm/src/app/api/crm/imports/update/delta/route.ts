/**
 * POST /api/crm/imports/update/delta
 * ---------------------------------------------------------------------------
 * Streams the COMPLETE dry-run delta as a CSV download — one line per changed
 * field, for every matched row.
 *
 * Why a separate streaming route rather than a bigger JSON response: the
 * on-screen preview is capped at 10 rows / 5 fields because the main route
 * returns a buffered `NextResponse.json`, and a real delta for a full book
 * (~14,000 rows) is ~10 MB — over the platform's non-streaming body limit. A
 * 10-row sample is not something anyone can responsibly sign off on before
 * letting a file touch 14,000 people, so the reviewable artifact has to come
 * back as a stream.
 *
 * NEVER WRITES. This runs `runCsvUpdate` with `dryRun: true` and no writer,
 * so it cannot modify a record even if called directly.
 *
 * Authz: identical to the apply route — CRM admin or manager, org-scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { escapeCsvCell, CSV_UTF8_BOM } from '@crm-eco/lib/csv/escape';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import {
  DEFAULT_MATCH_PRIORITY,
  MAX_CSV_ROWS,
} from '@/lib/imports/csv-update';
import { runCsvUpdate } from '@/lib/imports/run-csv-update';
import { createSupabaseRecordLookup } from '@/lib/imports/supabase-csv-update-adapters';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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
  fileName: z.string().optional(),
});

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'update';
}

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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = profile.organization_id;
  const { rows, moduleKey, matchPriority, fileName } = parsed.data;

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

  let result;
  try {
    result = await runCsvUpdate({
      rows,
      moduleKey: moduleRow.key,
      matchPriority,
      dryRun: true,
      overwriteEmpty: false,
      fullDelta: true,
      fileName: fileName ?? null,
      lookup: createSupabaseRecordLookup({
        supabase,
        orgId,
        moduleId: moduleRow.id,
        moduleKey: moduleRow.key,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delta export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(encoder.encode(CSV_UTF8_BOM));
        controller.enqueue(
          encoder.encode(
            [
              'outcome',
              'csv_row',
              'record_id',
              'record_name',
              'matched_by',
              'match_value',
              'field',
              'current_value',
              'new_value',
            ].join(',') + '\n',
          ),
        );

        for (const m of result.previewMatches) {
          const fields = Object.entries(m.fieldDelta);
          if (fields.length === 0) continue;
          for (const [field, change] of fields) {
            controller.enqueue(
              encoder.encode(
                [
                  'will_update',
                  m.rowIndex + 1,
                  m.recordId,
                  m.recordTitle ?? '',
                  m.matchedBy,
                  m.matchValue,
                  field,
                  change.from,
                  change.to,
                ]
                  .map(escapeCsvCell)
                  .join(',') + '\n',
              ),
            );
          }
        }

        // Everything the file will NOT change, and why. A reviewer needs the
        // skips as much as the writes — "why is this person not updating?"
        // is the question a 10-row sample can never answer.
        const skipRow = (
          outcome: string,
          rowIndex: number,
          recordId: string,
          recordName: string,
          detail: string,
        ) =>
          controller.enqueue(
            encoder.encode(
              [outcome, rowIndex + 1, recordId, recordName, '', '', '', '', detail]
                .map(escapeCsvCell)
                .join(',') + '\n',
            ),
          );

        for (const a of result.previewAmbiguous) {
          skipRow(
            'skipped_ambiguous',
            a.rowIndex,
            '',
            '',
            `${a.candidateCount} records share ${a.matchedBy} ${a.matchValue}`,
          );
        }
        for (const d of result.previewDuplicateTarget) {
          skipRow(
            'skipped_duplicate_row',
            d.rowIndex,
            d.recordId,
            d.recordTitle ?? '',
            `${d.rowsInFile} rows in this file match this record`,
          );
        }
        for (const u of result.previewUnmatched) {
          const keys = Object.entries(u.keys)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
          skipRow('unmatched', u.rowIndex, '', '', keys || 'no match key');
        }
        for (const n of result.previewCrmNewer) {
          skipRow(
            'crm_newer_than_file',
            n.rowIndex,
            n.recordId,
            n.recordTitle ?? '',
            `file ${n.fileModified}, CRM ${n.recordUpdated}`,
          );
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const base = sanitizeFilenamePart(fileName ?? moduleRow.key);
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="delta-${base}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
