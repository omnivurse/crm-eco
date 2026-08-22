import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { resolveMailboxAddress } from "../_shared/mailbox-address.ts";
import { fetchReceivedEmail, mergeHydratedEmail } from "../_shared/resend-inbound.ts";
import {
  inboundEventHash,
  isClosedLoopEnabled,
  ledgerInboundEvent,
  markInboundEvent,
} from "../_shared/inbound-ledger.ts";

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

let corsHeaders: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailPayload {
  from: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  reply_to?: string[];
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
    content?: string; // base64 for Resend inbound
  }>;
}

// Resend inbound webhook wraps email data inside { type, data }
interface ResendInboundEvent {
  type: string;
  data: {
    email_id?: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    reply_to?: string[];
    headers?: Record<string, string> | Array<{ name: string; value: string }>;
    attachments?: Array<{
      filename: string;
      content_type: string;
      size: number;
      content?: string;
      url?: string;
    }>;
    created_at?: string;
  };
}

interface ParsedAddress {
  email: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Parse "Display Name <email@example.com>" or plain "email@example.com" */
function parseEmailAddress(raw: string): ParsedAddress {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^["']|["']$/g, ""), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: raw.trim().toLowerCase() };
}

/** Extract domain from an email address */
function extractDomain(email: string): string {
  return email.split("@")[1] || "";
}

/** Generate a preview from text/html, truncated */
function generatePreview(text: string | undefined, html: string | undefined): string {
  const source = text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "");
  return source.trim().substring(0, 200);
}

/** Normalise Resend headers (can be object or array of {name,value}) */
function normaliseHeaders(
  headers?: Record<string, string> | Array<{ name: string; value: string }>
): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) {
    const obj: Record<string, string> = {};
    for (const h of headers) obj[h.name.toLowerCase()] = h.value;
    return obj;
  }
  // Lowercase all keys
  const obj: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) obj[k.toLowerCase()] = v;
  return obj;
}

// ---------------------------------------------------------------------------
// Svix webhook signature verification
// ---------------------------------------------------------------------------

async function verifySvixSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string
): Promise<boolean> {
  const timestampSec = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSec)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSec) > 300) return false;

  const secretBytes = Uint8Array.from(
    atob(secret.startsWith("whsec_") ? secret.slice(6) : secret),
    (c) => c.charCodeAt(0)
  );

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  const signatures = svixSignature.split(" ");
  for (const sig of signatures) {
    const parts = sig.split(",");
    if (parts.length !== 2 || parts[0] !== "v1") continue;
    if (constantTimeEqual(parts[1], expectedSig)) return true;
  }
  return false;
}

let cachedRawBody: string | null = null;

async function verifyAuth(req: Request): Promise<boolean> {
  const secret = Deno.env.get("EDGE_FUNCTION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (constantTimeEqual(authHeader, `Bearer ${secret}`)) return true;

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (svixId && svixTimestamp && svixSignature) {
    cachedRawBody = await req.text();
    const inboundSecret = Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET");
    const legacySecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    for (const webhookSecret of [inboundSecret, legacySecret]) {
      if (!webhookSecret) continue;
      if (await verifySvixSignature(cachedRawBody, svixId, svixTimestamp, svixSignature, webhookSecret)) {
        return true;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helpers: Supabase REST calls
// ---------------------------------------------------------------------------

type SupaHeaders = Record<string, string>;

async function supaFetch(
  baseUrl: string,
  path: string,
  headers: SupaHeaders,
  opts?: { method?: string; body?: unknown; prefer?: string }
): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts?.method || "GET",
    headers: {
      ...headers,
      ...(opts?.prefer ? { Prefer: opts.prefer } : {}),
    },
    ...(opts?.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${opts?.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return null;
}

// ---------------------------------------------------------------------------
// Inbox routing
// ---------------------------------------------------------------------------

interface OrgContext {
  orgId: string;
  /** Every verified domain the org owns — used to pick the shared mailbox. */
  ownedDomains: string[];
  /** Registered sender addresses — used to collapse forwarded mail onto one queue. */
  registeredAddresses: string[];
}

async function listSenderAddresses(
  orgId: string,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<string[]> {
  try {
    const rows = await supaFetch(
      supabaseUrl,
      `/rest/v1/email_sender_addresses?org_id=eq.${orgId}&select=email`,
      headers
    );
    return (rows || []).map((r: { email: string }) => r.email).filter(Boolean);
  } catch {
    return [];
  }
}

async function listVerifiedDomains(
  orgId: string,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<string[]> {
  try {
    const rows = await supaFetch(
      supabaseUrl,
      `/rest/v1/email_domains?org_id=eq.${orgId}&status=eq.verified&select=domain`,
      headers
    );
    return (rows || []).map((r: { domain: string }) => r.domain).filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveOrgContext(
  toAddresses: string[],
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<OrgContext | null> {
  // Try to match a verified email domain
  for (const addr of toAddresses) {
    const domain = extractDomain(addr);
    if (!domain) continue;
    try {
      const rows = await supaFetch(
        supabaseUrl,
        `/rest/v1/email_domains?domain=eq.${encodeURIComponent(domain)}&status=eq.verified&select=org_id&limit=1`,
        headers
      );
      if (rows && rows.length > 0) {
        const orgId = rows[0].org_id;
        const [ownedDomains, registeredAddresses] = await Promise.all([
          listVerifiedDomains(orgId, supabaseUrl, headers),
          listSenderAddresses(orgId, supabaseUrl, headers),
        ]);
        return { orgId, ownedDomains, registeredAddresses };
      }
    } catch { /* continue */ }
  }

  // Fallback: env variable for single-tenant setups
  const fallbackOrgId = Deno.env.get("DEFAULT_ORG_ID");
  if (!fallbackOrgId) return null;
  const [ownedDomains, registeredAddresses] = await Promise.all([
    listVerifiedDomains(fallbackOrgId, supabaseUrl, headers),
    listSenderAddresses(fallbackOrgId, supabaseUrl, headers),
  ]);
  return { orgId: fallbackOrgId, ownedDomains, registeredAddresses };
}

async function findConversationByThreading(
  inReplyTo: string | null,
  _references: string[],
  orgId: string,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<string | null> {
  const candidates = [inReplyTo, ..._references].filter((id): id is string => Boolean(id));

  for (const messageId of candidates) {
    try {
      const msgs = await supaFetch(
        supabaseUrl,
        `/rest/v1/inbox_messages?message_id=eq.${encodeURIComponent(messageId)}&org_id=eq.${orgId}&select=conversation_id&limit=1`,
        headers
      );
      if (msgs && msgs.length > 0) return msgs[0].conversation_id;
    } catch { /* continue */ }
  }

  return null;
}

async function resolveContactId(
  email: string,
  orgId: string,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<string | null> {
  try {
    // Search crm_records for contacts with matching email in field_values
    const rows = await supaFetch(
      supabaseUrl,
      `/rest/v1/crm_records?organization_id=eq.${orgId}&module_key=eq.Contacts&field_values->>email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      headers
    );
    if (rows && rows.length > 0) return rows[0].id;
  } catch { /* continue */ }

  // Also try Leads
  try {
    const rows = await supaFetch(
      supabaseUrl,
      `/rest/v1/crm_records?organization_id=eq.${orgId}&module_key=eq.Leads&field_values->>email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      headers
    );
    if (rows && rows.length > 0) return rows[0].id;
  } catch { /* continue */ }

  return null;
}

async function handleInboxMessage(
  emailData: EmailPayload,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<Response> {
  const from = parseEmailAddress(emailData.from);
  const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
  const toFirst = parseEmailAddress(toAddresses[0] || "");

  // Resolve org_id from the recipient domain
  const orgContext = await resolveOrgContext(toAddresses, supabaseUrl, headers);
  if (!orgContext) {
    console.error("Could not resolve org_id from to addresses:", toAddresses);
    return new Response(
      JSON.stringify({ success: false, error: "Could not resolve organization from recipient address" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const { orgId, ownedDomains, registeredAddresses } = orgContext;

  // Which shared mailbox owns this thread (billing@, enrollment@, support@, ...).
  // Forwarded mail arriving on a receiving subdomain collapses onto the
  // registered apex address so each role has exactly one queue.
  const mailboxAddress = resolveMailboxAddress(
    toAddresses,
    emailData.cc || [],
    ownedDomains,
    registeredAddresses
  );

  const hdrs = normaliseHeaders(emailData.headers);
  const messageId = hdrs["message-id"] || null;
  const inReplyTo = hdrs["in-reply-to"] || null;
  const references = (hdrs["references"] || "").split(/\s+/).filter(Boolean);

  // Try to find existing conversation by threading headers
  let conversationId = await findConversationByThreading(inReplyTo, references, orgId, supabaseUrl, headers);

  const ccParsed = (emailData.cc || []).map(parseEmailAddress).map(a => ({ email: a.email, name: a.name }));
  const bccParsed = (emailData.bcc || []).map(parseEmailAddress).map(a => ({ email: a.email, name: a.name }));
  const attachments = (emailData.attachments || []).map(a => ({
    filename: a.filename,
    content_type: a.content_type,
    size: a.size,
    url: a.url || null,
  }));

  const contactId = await resolveContactId(from.email, orgId, supabaseUrl, headers);
  const preview = generatePreview(emailData.body_text, emailData.body_html);
  const now = new Date().toISOString();

  if (conversationId) {
    // ---- Reply to existing conversation ----
    // Insert message
    const msgs = await supaFetch(supabaseUrl, "/rest/v1/inbox_messages", headers, {
      method: "POST",
      prefer: "return=representation",
      body: {
        org_id: orgId,
        conversation_id: conversationId,
        channel: "email",
        direction: "inbound",
        from_address: from.email,
        from_name: from.name,
        to_address: toFirst.email,
        to_name: toFirst.name,
        subject: emailData.subject || null,
        body_text: emailData.body_text || null,
        body_html: emailData.body_html || null,
        cc_addresses: ccParsed,
        bcc_addresses: bccParsed,
        reply_to_address: emailData.reply_to?.[0] || null,
        message_id: messageId,
        in_reply_to: inReplyTo,
        references_ids: references.length > 0 ? references : null,
        attachments,
        external_id: messageId,
        external_provider: "resend",
        status: "delivered",
        sent_at: now,
      },
    });

    // File pre-existing threads that predate shared-mailbox tagging. The
    // is.null filter makes this a no-op once a thread already has a mailbox,
    // so a reply can never move a thread between shared queues.
    if (mailboxAddress) {
      await supaFetch(
        supabaseUrl,
        `/rest/v1/inbox_conversations?id=eq.${conversationId}&mailbox_address=is.null`,
        headers,
        { method: "PATCH", body: { mailbox_address: mailboxAddress } }
      ).catch((e) => console.error("mailbox_address backfill on reply failed (non-blocking):", e));
    }

    // Counters, preview and last_message_at are owned by the
    // update_conversation_on_message trigger, which already fired on the insert
    // above. Incrementing them here as well is what made message_count read 2
    // for a single message. Only the re-open is ours to do: the trigger has no
    // opinion about a resolved thread coming back to life.
    await supaFetch(supabaseUrl, `/rest/v1/inbox_conversations?id=eq.${conversationId}`, headers, {
      method: "PATCH",
      body: { status: "open" },
    }).catch((e) => console.error("re-open on reply failed (non-blocking):", e));

    return new Response(
      JSON.stringify({ success: true, action: "reply_added", conversation_id: conversationId, message_id: msgs?.[0]?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ---- New conversation ----
  const threadId = messageId || `email-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const priority = determinePriority(emailData.subject, emailData.body_text);

  const convs = await supaFetch(supabaseUrl, "/rest/v1/inbox_conversations", headers, {
    method: "POST",
    prefer: "return=representation",
    body: {
      org_id: orgId,
      channel: "email",
      thread_id: threadId,
      subject: emailData.subject || "(No Subject)",
      preview,
      mailbox_address: mailboxAddress,
      contact_id: contactId,
      contact_email: from.email,
      contact_name: from.name || null,
      status: "open",
      priority,
      // Seeded at zero because the message insert below fires
      // update_conversation_on_message, which increments both. Seeding them at
      // 1 double-counted every first message.
      unread_count: 0,
      message_count: 0,
      last_message_at: now,
      first_message_at: now,
      tags: [],
      labels: [],
      metadata: {
        source: "email_intake",
        has_attachments: attachments.length > 0,
      },
    },
  });

  conversationId = convs[0].id;

  // Insert the message
  const msgs = await supaFetch(supabaseUrl, "/rest/v1/inbox_messages", headers, {
    method: "POST",
    prefer: "return=representation",
    body: {
      org_id: orgId,
      conversation_id: conversationId,
      channel: "email",
      direction: "inbound",
      from_address: from.email,
      from_name: from.name,
      to_address: toFirst.email,
      to_name: toFirst.name,
      subject: emailData.subject || null,
      body_text: emailData.body_text || null,
      body_html: emailData.body_html || null,
      cc_addresses: ccParsed,
      bcc_addresses: bccParsed,
      reply_to_address: emailData.reply_to?.[0] || null,
      message_id: messageId,
      in_reply_to: inReplyTo,
      references_ids: references.length > 0 ? references : null,
      attachments,
      external_id: messageId,
      external_provider: "resend",
      status: "delivered",
      sent_at: now,
    },
  });

  // Optional: send Slack notification
  const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (slackWebhookUrl) {
    try {
      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `New inbox email from ${from.name || from.email}: ${emailData.subject || "(No Subject)"}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*New Email*\n*From:* ${from.name ? `${from.name} <${from.email}>` : from.email}\n*Subject:* ${emailData.subject || "(No Subject)"}\n*Priority:* ${priority}`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Slack notification failed:", e);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      action: "conversation_created",
      conversation_id: conversationId,
      message_id: msgs?.[0]?.id,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Legacy ticket routing (kept for backward compat, gated by INTAKE_MODE)
// ---------------------------------------------------------------------------

async function checkIfReply(
  emailData: EmailPayload,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<{ isReply: boolean; ticketId?: string }> {
  const hdrs = normaliseHeaders(emailData.headers);
  const inReplyTo = hdrs["in-reply-to"];

  if (inReplyTo) {
    try {
      const tickets = await supaFetch(
        supabaseUrl,
        `/rest/v1/tickets?email_thread_id=eq.${encodeURIComponent(inReplyTo)}&select=id&limit=1`,
        headers
      );
      if (tickets && tickets.length > 0) return { isReply: true, ticketId: tickets[0].id };
    } catch { /* continue */ }
  }

  const ticketNumberMatch = emailData.subject.match(/[#\[]#?([a-f0-9]{8})[\]]?/i);
  if (ticketNumberMatch) {
    try {
      const result = await supaFetch(supabaseUrl, "/rest/v1/rpc/find_ticket_by_number", headers, {
        method: "POST",
        body: { ticket_number_prefix: ticketNumberMatch[1] },
      });
      if (result) return { isReply: true, ticketId: result };
    } catch { /* continue */ }
  }

  return { isReply: false };
}

async function handleEmailReply(
  emailData: EmailPayload,
  ticketId: string,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<Response> {
  const from = parseEmailAddress(emailData.from);
  let authorId: string | null = null;

  try {
    const profiles = await supaFetch(
      supabaseUrl,
      `/rest/v1/profiles?email=eq.${encodeURIComponent(from.email)}&select=id`,
      headers
    );
    if (profiles?.length > 0) authorId = profiles[0].id;
  } catch { /* continue */ }

  const cleanedBody = stripQuotedText(emailData.body_text);

  const comments = await supaFetch(supabaseUrl, "/rest/v1/ticket_comments", headers, {
    method: "POST",
    prefer: "return=representation",
    body: {
      ticket_id: ticketId,
      author_id: authorId,
      body: cleanedBody || emailData.body_text,
      is_internal: false,
      reply_to_message_id: emailData.headers?.["message-id"],
    },
  });

  await supaFetch(supabaseUrl, `/rest/v1/tickets?id=eq.${ticketId}`, headers, {
    method: "PATCH",
    body: { last_message_at: new Date().toISOString() },
  });

  return new Response(
    JSON.stringify({ success: true, action: "reply_added", ticket_id: ticketId, comment_id: comments[0].id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleNewTicket(
  emailData: EmailPayload,
  supabaseUrl: string,
  headers: SupaHeaders
): Promise<Response> {
  const from = parseEmailAddress(emailData.from);
  let requesterId: string | null = null;

  try {
    const profiles = await supaFetch(
      supabaseUrl,
      `/rest/v1/profiles?email=eq.${encodeURIComponent(from.email)}&select=id`,
      headers
    );
    if (profiles?.length > 0) requesterId = profiles[0].id;
  } catch { /* continue */ }

  const priority = determinePriority(emailData.subject, emailData.body_text);
  const hdrs = normaliseHeaders(emailData.headers);

  const ticketPayload: Record<string, unknown> = {
    requester_email: from.email,
    subject: emailData.subject || "(No Subject)",
    description: emailData.body_text || emailData.body_html || "",
    channel: "email",
    priority,
    status: "new",
    email_thread_id: hdrs["message-id"] || null,
  };
  if (requesterId) ticketPayload.requester_id = requesterId;

  const tickets = await supaFetch(supabaseUrl, "/rest/v1/tickets", headers, {
    method: "POST",
    prefer: "return=representation",
    body: ticketPayload,
  });
  const ticket = tickets[0];

  await supaFetch(supabaseUrl, "/rest/v1/ticket_events", headers, {
    method: "POST",
    body: {
      ticket_id: ticket.id,
      event_type: "created_from_email",
      payload: {
        from: emailData.from,
        to: emailData.to,
        message_id: hdrs["message-id"],
        has_attachments: (emailData.attachments?.length || 0) > 0,
      },
    },
  });

  if (emailData.attachments?.length) {
    for (const attachment of emailData.attachments) {
      await supaFetch(supabaseUrl, "/rest/v1/ticket_files", headers, {
        method: "POST",
        body: {
          ticket_id: ticket.id,
          filename: attachment.filename,
          storage_path: attachment.url || "",
          file_size: attachment.size,
          mime_type: attachment.content_type,
        },
      });
    }
  }

  const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (slackWebhookUrl) {
    try {
      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `New ticket from email: #${ticket.id.substring(0, 8)} - ${ticket.subject}`,
        }),
      });
    } catch { /* continue */ }
  }

  return new Response(
    JSON.stringify({ success: true, action: "ticket_created", ticket_id: ticket.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function stripQuotedText(body: string): string {
  const lines = body.split("\n");
  const cleanedLines: string[] = [];
  for (const line of lines) {
    if (
      line.trim().startsWith(">") ||
      (line.trim().startsWith("On ") && line.includes("wrote:")) ||
      line.includes("-----Original Message-----") ||
      line.includes("________________________________")
    ) break;
    cleanedLines.push(line);
  }
  return cleanedLines.join("\n").trim();
}

function determinePriority(subject: string, body: string): string {
  const text = `${subject} ${body}`.toLowerCase();
  if (text.includes("urgent") || text.includes("critical") || text.includes("down") || text.includes("outage") || text.includes("emergency")) return "urgent";
  if (text.includes("high priority") || text.includes("important") || text.includes("asap")) return "high";
  return "normal";
}

/** Normalise Resend inbound event to our EmailPayload format */
function normaliseResendInbound(event: ResendInboundEvent): EmailPayload {
  const d = event.data;
  const hdrs = normaliseHeaders(d.headers);
  return {
    from: d.from,
    to: d.to || [],
    cc: d.cc || [],
    bcc: d.bcc || [],
    subject: d.subject || "",
    body_text: d.text || "",
    body_html: d.html || undefined,
    reply_to: d.reply_to,
    headers: hdrs,
    attachments: d.attachments?.map(a => ({
      filename: a.filename,
      content_type: a.content_type,
      size: a.size,
      url: a.url,
    })),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!(await verifyAuth(req))) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseHeaders: SupaHeaders = {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };

    const rawBody = cachedRawBody ?? await req.text();
    cachedRawBody = null;
    const parsed = JSON.parse(rawBody);

    // Normalise: Resend inbound wraps data in { type: "email.received", data: { ... } }
    let emailData: EmailPayload;
    if (parsed.type === "email.received" && parsed.data) {
      emailData = normaliseResendInbound(parsed as ResendInboundEvent);
    } else if (parsed.data && parsed.data.from) {
      // Generic Resend event wrapper
      emailData = normaliseResendInbound(parsed as ResendInboundEvent);
    } else {
      emailData = parsed as EmailPayload;
    }

    // Resend's inbound webhook is metadata-only: no body, headers, or
    // attachments. Without this second call every thread lands with an empty
    // body. Best-effort by design — on failure we still file the message so
    // the mail is visible rather than silently dropped.
    const resendEmailId = parsed?.data?.email_id;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendEmailId && !emailData.body_text && !emailData.body_html) {
      if (resendApiKey) {
        const hydrated = await fetchReceivedEmail(resendEmailId, resendApiKey);
        if (hydrated) {
          emailData = mergeHydratedEmail(emailData, hydrated);
        } else {
          console.error(
            `Inbound ${resendEmailId} filed WITHOUT a body: hydration failed. Thread will show subject only.`,
          );
        }
      } else {
        console.error(
          "RESEND_API_KEY is not set; inbound bodies cannot be hydrated and will be empty.",
        );
      }
    }

    const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    const orgContext = await resolveOrgContext(toAddresses, supabaseUrl, supabaseHeaders);
    const closedLoop = await isClosedLoopEnabled(
      supabaseUrl,
      supabaseHeaders,
      orgContext?.orgId ?? null,
    );
    let ledgerId: string | null = null;
    if (closedLoop) {
      const hdrs = emailData.headers || {};
      const eventHash = await inboundEventHash({
        provider: "resend",
        eventId: parsed?.data?.email_id || parsed?.id,
        messageId: hdrs["message-id"],
        from: emailData.from,
        to: emailData.to,
      });
      const ledger = await ledgerInboundEvent(supabaseUrl, supabaseHeaders, {
        provider: "resend",
        eventHash,
        eventType: parsed?.type || "email.received",
        providerEventId: parsed?.data?.email_id || parsed?.id,
        organizationId: orgContext?.orgId ?? null,
        payload: { email_id: parsed?.data?.email_id ?? null, type: parsed?.type ?? null },
      });
      if (ledger.duplicate) {
        return new Response(
          JSON.stringify({ success: true, action: "ignored_duplicate", event_id: ledger.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      ledgerId = ledger.id;
      await markInboundEvent(supabaseUrl, supabaseHeaders, ledger.id, { status: "processing" });
    }

    const intakeMode = Deno.env.get("INTAKE_MODE") || "inbox";

    if (intakeMode === "inbox" || intakeMode === "both") {
      const response = await handleInboxMessage(emailData, supabaseUrl, supabaseHeaders);
      if (ledgerId) {
        try {
          const body = await response.clone().json();
          await markInboundEvent(supabaseUrl, supabaseHeaders, ledgerId, {
            status: "processed",
            processed_at: new Date().toISOString(),
            conversation_id: body?.conversation_id ?? null,
            organization_id: orgContext?.orgId ?? null,
          });
        } catch {
          await markInboundEvent(supabaseUrl, supabaseHeaders, ledgerId, {
            status: "processed",
            processed_at: new Date().toISOString(),
          });
        }
      }
      if (intakeMode === "both") {
        // Also create ticket (fire and forget)
        try {
          const isReply = await checkIfReply(emailData, supabaseUrl, supabaseHeaders);
          if (isReply.isReply && isReply.ticketId) {
            await handleEmailReply(emailData, isReply.ticketId, supabaseUrl, supabaseHeaders);
          } else {
            await handleNewTicket(emailData, supabaseUrl, supabaseHeaders);
          }
        } catch (e) {
          console.error("Ticket creation failed (non-blocking):", e);
        }
      }
      return response;
    }

    // Legacy ticket-only mode
    const isReply = await checkIfReply(emailData, supabaseUrl, supabaseHeaders);
    if (isReply.isReply && isReply.ticketId) {
      return await handleEmailReply(emailData, isReply.ticketId, supabaseUrl, supabaseHeaders);
    }
    return await handleNewTicket(emailData, supabaseUrl, supabaseHeaders);
  } catch (error) {
    console.error("Email intake error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
