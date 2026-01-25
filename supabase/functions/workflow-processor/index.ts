import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const supabaseHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    const queueResponse = await fetch(
      `${supabaseUrl}/rest/v1/workflow_queue?status=eq.pending&order=created_at.asc&limit=10`,
      { headers: supabaseHeaders }
    );

    if (!queueResponse.ok) {
      throw new Error("Failed to fetch workflow queue");
    }

    const queueItems = await queueResponse.json();
    const results = [];

    for (const item of queueItems) {
      await fetch(
        `${supabaseUrl}/rest/v1/workflow_queue?id=eq.${item.id}`,
        {
          method: "PATCH",
          headers: supabaseHeaders,
          body: JSON.stringify({ status: "processing" }),
        }
      );

      try {
        const flowRunnerUrl = `${supabaseUrl}/functions/v1/flow-runner`;
        const flowResponse = await fetch(flowRunnerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            event_type: item.event_type,
            event_data: item.event_data,
          }),
        });

        if (!flowResponse.ok) {
          throw new Error(`Flow runner failed: ${flowResponse.statusText}`);
        }

        const flowResult = await flowResponse.json();

        await fetch(
          `${supabaseUrl}/rest/v1/workflow_queue?id=eq.${item.id}`,
          {
            method: "PATCH",
            headers: supabaseHeaders,
            body: JSON.stringify({
              status: "completed",
              processed_at: new Date().toISOString(),
            }),
          }
        );

        results.push({
          queue_item_id: item.id,
          event_type: item.event_type,
          success: true,
          workflows_triggered: flowResult.workflows_triggered || 0,
        });
      } catch (error) {
        const retryCount = item.retry_count + 1;
        const newStatus = retryCount >= item.max_retries ? "failed" : "pending";

        await fetch(
          `${supabaseUrl}/rest/v1/workflow_queue?id=eq.${item.id}`,
          {
            method: "PATCH",
            headers: supabaseHeaders,
            body: JSON.stringify({
              status: newStatus,
              retry_count: retryCount,
              error_message: error instanceof Error ? error.message : "Unknown error",
            }),
          }
        );

        results.push({
          queue_item_id: item.id,
          event_type: item.event_type,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems.length,
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
    console.error("Workflow processor error:", error);

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