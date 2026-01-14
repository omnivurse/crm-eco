import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { executeMatchingWorkflows } from '@/lib/automation';
import type { CrmRecord } from '@/lib/crm/types';
import type { CrmWorkflow } from '@/lib/automation/types';

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
      return NextResponse.json(
        { error: 'Missing x-webhook-secret header' },
        { status: 401 }
      );
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

    // Find workflow(s) with matching webhook secret
    const { data: workflows, error: workflowError } = await supabase
      .from('crm_workflows')
      .select('*, module:crm_modules!crm_workflows_module_id_fkey(id, key)')
      .eq('trigger_type', 'inbound_webhook')
      .eq('webhook_secret', webhookSecret)
      .eq('is_enabled', true);

    if (workflowError) {
      console.error('Failed to fetch workflows:', workflowError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!workflows || workflows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid webhook secret or no matching workflows' },
        { status: 404 }
      );
    }

    // Validate org_id if provided in header
    const workflow = workflows[0];
    if (orgIdHeader && workflow.org_id !== orgIdHeader) {
      return NextResponse.json(
        { error: 'Organization mismatch' },
        { status: 403 }
      );
    }

    // Filter workflows by module if specified
    let targetWorkflows = workflows;
    if (moduleKey) {
      targetWorkflows = workflows.filter(w => {
        const moduleData = w.module as { key?: string } | null;
        return moduleData?.key === moduleKey;
      });
      
      if (targetWorkflows.length === 0) {
        return NextResponse.json(
          { error: `No workflows found for module: ${moduleKey}` },
          { status: 404 }
        );
      }
    }

    // Get the target module
    const targetWorkflow = targetWorkflows[0];
    const moduleId = targetWorkflow.module_id;

    // Create or find a record to run the workflow against
    let record: CrmRecord | null = null;

    // Check if data includes an existing record ID
    if (data.id && typeof data.id === 'string') {
      const { data: existingRecord, error: recordError } = await supabase
        .from('crm_records')
        .select('*')
        .eq('id', data.id)
        .single();

      if (!recordError && existingRecord) {
        record = existingRecord as CrmRecord;
      }
    }

    // If no existing record, create a new one
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

      const { data: newRecord, error: createError } = await supabase
        .from('crm_records')
        .insert({
          org_id: workflow.org_id,
          module_id: moduleId,
          ...systemData,
          data: customData,
          system: {
            source: 'webhook',
            webhook_received_at: new Date().toISOString(),
            ...metadata,
          },
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create record:', createError);
        return NextResponse.json(
          { error: 'Failed to create record', details: createError.message },
          { status: 500 }
        );
      }

      record = newRecord as CrmRecord;
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
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
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
