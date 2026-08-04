import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authorizeInternalEdgeRequest,
  unauthorizedResponse,
} from "../_shared/cron-auth.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes("*") ? "*" :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

interface SLATimer {
  id: string;
  ticket_id: string;
  sla_policy_id: string;
  response_due_at: string | null;
  resolve_due_at: string | null;
  response_breached: boolean;
  resolve_breached: boolean;
  paused_at: string | null;
  created_at: string;
}

interface TicketInfo {
  id: string;
  subject: string;
  priority: string;
  assignee_id: string | null;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Fail closed. Service-role key (RLS bypassed), no caller check previously —
  // it mutates SLA state. `verify_jwt` accepts the public anon key, which ships
  // in every browser bundle, so it authenticates nothing on its own.
  if (!authorizeInternalEdgeRequest(req)) return unauthorizedResponse(corsHeaders);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

    const now = new Date().toISOString();
    const warnings: string[] = [];
    const breaches: string[] = [];

    const supabaseHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    const timersResponse = await fetch(
      `${supabaseUrl}/rest/v1/sla_timers?paused_at=is.null&select=*`,
      { headers: supabaseHeaders }
    );

    if (!timersResponse.ok) {
      throw new Error(`Failed to fetch SLA timers: ${timersResponse.statusText}`);
    }

    const timers = (await timersResponse.json()) as SLATimer[];

    for (const timer of timers) {
      const ticketResponse = await fetch(
        `${supabaseUrl}/rest/v1/tickets?id=eq.${timer.ticket_id}&select=id,subject,priority,assignee_id`,
        { headers: supabaseHeaders }
      );

      if (!ticketResponse.ok) continue;

      const tickets = (await ticketResponse.json()) as TicketInfo[];
      if (tickets.length === 0) continue;

      const ticket = tickets[0];
      let needsUpdate = false;
      const updatePayload: Partial<SLATimer> = {};

      if (timer.response_due_at && !timer.response_breached) {
        const responseDue = new Date(timer.response_due_at);
        const warningTime = new Date(responseDue.getTime() - 15 * 60 * 1000);

        if (now > timer.response_due_at) {
          breaches.push(
            `🚨 Response SLA BREACHED for Ticket #${ticket.id.substring(0, 8)}: "${ticket.subject}"`
          );
          updatePayload.response_breached = true;
          needsUpdate = true;

          await fetch(`${supabaseUrl}/rest/v1/ticket_events`, {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify({
              ticket_id: ticket.id,
              event_type: "sla_breach",
              payload: {
                breach_type: "response",
                due_at: timer.response_due_at,
                breached_at: now,
              },
            }),
          });
        } else if (now > warningTime.toISOString()) {
          const minutesLeft = Math.round(
            (responseDue.getTime() - new Date().getTime()) / 60000
          );
          warnings.push(
            `⚠️ Response SLA warning for Ticket #${ticket.id.substring(0, 8)}: ${minutesLeft} minutes remaining`
          );
        }
      }

      if (timer.resolve_due_at && !timer.resolve_breached) {
        const resolveDue = new Date(timer.resolve_due_at);
        const warningTime = new Date(resolveDue.getTime() - 60 * 60 * 1000);

        if (now > timer.resolve_due_at) {
          breaches.push(
            `🚨 Resolution SLA BREACHED for Ticket #${ticket.id.substring(0, 8)}: "${ticket.subject}"`
          );
          updatePayload.resolve_breached = true;
          needsUpdate = true;

          await fetch(`${supabaseUrl}/rest/v1/ticket_events`, {
            method: "POST",
            headers: supabaseHeaders,
            body: JSON.stringify({
              ticket_id: ticket.id,
              event_type: "sla_breach",
              payload: {
                breach_type: "resolution",
                due_at: timer.resolve_due_at,
                breached_at: now,
              },
            }),
          });
        } else if (now > warningTime.toISOString()) {
          const hoursLeft = Math.round(
            (resolveDue.getTime() - new Date().getTime()) / 3600000
          );
          warnings.push(
            `⚠️ Resolution SLA warning for Ticket #${ticket.id.substring(0, 8)}: ${hoursLeft} hours remaining`
          );
        }
      }

      if (needsUpdate) {
        await fetch(
          `${supabaseUrl}/rest/v1/sla_timers?id=eq.${timer.id}`,
          {
            method: "PATCH",
            headers: supabaseHeaders,
            body: JSON.stringify(updatePayload),
          }
        );
      }
    }

    if ((warnings.length > 0 || breaches.length > 0) && slackWebhookUrl) {
      const message = {
        text: "SLA Monitoring Report",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "SLA Monitoring Report",
            },
          },
          ...(breaches.length > 0
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Breaches:*\n${breaches.join("\n")}`,
                  },
                },
              ]
            : []),
          ...(warnings.length > 0
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Warnings:*\n${warnings.join("\n")}`,
                  },
                },
              ]
            : []),
        ],
      };

      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: timers.length,
        warnings: warnings.length,
        breaches: breaches.length,
        timestamp: now,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("SLA daemon error:", error);

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
