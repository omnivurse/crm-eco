import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  getRecordPendingApproval,
  checkApprovalRequired,
  createApprovalRequest,
} from '@/lib/approvals';
import { logPHIAccess } from '@/lib/security';
import { executeCrmRecordPatch } from '@/lib/crm/record-patch-service';
import { withIdempotency } from '@/lib/server/idempotency';

/**
 * GET /api/crm/records/[id]
 *
 * Lightweight single-record fetch scoped to the caller's org. Used by
 * inline lookup editors to resolve UUID → title without pulling full
 * module data. RLS already enforces org membership on `crm_records`.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: record, error } = await supabase
      .from('crm_records')
      .select('id, title, module_id, data, updated_at')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      // Trashed records read as not-found (they must not resolve in pickers).
      .is('deleted_at' as never, null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Read the raw body text once so we can (a) pass it to the
    // idempotency wrapper for hashing and (b) re-parse as JSON inside
    // the handler closure. Reading `request.json()` more than once
    // throws in Next's runtime.
    const rawBody = await request.text();
    // Custom header rather than RFC 7232 If-Match: an unquoted ISO
    // timestamp isn't a valid ETag, and some intermediaries (Vercel edge,
    // Cloudflare) reject the request with a 412 before it ever reaches
    // this route. We accept both during the rollover so any in-flight
    // client requests don't break.
    const ifMatch =
      request.headers.get('x-if-updated-at') ||
      request.headers.get('if-match') ||
      null;

    const { response } = await withIdempotency(
      {
        organizationId: profile.organization_id,
        method: 'PATCH',
        path: `/api/crm/records/${id}`,
        rawBody,
      },
      request,
      async () => {
        let body: Record<string, unknown>;
        try {
          const parsed = rawBody ? JSON.parse(rawBody) : {};
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return NextResponse.json(
              { error: 'Body must be a JSON object' },
              { status: 400 },
            );
          }
          body = parsed as Record<string, unknown>;
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 },
          );
        }
        const result = await executeCrmRecordPatch({
          supabase,
          profile,
          id,
          body,
          ifMatchUpdatedAt: ifMatch,
        });

        if (!result.ok) {
          return NextResponse.json(result.body, { status: result.status });
        }

        return NextResponse.json(result.record);
      },
    );

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the record to check approval rules
    const { data: record } = await supabase
      .from('crm_records')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.organization_id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Check if deletion requires approval
    const ruleMatch = await checkApprovalRequired(
      profile.organization_id,
      record.module_id,
      'record_delete',
      { ...(record.data || {}), stage: record.stage }
    );

    if (ruleMatch) {
      // Create approval request instead of deleting
      const result = await createApprovalRequest({
        orgId: profile.organization_id,
        moduleId: record.module_id,
        recordId: id,
        processId: ruleMatch.processId,
        ruleId: ruleMatch.ruleId,
        triggerType: 'record_delete',
        actionPayload: {
          type: 'delete',
          record_id: id,
          module_id: record.module_id,
        },
        context: {
          action_type: 'record_delete',
          record_title: record.title,
        },
        requestedBy: profile.id,
        entitySnapshot: {
          id: record.id,
          title: record.title,
          stage: record.stage,
          data: record.data,
        },
      });

      if (result.success) {
        return NextResponse.json(
          {
            success: false,
            requiresApproval: true,
            approvalId: result.approvalId,
            message: 'Deletion requires approval',
          },
          { status: 202 }
        );
      }
      // Deletion requires approval but we could NOT record the request — do not
      // fall through and delete the record anyway (that would bypass approval).
      return NextResponse.json(
        { error: 'Could not submit the approval request; the record was not deleted.' },
        { status: 500 }
      );
    }

    // Soft-delete: stamp deleted_at instead of a physical DELETE so the record
    // (and everything the cascade would have taken) can be restored from Trash.
    // The RPC re-checks org + crm_admin/crm_manager and returns the trash batch id.
    const { data: batchId, error } = await (supabase as any).rpc('crm_soft_delete_record', {
      p_record_id: id,
      p_origin: 'user',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log PHI access for deletion
    try {
      await logPHIAccess({
        userId: profile.id,
        organizationId: profile.organization_id,
        action: 'delete',
        resourceType: 'record',
        resourceId: id,
        recordName: record.title,
        metadata: { module_id: record.module_id },
      });
    } catch (err) {
      console.error('PHI audit logging error:', err);
    }

    return NextResponse.json({ success: true, trashed: true, batchId: batchId ?? null });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
