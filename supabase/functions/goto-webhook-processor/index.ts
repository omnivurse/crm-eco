import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GotoWebhookEvent {
  metadata: {
    conversationSpaceId: string;
    direction: "INBOUND" | "OUTBOUND";
    accountKey?: string;
  };
  state: {
    sequenceNumber: number;
    type: "STARTING" | "RINGING" | "ACTIVE" | "ENDING" | "ENDED";
    participants: Array<{
      participantId: string;
      phoneNumber?: string;
      displayName?: string;
      role: string;
    }>;
  };
  eventId?: string;
  callId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse webhook payload
    const event: GotoWebhookEvent = await req.json();

    console.log("Received GoTo Connect webhook:", {
      type: event.state?.type,
      conversationSpaceId: event.metadata?.conversationSpaceId,
    });

    // Store webhook event for debugging
    await supabase.from("goto_webhooks").insert({
      event_id: event.eventId || `${event.metadata.conversationSpaceId}-${event.state.sequenceNumber}`,
      event_type: event.state.type,
      conversation_space_id: event.metadata.conversationSpaceId,
      sequence_number: event.state.sequenceNumber,
      payload: event,
      processed_at: null,
    });

    // Process the event based on type
    switch (event.state.type) {
      case "STARTING":
      case "RINGING":
        await handleCallStart(supabase, event);
        break;

      case "ACTIVE":
        await handleCallActive(supabase, event);
        break;

      case "ENDING":
      case "ENDED":
        await handleCallEnd(supabase, event);
        break;

      default:
        console.log("Unknown event type:", event.state.type);
    }

    // Mark webhook as processed
    await supabase
      .from("goto_webhooks")
      .update({ processed_at: new Date().toISOString() })
      .eq("conversation_space_id", event.metadata.conversationSpaceId)
      .eq("sequence_number", event.state.sequenceNumber);

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);

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

/**
 * Handle call start (STARTING/RINGING events)
 */
async function handleCallStart(supabase: any, event: GotoWebhookEvent) {
  const { conversationSpaceId, direction } = event.metadata;
  const { participants } = event.state;

  // Check if call already exists
  const { data: existingCall } = await supabase
    .from("call_logs")
    .select("id")
    .eq("goto_conversation_space_id", conversationSpaceId)
    .maybeSingle();

  if (existingCall) {
    // Update existing call
    await supabase
      .from("call_logs")
      .update({ status: "ringing" })
      .eq("id", existingCall.id);
    return;
  }

  // Extract caller and recipient info
  const caller = participants.find((p) => p.role === "caller");
  const recipient = participants.find((p) => p.role === "agent" || p.role === "callee");

  if (!caller) {
    console.error("No caller found in participants");
    return;
  }

  // Get settings to check if auto-ticket creation is enabled
  const { data: settings } = await supabase
    .from("goto_settings")
    .select("auto_ticket_creation")
    .maybeSingle();

  let ticketId = null;

  // For inbound calls, optionally create ticket
  if (direction === "INBOUND" && settings?.auto_ticket_creation) {
    // Try to find existing user by phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", caller.phoneNumber)
      .maybeSingle();

    // Create ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .insert({
        requester_id: profile?.id || null,
        subject: `Incoming call from ${caller.displayName || caller.phoneNumber}`,
        description: `Automatically created from incoming call at ${new Date().toISOString()}`,
        status: "new",
        priority: "medium",
        category: "Phone Call",
      })
      .select()
      .maybeSingle();

    ticketId = ticket?.id;
  }

  // Create call log
  const { data: callLog, error: callError } = await supabase
    .from("call_logs")
    .insert({
      goto_call_id: event.callId,
      goto_conversation_space_id: conversationSpaceId,
      caller_phone: caller.phoneNumber || "unknown",
      caller_name: caller.displayName,
      recipient_phone: recipient?.phoneNumber || "unknown",
      direction: direction.toLowerCase(),
      status: "ringing",
      ticket_id: ticketId,
      metadata: event,
    })
    .select()
    .single();

  if (callError) {
    console.error("Failed to create call log:", callError);
    return;
  }

  // Add to call queue if inbound
  if (direction === "INBOUND") {
    await supabase.from("call_queue").insert({
      call_log_id: callLog.id,
      status: "waiting",
      priority: 5,
    });
  }

  // Create participant records
  for (const participant of participants) {
    await supabase.from("call_participants").insert({
      call_log_id: callLog.id,
      phone_number: participant.phoneNumber || "unknown",
      display_name: participant.displayName,
      role: participant.role,
      is_primary: participant.role === "caller",
    });
  }

  console.log("Call started:", {
    callLogId: callLog.id,
    ticketId,
    direction,
  });
}

/**
 * Handle call becoming active
 */
async function handleCallActive(supabase: any, event: GotoWebhookEvent) {
  const { conversationSpaceId } = event.metadata;

  // Find call log
  const { data: callLog } = await supabase
    .from("call_logs")
    .select("id")
    .eq("goto_conversation_space_id", conversationSpaceId)
    .maybeSingle();

  if (!callLog) {
    console.error("Call log not found for active event");
    return;
  }

  // Update call status
  await supabase
    .from("call_logs")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", callLog.id);

  // Remove from queue if queued
  await supabase
    .from("call_queue")
    .update({ status: "assigned" })
    .eq("call_log_id", callLog.id)
    .eq("status", "waiting");

  console.log("Call active:", callLog.id);
}

/**
 * Handle call ending
 */
async function handleCallEnd(supabase: any, event: GotoWebhookEvent) {
  const { conversationSpaceId } = event.metadata;

  // Find call log
  const { data: callLog } = await supabase
    .from("call_logs")
    .select("id, ticket_id, started_at")
    .eq("goto_conversation_space_id", conversationSpaceId)
    .maybeSingle();

  if (!callLog) {
    console.error("Call log not found for end event");
    return;
  }

  const endedAt = new Date().toISOString();

  // Calculate duration
  let durationSeconds = 0;
  if (callLog.started_at) {
    const startTime = new Date(callLog.started_at).getTime();
    const endTime = new Date(endedAt).getTime();
    durationSeconds = Math.floor((endTime - startTime) / 1000);
  }

  // Update call status
  await supabase
    .from("call_logs")
    .update({
      status: "ended",
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .eq("id", callLog.id);

  // Update queue if applicable
  await supabase
    .from("call_queue")
    .delete()
    .eq("call_log_id", callLog.id);

  // Add comment to ticket if linked
  if (callLog.ticket_id) {
    await supabase.from("ticket_comments").insert({
      ticket_id: callLog.ticket_id,
      body: `Call ended. Duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
      is_internal: false,
    });
  }

  console.log("Call ended:", {
    callLogId: callLog.id,
    duration: durationSeconds,
  });
}
