import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  body_text: string;
  body_html?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
  }>;
}

interface CreateTicketPayload {
  requester_email: string;
  subject: string;
  description: string;
  channel: string;
  priority: string;
  status: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  // Reject timestamps older than 5 minutes to prevent replay attacks
  const timestampSec = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSec)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSec) > 300) return false;

  // Secret format: "whsec_<base64>" — strip prefix and decode
  const secretBytes = Uint8Array.from(
    atob(secret.startsWith("whsec_") ? secret.slice(6) : secret),
    (c) => c.charCodeAt(0)
  );

  // Signed content: "{svixId}.{svixTimestamp}.{body}"
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  // svix-signature may contain multiple signatures: "v1,<sig1> v1,<sig2>"
  const signatures = svixSignature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length !== 2 || parts[0] !== "v1") continue;
    if (constantTimeEqual(parts[1], expectedSig)) return true;
  }

  return false;
}

// Cache raw body for signature verification (body can only be read once)
let cachedRawBody: string | null = null;

async function verifyAuth(req: Request): Promise<boolean> {
  const secret = Deno.env.get("EDGE_FUNCTION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (constantTimeEqual(authHeader, `Bearer ${secret}`)) return true;

  // Verify Resend webhook signature (svix HMAC-SHA256)
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (svixId && svixTimestamp && svixSignature) {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      cachedRawBody = await req.text();
      return verifySvixSignature(cachedRawBody, svixId, svixTimestamp, svixSignature, webhookSecret);
    }
  }

  return false;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Authenticate: require Bearer token or verified Resend webhook signature
  if (!(await verifyAuth(req))) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use cached body from signature verification, or read fresh for Bearer auth
    const rawBody = cachedRawBody ?? await req.text();
    cachedRawBody = null; // Clear cache after use
    const emailData = JSON.parse(rawBody) as EmailPayload;

    const supabaseHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
    };

    // Check if this is a reply to an existing ticket
    const isReply = await checkIfReply(emailData, supabaseUrl, supabaseHeaders);
    
    if (isReply.isReply && isReply.ticketId) {
      // Add comment to existing ticket
      return await handleEmailReply(
        emailData,
        isReply.ticketId,
        supabaseUrl,
        supabaseHeaders
      );
    }

    // Create new ticket
    return await handleNewTicket(emailData, supabaseUrl, supabaseHeaders);
  } catch (error) {
    console.error("Email intake error:", error);

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

// Check if email is a reply to an existing ticket
async function checkIfReply(
  emailData: EmailPayload,
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<{ isReply: boolean; ticketId?: string }> {
  // Method 1: Check In-Reply-To header
  const inReplyTo = emailData.headers?.["in-reply-to"] || emailData.headers?.["In-Reply-To"];
  
  if (inReplyTo) {
    // Try to find ticket by message ID stored in email_thread_id
    const ticketResponse = await fetch(
      `${supabaseUrl}/rest/v1/tickets?email_thread_id=eq.${encodeURIComponent(inReplyTo)}&select=id&limit=1`,
      { headers }
    );

    if (ticketResponse.ok) {
      const tickets = await ticketResponse.json();
      if (tickets && tickets.length > 0) {
        return { isReply: true, ticketId: tickets[0].id };
      }
    }
  }

  // Method 2: Check for ticket number in subject (e.g., #abc12345 or [#abc12345])
  const ticketNumberMatch = emailData.subject.match(/[#\[]#?([a-f0-9]{8})[\]]?/i);
  
  if (ticketNumberMatch) {
    const ticketNumber = ticketNumberMatch[1];
    
    // Find ticket by ID prefix
    const ticketResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/find_ticket_by_number`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ticket_number_prefix: ticketNumber }),
      }
    );

    if (ticketResponse.ok) {
      const result = await ticketResponse.json();
      if (result) {
        return { isReply: true, ticketId: result };
      }
    }
  }

  return { isReply: false };
}

// Handle email reply - add comment to existing ticket
async function handleEmailReply(
  emailData: EmailPayload,
  ticketId: string,
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<Response> {
  // Find user by email
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(
      emailData.from
    )}&select=id`,
    { headers }
  );

  let authorId: string | null = null;

  if (profileResponse.ok) {
    const profiles = await profileResponse.json();
    if (profiles && profiles.length > 0) {
      authorId = profiles[0].id;
    }
  }

  // Strip quoted text from email body
  const cleanedBody = stripQuotedText(emailData.body_text);

  // Create comment
  const commentResponse = await fetch(
    `${supabaseUrl}/rest/v1/ticket_comments`,
    {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        ticket_id: ticketId,
        author_id: authorId,
        body: cleanedBody || emailData.body_text,
        is_internal: false,
        reply_to_message_id: emailData.headers?.["message-id"],
      }),
    }
  );

  if (!commentResponse.ok) {
    const error = await commentResponse.text();
    throw new Error(`Failed to create comment: ${error}`);
  }

  const comments = await commentResponse.json();
  const comment = comments[0];

  // Update ticket's last_message_at
  await fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      last_message_at: new Date().toISOString(),
    }),
  });

  return new Response(
    JSON.stringify({
      success: true,
      action: "reply_added",
      ticket_id: ticketId,
      comment_id: comment.id,
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

// Handle new ticket creation
async function handleNewTicket(
  emailData: EmailPayload,
  supabaseUrl: string,
  headers: Record<string, string>
): Promise<Response> {
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(
      emailData.from
    )}&select=id`,
    { headers }
  );

  let requesterId: string | null = null;

  if (profileResponse.ok) {
    const profiles = await profileResponse.json();
    if (profiles && profiles.length > 0) {
      requesterId = profiles[0].id;
    }
  }

  const priority = determinePriority(emailData.subject, emailData.body_text);

  const ticketPayload: any = {
    requester_email: emailData.from,
    subject: emailData.subject || "(No Subject)",
    description: emailData.body_text || emailData.body_html || "",
    channel: "email",
    priority,
    status: "new",
    email_thread_id: emailData.headers?.["message-id"] || null,
  };

  if (requesterId) {
    ticketPayload.requester_id = requesterId;
  }

  const createResponse = await fetch(
    `${supabaseUrl}/rest/v1/tickets`,
    {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(ticketPayload),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create ticket: ${error}`);
  }

  const tickets = await createResponse.json();
  const ticket = tickets[0];

  await fetch(`${supabaseUrl}/rest/v1/ticket_events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ticket_id: ticket.id,
      event_type: "created_from_email",
      payload: {
        from: emailData.from,
        to: emailData.to,
        message_id: emailData.headers?.["message-id"],
        has_attachments: (emailData.attachments?.length || 0) > 0,
      },
    }),
  });

  if (emailData.attachments && emailData.attachments.length > 0) {
    for (const attachment of emailData.attachments) {
      await fetch(`${supabaseUrl}/rest/v1/ticket_files`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ticket_id: ticket.id,
          filename: attachment.filename,
          storage_path: attachment.url || "",
          file_size: attachment.size,
          mime_type: attachment.content_type,
        }),
      });
    }
  }

  const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (slackWebhookUrl) {
    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `New ticket created from email: #${ticket.id.substring(0, 8)} - ${
          ticket.subject
        }`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*New Email Ticket*\n*From:* ${emailData.from}\n*Subject:* ${emailData.subject}\n*Priority:* ${priority}`,
            },
          },
        ],
      }),
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      action: "ticket_created",
      ticket_id: ticket.id,
      ticket_number: ticket.id.substring(0, 8),
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

function stripQuotedText(body: string): string {
  // Remove common quote markers
  const lines = body.split("\n");
  const cleanedLines: string[] = [];
  let inQuote = false;

  for (const line of lines) {
    // Detect quote start
    if (
      line.trim().startsWith(">") ||
      line.trim().startsWith("On ") && line.includes("wrote:") ||
      line.includes("-----Original Message-----") ||
      line.includes("________________________________")
    ) {
      inQuote = true;
      break;
    }

    if (!inQuote) {
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join("\n").trim();
}

function determinePriority(subject: string, body: string): string {
  const text = `${subject} ${body}`.toLowerCase();

  if (
    text.includes("urgent") ||
    text.includes("critical") ||
    text.includes("down") ||
    text.includes("outage") ||
    text.includes("emergency")
  ) {
    return "urgent";
  }

  if (
    text.includes("high priority") ||
    text.includes("important") ||
    text.includes("asap")
  ) {
    return "high";
  }

  return "medium";
}