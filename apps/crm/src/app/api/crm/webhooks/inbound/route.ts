import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import crypto from 'crypto';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import {
  buildNormalizedRecordWrite,
  pickUpdateMirrorColumns,
} from '@/lib/crm/merge-crm-data-json-to-row';


/** Generic 401 response — identical regardless of rejection reason */
const UNAUTHORIZED_RESPONSE = { error: 'Unauthorized' } as const;

/** Constant-time string comparison to prevent timing attacks */
function safeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Creates a service role client for webhook operations
 */
function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

const webhookPayloadSchema = z.object({
  module: z.string().optional(), // Module key (e.g., 'leads', 'contacts')
  data: z.record(z.unknown()), // Record data to create/update
  metadata: z.record(z.unknown()).optional(), // Additional metadata
});

/**
 * POST /api/crm/webhooks/inbound
 * 
 * Inbound webhook entry point for triggering workflows from external systems.
 * 
 * Headers:
 * - x-webhook-secret: The workflow's webhook secret for validation
 * - x-org-id: The organization ID (optional, can be determined from secret)
 * 
 * Body:
 * {
 *   module: "leads", // Optional, module key
 *   data: { ... }, // Record data
 *   metadata: { ... } // Optional metadata
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get webhook secret from header
    const webhookSecret = request.headers.get('x-webhook-secret');
    const orgIdHeader = request.headers.get('x-org-id');

    if (!webhookSecret) {
      return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const parsed = webhookPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { module: moduleKey, data, metadata } = parsed.data;

    // Fetch all enabled inbound_webhook workflows, then compare secrets
    // in constant time to prevent timing-based enumeration
    const { data: allWebhookWorkflows, error: workflowError } = await supabase
      .from('crm_workflows')
      .select('*, module:crm_modules!crm_workflows_module_id_fkey(id, key)')
      .eq('trigger_type', 'inbound_webhook')
      .eq('is_enabled', true);

    if (workflowError) {
      console.error('Failed to fetch workflows:', workflowError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Constant-time comparison against all workflow secrets
    const workflows = (allWebhookWorkflows || []).filter(w =>
      w.webhook_secret && safeCompare(webhookSecret, w.webhook_secret as string)
    );

    if (workflows.length === 0) {
      // Identical response to "no secret" case — no information leakage
      return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
    }

    // Validate org_id if provided in header (same generic 401)
    const workflow = workflows[0];
    if (orgIdHeader && !safeCompare(workflow.org_id, orgIdHeader)) {
      return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
    }

    // Filter workflows by module if specified
    let targetWorkflows = workflows;
    if (moduleKey) {
      targetWorkflows = workflows.filter(w => {
        const moduleData = w.module as { key?: string } | null;
        return moduleData?.key === moduleKey;
      });

      if (targetWorkflows.length === 0) {
        // Same generic 401 — don't reveal module names
        return NextResponse.json(UNAUTHORIZED_RESPONSE, { status: 401 });
      }
    }

    // Get the target module
    const targetWorkflow = targetWorkflows[0];
    const moduleId = targetWorkflow.module_id;
    const resolvedModuleKey =
      (targetWorkflow.module as { key?: string } | null)?.key ?? moduleKey ?? null;

    // Create or find a record to run the workflow against
    let record: CrmRecord | null = null;

    // Check if data includes an existing record ID
    if (data.id && typeof data.id === 'string') {
      const { data: existingRecord, error: recordError } = await supabase
        .from('crm_records')
        .select('*')
        .eq('id', data.id)
        .eq('org_id', workflow.org_id)
        .single();

      if (!recordError && existingRecord) {
        record = existingRecord as CrmRecord;
      }
    }

    // If no existing record, try to find by email or create a new one
    if (!record) {
      // Extract system fields
      const systemFields = ['title', 'email', 'phone', 'status', 'stage'];
      const systemData: Record<string, unknown> = {};
      const customData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        if (key === 'id') continue; // Skip id
        if (systemFields.includes(key)) {
          systemData[key] = value;
        } else {
          customData[key] = value;
        }
      }

      // Generate title if not provided
      if (!systemData.title) {
        systemData.title = customData.first_name && customData.last_name
          ? `${customData.first_name} ${customData.last_name}`
          : customData.name || customData.company || `Webhook Record ${new Date().toISOString()}`;
      }

      // Check for existing record by email to prevent duplicates
      const incomingEmail = (systemData.email as string) || null;
      if (incomingEmail) {
        const { data: existingByEmail } = await supabase
          .from('crm_records')
          .select('*')
          .eq('org_id', workflow.org_id)
          .eq('module_id', moduleId)
          .ilike('email', incomingEmail)
          .limit(1)
          .single();

        if (existingByEmail) {
          // Update existing record with new data instead of creating duplicate.
          // Normalize the merged JSONB and mirror canonical values onto indexed
          // columns so external updates display/filter like form edits.
          const mergedData = { ...(existingByEmail.data as Record<string, unknown> || {}), ...customData };
          const norm = buildNormalizedRecordWrite(mergedData, {
            moduleKey: resolvedModuleKey,
            previousTitle: (existingByEmail.title as string | null) ?? null,
          });
          const { error: updateError } = await supabase
            .from('crm_records')
            .update({
              // On update, don't re-mirror out-of-band-owned columns (advisor /
              // normalization / status) from possibly-stale JSONB.
              ...pickUpdateMirrorColumns(norm.columns),
              data: norm.data,
              ...(systemData.phone ? { phone: systemData.phone } : {}),
              ...(systemData.status ? { status: systemData.status } : {}),
              system: {
                ...((existingByEmail.system as Record<string, unknown>) || {}),
                ...metadata,
                last_webhook_at: new Date().toISOString(),
              },
            })
            .eq('id', existingByEmail.id);
          if (updateError) {
            // e.g. the status vocabulary guard (23514): never report success
            // for a write the database refused.
            const code = (updateError as { code?: string }).code;
            return NextResponse.json(
              { success: false, error: updateError.message, code },
              { status: code === '23514' ? 400 : 500 },
            );
          }

          record = existingByEmail as CrmRecord;
        }
      }

      // Create new record if no existing match
      if (!record) {
        const norm = buildNormalizedRecordWrite(customData, {
          moduleKey: resolvedModuleKey,
          previousTitle: (systemData.title as string | null) ?? null,
        });
        const { data: newRecord, error: createError } = await supabase
          .from('crm_records')
          .insert({
            org_id: workflow.org_id,
            module_id: moduleId,
            ...norm.columns,
            ...systemData,
            data: norm.data,
            system: {
              ...metadata,
              source: 'webhook',
              webhook_received_at: new Date().toISOString(),
            },
          })
          .select()
          .single();

        if (createError) {
          // Handle unique constraint violation
          if ((createError as any).code === '23505') {
            // Race condition: record was created between check and insert
            const { data: raceRecord } = await supabase
              .from('crm_records')
              .select('*')
              .eq('org_id', workflow.org_id)
              .eq('module_id', moduleId)
              .ilike('email', incomingEmail!)
              .limit(1)
              .single();
            if (raceRecord) {
              record = raceRecord as CrmRecord;
            } else {
              return NextResponse.json(
                { error: 'Duplicate record detected', details: createError.message },
                { status: 409 }
              );
            }
          } else {
            console.error('Failed to create record:', createError);
            return NextResponse.json(
              { error: 'Failed to create record', details: createError.message },
              { status: 500 }
            );
          }
        } else {
          record = newRecord as CrmRecord;
        }
      }
    }

    // Execute matching workflows
    const results = [];
    for (const wf of targetWorkflows) {
      try {
        const workflowResults = await executeMatchingWorkflows({
          orgId: workflow.org_id,
          moduleId: moduleId,
          record,
          trigger: 'inbound_webhook',
          dryRun: false,
        });
        results.push(...workflowResults);
      } catch (error) {
        console.error('Workflow execution error:', error);
        results.push({
          workflowId: wf.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      recordId: record.id,
      workflowsTriggered: targetWorkflows.length,
      results: results.map(r => ({
        workflowId: r.workflowId,
        status: r.status,
        actionsExecuted: 'actionsExecuted' in r && Array.isArray(r.actionsExecuted) 
          ? r.actionsExecuted.length 
          : 0,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('Inbound webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/crm/webhooks/inbound
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/crm/webhooks/inbound',
    description: 'Inbound webhook endpoint for triggering workflows',
    usage: {
      method: 'POST',
      headers: {
        'x-webhook-secret': 'Your workflow webhook secret',
        'Content-Type': 'application/json',
      },
      body: {
        module: 'string (optional) - Module key like "leads" or "contacts"',
        data: 'object (required) - Record data',
        metadata: 'object (optional) - Additional metadata',
      },
    },
  });
}
