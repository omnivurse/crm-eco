import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';
import { z } from 'zod';
import { withIdempotency } from '@/lib/server/idempotency';
import {
  buildNormalizedRecordWrite,
  pickUpdateMirrorColumns,
} from '@/lib/crm/merge-crm-data-json-to-row';

/**
 * Bulk record endpoint.
 *
 * PATCH  /api/crm/records/bulk   → update many records
 * DELETE /api/crm/records/bulk   → delete many records
 *
 * Both routes:
 *   • Require crm_admin or crm_manager.
 *   • Scope reads/writes by org_id (RLS + defensive filter).
 *   • Pre-flight SELECT so we can report per-id success/skip/fail.
 *   • Never fail the whole batch because one row couldn't be resolved; instead
 *     they return a structured result so the UI can display exactly what
 *     happened (e.g. "42 updated · 3 skipped · 1 failed").
 *
 * Supported PATCH updates:
 *   • owner_id, status, stage          → top-level columns (single UPDATE).
 *   • add_tags, remove_tags            → mutate `data.tags` JSONB array.
 *   • data_patch                       → shallow merge into `data` JSONB.
 *
 * When owner_id is set we ALSO sync canonical normalization fields
 * (advisor_id / agent name) per the lane of each record, matching the
 * behaviour of the single-record patch service.
 */

const bulkUpdateSchema = z
  .object({
    record_ids: z.array(z.string().uuid()).min(1).max(5000),
    /** When set, IDs that belong to another module are skipped (UI sends current list module). */
    module_id: z.string().uuid().optional(),
    updates: z
      .object({
        owner_id: z.string().uuid().nullable().optional(),
        status: z.string().optional(),
        stage: z.string().optional(),
        add_tags: z.array(z.string().min(1).max(64)).max(50).optional(),
        remove_tags: z.array(z.string().min(1).max(64)).max(50).optional(),
        data_patch: z.record(z.unknown()).optional(),
      })
      .refine(
        (u) =>
          u.owner_id !== undefined ||
          u.status !== undefined ||
          u.stage !== undefined ||
          (u.add_tags && u.add_tags.length > 0) ||
          (u.remove_tags && u.remove_tags.length > 0) ||
          (u.data_patch && Object.keys(u.data_patch).length > 0),
        { message: 'updates must include at least one field' },
      ),
  });

const bulkDeleteSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1).max(5000),
  module_id: z.string().uuid().optional(),
});

interface BulkResult {
  success: boolean;
  updated_ids: string[];
  skipped_ids: string[];
  failed: Array<{ id: string; reason: string }>;
  updated_count: number;
}

interface BulkDeleteResult {
  success: boolean;
  deleted_ids: string[];
  skipped_ids: string[];
  failed: Array<{ id: string; reason: string }>;
  deleted_count: number;
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !profile.crm_role ||
      !['crm_admin', 'crm_manager'].includes(profile.crm_role)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - requires admin or manager role' },
        { status: 403 },
      );
    }

    const rawBody = await request.text();
    const { response } = await withIdempotency(
      {
        organizationId: profile.organization_id,
        method: 'PATCH',
        path: '/api/crm/records/bulk',
        rawBody,
      },
      request,
      () => runBulkPatch({ profile, rawBody }),
    );
    return response;
  } catch (error) {
    console.error('[bulk PATCH] unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update records' },
      { status: 500 },
    );
  }
}

async function runBulkPatch({
  profile,
  rawBody,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
  rawBody: string;
}): Promise<NextResponse> {
  try {
    let body: unknown = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { record_ids: requestedIds, updates, module_id: expectedModuleId } = parsed.data;
    const supabase = await createCrmClient();

    // Pre-flight: resolve which of the requested IDs are actually visible to
    // this org. Anything that's not visible becomes a `skipped_ids` entry in
    // the response (RLS / wrong-org / deleted).
    const { data: existing, error: fetchError } = await supabase
      .from('crm_records')
      .select('id, market_type, data, module_id, title')
      .in('id', requestedIds)
      .eq('org_id', profile.organization_id);

    if (fetchError) {
      console.error('[bulk PATCH] preflight SELECT failed:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load target records' },
        { status: 500 },
      );
    }

    type ExistingRow = {
      id: string;
      market_type: string | null;
      data: Record<string, unknown> | null;
      module_id: string;
      title: string | null;
    };
    const resolved = (existing ?? []) as ExistingRow[];
    const resolvedIds = new Set(resolved.map((r) => r.id));
    let skippedIds = requestedIds.filter((id) => !resolvedIds.has(id));

    let working = resolved;
    if (expectedModuleId) {
      for (const r of resolved) {
        if (r.module_id !== expectedModuleId) {
          skippedIds.push(r.id);
        }
      }
      working = resolved.filter((r) => r.module_id === expectedModuleId);
    }

    const updatedAt = new Date().toISOString();
    const updatedIds = new Set<string>();
    const failed: Array<{ id: string; reason: string }> = [];

    // Step 1 — top-level column updates (single UPDATE ... IN (...)).
    const topLevel: Record<string, unknown> = {};
    if (updates.owner_id !== undefined) topLevel.owner_id = updates.owner_id;
    if (updates.status !== undefined) topLevel.status = updates.status;
    if (updates.stage !== undefined) topLevel.stage = updates.stage;

    if (Object.keys(topLevel).length > 0 && working.length > 0) {
      const { data: updatedRows, error: updateError } = await supabase
        .from('crm_records')
        .update({ ...topLevel, updated_at: updatedAt })
        .in(
          'id',
          working.map((r) => r.id),
        )
        .eq('org_id', profile.organization_id)
        .select('id');

      if (updateError) {
        console.error('[bulk PATCH] top-level update failed:', updateError);
        working.forEach((r) =>
          failed.push({ id: r.id, reason: updateError.message }),
        );
      } else {
        (updatedRows ?? []).forEach((r: { id: string }) => updatedIds.add(r.id));
      }
    } else if (Object.keys(topLevel).length === 0) {
      // If only JSONB ops were requested, seed updatedIds with all resolved
      // rows; per-row step below will prune on individual failure.
      working.forEach((r) => updatedIds.add(r.id));
    }

    // Step 2 — owner ownership-normalization sync (lane-aware).
    if (updates.owner_id) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, advisor_id')
        .eq('id', updates.owner_id)
        .maybeSingle();

      if (ownerProfile) {
        const groupByLane = (lane: (r: ExistingRow) => boolean) =>
          working.filter(lane).map((r) => r.id);

        const healthshareIds = groupByLane((r) => r.market_type === 'healthshare');
        const insuranceIds = groupByLane(
          (r) => r.market_type === 'traditional_insurance',
        );
        const otherIds = groupByLane(
          (r) =>
            r.market_type !== 'healthshare' &&
            r.market_type !== 'traditional_insurance',
        );

        const ownerFullName = ownerProfile.full_name || null;
        const ownerAdvisorId = ownerProfile.advisor_id || null;

        if (healthshareIds.length > 0) {
          await supabase
            .from('crm_records')
            .update({
              canonical_advisor_id: ownerAdvisorId,
              normalized_advisor_name: ownerFullName,
              normalization_status: 'normalized',
              updated_at: updatedAt,
            } as Record<string, unknown>)
            .in('id', healthshareIds)
            .eq('org_id', profile.organization_id);
        }
        if (insuranceIds.length > 0) {
          await supabase
            .from('crm_records')
            .update({
              normalized_agent_name: ownerFullName,
              normalization_status: 'normalized',
              updated_at: updatedAt,
            } as Record<string, unknown>)
            .in('id', insuranceIds)
            .eq('org_id', profile.organization_id);
        }
        if (otherIds.length > 0) {
          await supabase
            .from('crm_records')
            .update({
              canonical_advisor_id: ownerAdvisorId,
              normalized_advisor_name: ownerFullName,
              normalized_agent_name: ownerFullName,
              updated_at: updatedAt,
            } as Record<string, unknown>)
            .in('id', otherIds)
            .eq('org_id', profile.organization_id);
        }
      }
    }

    // Step 3 — per-row JSONB ops (add_tags / remove_tags / data_patch).
    const hasJsonbOp =
      (updates.add_tags && updates.add_tags.length > 0) ||
      (updates.remove_tags && updates.remove_tags.length > 0) ||
      (updates.data_patch && Object.keys(updates.data_patch).length > 0);

    // When `data_patch` is present we mirror canonical values onto indexed
    // columns (carrier/market/dates/group_name/name-derived title) exactly like
    // the single-record PATCH — otherwise bulk-patched fields would live in
    // JSONB only and not display/filter. Tag-only ops keep the lighter path.
    const moduleKeyById = new Map<string, string>();
    if (updates.data_patch && working.length > 0) {
      const moduleIds = [...new Set(working.map((r) => r.module_id))];
      const { data: mods } = await supabase
        .from('crm_modules')
        .select('id, key')
        .in('id', moduleIds)
        .eq('org_id', profile.organization_id);
      (mods ?? []).forEach((m: { id: string; key: string }) =>
        moduleKeyById.set(m.id, m.key),
      );
    }

    if (hasJsonbOp) {
      for (const row of working) {
        const currentData = (row.data ?? {}) as Record<string, unknown>;
        const nextData: Record<string, unknown> = { ...currentData };

        if (updates.add_tags?.length || updates.remove_tags?.length) {
          const existingTagsRaw = Array.isArray(currentData.tags)
            ? (currentData.tags as unknown[])
            : [];
          const existingTags = existingTagsRaw.filter(
            (t): t is string => typeof t === 'string',
          );
          const next = new Set(existingTags);
          updates.add_tags?.forEach((t) => next.add(t));
          updates.remove_tags?.forEach((t) => next.delete(t));
          nextData.tags = Array.from(next);
        }

        if (updates.data_patch) {
          for (const [k, v] of Object.entries(updates.data_patch)) {
            nextData[k] = v;
          }
        }

        // Build the update payload. With data_patch, normalize + mirror to
        // indexed columns; tag-only ops just persist the JSONB.
        const rowUpdate: Record<string, unknown> = updates.data_patch
          ? (() => {
              const norm = buildNormalizedRecordWrite(nextData, {
                moduleKey: moduleKeyById.get(row.module_id) ?? null,
                previousTitle: row.title,
              });
              // Exclude out-of-band-owned columns so this per-row write can't
              // clobber Step 1's explicit status or Step 2's owner-normalization
              // (both run in earlier, separate UPDATE statements).
              return {
                ...pickUpdateMirrorColumns(norm.columns),
                data: norm.data,
                updated_at: updatedAt,
              };
            })()
          : { data: nextData, updated_at: updatedAt };

        const { error: rowError } = await supabase
          .from('crm_records')
          .update(rowUpdate)
          .eq('id', row.id)
          .eq('org_id', profile.organization_id);

        if (rowError) {
          updatedIds.delete(row.id);
          failed.push({ id: row.id, reason: rowError.message });
        } else {
          updatedIds.add(row.id);
        }
      }
    }

    const result: BulkResult = {
      success: failed.length === 0,
      updated_ids: Array.from(updatedIds),
      skipped_ids: skippedIds,
      failed,
      updated_count: updatedIds.size,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[bulk PATCH] unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update records' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !profile.crm_role ||
      !['crm_admin', 'crm_manager'].includes(profile.crm_role)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - requires admin or manager role' },
        { status: 403 },
      );
    }

    const rawBody = await request.text();
    const { response } = await withIdempotency(
      {
        organizationId: profile.organization_id,
        method: 'DELETE',
        path: '/api/crm/records/bulk',
        rawBody,
      },
      request,
      () => runBulkDelete({ profile, rawBody }),
    );
    return response;
  } catch (error) {
    console.error('[bulk DELETE] unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk delete records' },
      { status: 500 },
    );
  }
}

async function runBulkDelete({
  profile,
  rawBody,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
  rawBody: string;
}): Promise<NextResponse> {
  try {
    let body: unknown = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      body = null;
    }
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { record_ids: requestedIds, module_id: expectedModuleId } = parsed.data;
    const supabase = await createCrmClient();

    const { data: existing, error: fetchError } = await supabase
      .from('crm_records')
      .select('id, module_id')
      .in('id', requestedIds)
      .eq('org_id', profile.organization_id);

    if (fetchError) {
      console.error('[bulk DELETE] preflight SELECT failed:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load target records' },
        { status: 500 },
      );
    }

    const rows = (existing ?? []) as { id: string; module_id: string }[];
    const resolvedIds = new Set<string>();
    for (const r of rows) {
      resolvedIds.add(r.id);
    }
    let skippedIds = requestedIds.filter((id) => !resolvedIds.has(id));

    if (expectedModuleId) {
      for (const r of rows) {
        if (r.module_id !== expectedModuleId) {
          resolvedIds.delete(r.id);
          skippedIds.push(r.id);
        }
      }
    }

    const failed: Array<{ id: string; reason: string }> = [];
    const deletedIds = new Set<string>();

    if (resolvedIds.size > 0) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('crm_records')
        .delete()
        .in('id', Array.from(resolvedIds))
        .eq('org_id', profile.organization_id)
        .select('id');

      if (deleteError) {
        console.error('[bulk DELETE] failed:', deleteError);
        Array.from(resolvedIds).forEach((id) =>
          failed.push({ id, reason: deleteError.message }),
        );
      } else {
        ((deletedRows ?? []) as { id: string }[]).forEach((r) =>
          deletedIds.add(r.id),
        );
      }
    }

    const result: BulkDeleteResult = {
      success: failed.length === 0,
      deleted_ids: Array.from(deletedIds),
      skipped_ids: skippedIds,
      failed,
      deleted_count: deletedIds.size,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[bulk DELETE] unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk delete records' },
      { status: 500 },
    );
  }
}
