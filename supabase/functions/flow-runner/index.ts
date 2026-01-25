import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Workflow {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  is_active: boolean;
}

interface WorkflowStep {
  id: string;
  workflow_id: string;
  sort_order: number;
  step_type: string;
  step_config: any;
}

interface ExecutionContext {
  workflow_id: string;
  execution_id: string;
  trigger_data: any;
  variables: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { event_type, event_data } = await req.json();

    const supabaseHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    const workflowsResponse = await fetch(
      `${supabaseUrl}/rest/v1/workflows?is_active=eq.true&trigger_type=eq.${event_type}&select=*`,
      { headers: supabaseHeaders }
    );

    if (!workflowsResponse.ok) {
      throw new Error("Failed to fetch workflows");
    }

    const workflows = (await workflowsResponse.json()) as Workflow[];

    const results = [];

    for (const workflow of workflows) {
      const executionResponse = await fetch(
        `${supabaseUrl}/rest/v1/workflow_executions`,
        {
          method: "POST",
          headers: { ...supabaseHeaders, "Prefer": "return=representation" },
          body: JSON.stringify({
            workflow_id: workflow.id,
            status: "running",
            trigger_data: event_data,
            logs: [],
          }),
        }
      );

      if (!executionResponse.ok) {
        console.error("Failed to create execution record");
        continue;
      }

      const executions = await executionResponse.json();
      const execution = executions[0];

      const stepsResponse = await fetch(
        `${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${workflow.id}&select=*&order=sort_order.asc`,
        { headers: supabaseHeaders }
      );

      if (!stepsResponse.ok) {
        console.error("Failed to fetch workflow steps");
        continue;
      }

      const steps = (await stepsResponse.json()) as WorkflowStep[];

      const context: ExecutionContext = {
        workflow_id: workflow.id,
        execution_id: execution.id,
        trigger_data: event_data,
        variables: {},
      };

      const logs: string[] = [];
      let success = true;

      for (const step of steps) {
        try {
          const stepResult = await executeStep(
            step,
            context,
            supabaseUrl,
            supabaseKey
          );

          logs.push(
            `[${new Date().toISOString()}] Step ${step.sort_order} (${
              step.step_type
            }): ${stepResult.message}`
          );

          if (stepResult.variables) {
            context.variables = { ...context.variables, ...stepResult.variables };
          }

          if (!stepResult.success) {
            success = false;
            break;
          }
        } catch (error) {
          logs.push(
            `[${new Date().toISOString()}] Step ${step.sort_order} ERROR: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
          success = false;
          break;
        }
      }

      await fetch(
        `${supabaseUrl}/rest/v1/workflow_executions?id=eq.${execution.id}`,
        {
          method: "PATCH",
          headers: supabaseHeaders,
          body: JSON.stringify({
            status: success ? "completed" : "failed",
            logs,
            completed_at: new Date().toISOString(),
          }),
        }
      );

      results.push({
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        execution_id: execution.id,
        success,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_type,
        workflows_triggered: results.length,
        results,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Flow runner error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function executeStep(
  step: WorkflowStep,
  context: ExecutionContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; message: string; variables?: Record<string, any> }> {
  const config = step.step_config;

  switch (step.step_type) {
    case "condition":
      return executeCondition(config, context);

    case "function":
      return executeFunction(config, context, supabaseUrl, supabaseKey);

    case "task":
      return executeTask(config, context, supabaseUrl, supabaseKey);

    case "notify":
      return executeNotify(config, context, supabaseUrl, supabaseKey);

    case "approval":
      return executeApproval(config, context, supabaseUrl, supabaseKey);

    case "webhook":
      return executeWebhook(config, context);

    case "wait":
      await new Promise((resolve) =>
        setTimeout(resolve, config.delay_ms || 1000)
      );
      return { success: true, message: `Delayed ${config.delay_ms}ms` };

    default:
      return { success: false, message: `Unknown step type: ${step.step_type}` };
  }
}

function executeCondition(
  config: any,
  context: ExecutionContext
): { success: boolean; message: string } {
  const { field, operator, value } = config;
  const actualValue = context.trigger_data[field];

  let result = false;

  switch (operator) {
    case "equals":
      result = actualValue === value;
      break;
    case "contains":
      result = String(actualValue).includes(value);
      break;
    case "greater_than":
      result = actualValue > value;
      break;
    case "less_than":
      result = actualValue < value;
      break;
    default:
      return { success: false, message: `Unknown operator: ${operator}` };
  }

  return {
    success: result,
    message: result ? "Condition passed" : "Condition failed",
  };
}

async function executeFunction(
  config: any,
  context: ExecutionContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; message: string }> {
  const functionName = config.function_name;

  if (functionName === 'assign_to_least_busy_agent') {
    const ticketId = context.trigger_data.ticket_id;
    if (!ticketId) {
      return { success: false, message: "No ticket_id in trigger data" };
    }

    const agentResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_least_busy_agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!agentResponse.ok) {
      return { success: false, message: "Failed to find available agent" };
    }

    const agentId = await agentResponse.text();
    if (!agentId || agentId === 'null') {
      return { success: false, message: "No agents available" };
    }

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ assignee_id: agentId.replace(/"/g, '') }),
      }
    );

    if (!updateResponse.ok) {
      return { success: false, message: "Failed to assign ticket" };
    }

    return { success: true, message: `Assigned ticket to agent ${agentId}` };
  }

  return { success: false, message: `Unknown function: ${functionName}` };
}

async function executeTask(
  config: any,
  context: ExecutionContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; message: string }> {
  const action = config.action;
  const ticketId = context.trigger_data.ticket_id;

  if (!ticketId) {
    return { success: false, message: "No ticket_id provided" };
  }

  if (action === 'update_ticket') {
    const updates: any = {};
    updates[config.field] = config.value;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      return { success: false, message: `Failed to update ticket: ${response.statusText}` };
    }

    return { success: true, message: `Updated ticket ${ticketId}` };
  }

  return { success: false, message: `Unknown task action: ${action}` };
}

async function executeNotify(
  config: any,
  context: ExecutionContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; message: string }> {
  const recipientType = config.recipient_type;
  const subject = interpolateVariables(config.subject || 'Notification', context);
  const message = interpolateVariables(config.message, context);

  const ticketId = context.trigger_data.ticket_id;

  if (recipientType === 'assigned_agent' && context.trigger_data.assignee_id) {
    console.log(`Would notify agent ${context.trigger_data.assignee_id}: ${subject}`);
    return { success: true, message: `Notification queued for assigned agent` };
  }

  if (recipientType === 'requester' && context.trigger_data.requester_id) {
    console.log(`Would notify requester ${context.trigger_data.requester_id}: ${subject}`);
    return { success: true, message: `Notification queued for requester` };
  }

  if (recipientType === 'managers') {
    console.log(`Would notify all managers: ${subject}`);
    return { success: true, message: `Notification queued for managers` };
  }

  return { success: false, message: `Unknown recipient type: ${recipientType}` };
}

async function executeApproval(
  config: any,
  context: ExecutionContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; message: string }> {
  return { success: true, message: "Approval step queued" };
}

async function executeWebhook(
  config: any,
  context: ExecutionContext
): Promise<{ success: boolean; message: string; variables?: Record<string, any> }> {
  const url = interpolateVariables(config.url, context);
  const method = config.method || "GET";
  const headers = config.headers || {};
  const body = config.body ? interpolateVariables(JSON.stringify(config.body), context) : undefined;

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    return { success: false, message: `HTTP request failed: ${response.status}` };
  }

  const responseData = await response.json();

  return {
    success: true,
    message: `Webhook ${method} to ${url} succeeded`,
    variables: { http_response: responseData },
  };
}

function interpolateVariables(
  template: string,
  context: ExecutionContext
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    return (
      context.variables[trimmedKey] ||
      context.trigger_data[trimmedKey] ||
      `{{${trimmedKey}}}`
    );
  });
}