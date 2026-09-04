export async function inboundEventHash(input: {
  provider: string;
  eventId?: string | null;
  messageId?: string | null;
  from?: string | null;
  to?: string | string[] | null;
}): Promise<string> {
  const to = Array.isArray(input.to) ? input.to.join(",") : input.to ?? "";
  const material = [input.provider, input.eventId ?? "", input.messageId ?? "", input.from ?? "", to].join("\u001f");
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type SupaHeaders = Record<string, string>;

async function rest<T>(
  supabaseUrl: string,
  path: string,
  headers: SupaHeaders,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<T> {
  const res = await fetch(`${supabaseUrl}${path}`, {
    method: init?.method || "GET",
    headers: {
      ...headers,
      ...(init?.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `REST ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function isClosedLoopEnabled(
  supabaseUrl: string,
  headers: SupaHeaders,
  orgId?: string | null,
): Promise<boolean> {
  const filter = orgId
    ? `flag_key=eq.crm.comms.closed_loop&or=(organization_id.eq.${orgId},organization_id.is.null)`
    : "flag_key=eq.crm.comms.closed_loop&organization_id=is.null";
  try {
    const rows = await rest<Array<{ organization_id: string | null; enabled: boolean }>>(
      supabaseUrl,
      `/rest/v1/crm_feature_flags?${filter}&select=organization_id,enabled`,
      headers,
    );
    const orgRow = orgId ? rows.find((r) => r.organization_id === orgId) : undefined;
    if (orgRow) return orgRow.enabled;
    return rows.find((r) => r.organization_id === null)?.enabled ?? false;
  } catch {
    return false;
  }
}

export async function ledgerInboundEvent(
  supabaseUrl: string,
  headers: SupaHeaders,
  input: {
    provider: string;
    eventHash: string;
    eventType: string;
    providerEventId?: string | null;
    organizationId?: string | null;
    payload: Record<string, unknown>;
  },
): Promise<{ id: string; duplicate: boolean }> {
  try {
    const rows = await rest<Array<{ id: string }>>(
      supabaseUrl,
      "/rest/v1/provider_inbound_events",
      headers,
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          provider: input.provider,
          event_hash: input.eventHash,
          event_type: input.eventType,
          provider_event_id: input.providerEventId ?? null,
          organization_id: input.organizationId ?? null,
          org_id: input.organizationId ?? null,
          signature_valid: true,
          payload: input.payload,
          status: "received",
        },
      },
    );
    if (rows?.[0]?.id) return { id: rows[0].id, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("23505") && !message.toLowerCase().includes("duplicate") && !message.toLowerCase().includes("unique")) {
      throw error;
    }
  }

  const existing = await rest<Array<{ id: string }>>(
    supabaseUrl,
    `/rest/v1/provider_inbound_events?provider=eq.${encodeURIComponent(input.provider)}&event_hash=eq.${encodeURIComponent(input.eventHash)}&select=id&limit=1`,
    headers,
  );
  if (!existing?.[0]?.id) {
    throw new Error("Inbound event conflict and existing row missing");
  }
  return { id: existing[0].id, duplicate: true };
}

/**
 * Park an inbound message that could not be attributed to an org.
 *
 * The ledger is keyed by org and gated on a per-org flag, so a message we
 * cannot attribute skips it entirely and leaves no trace at all — which is how
 * two signature requests went missing for two days. The Resend email id is
 * recorded because it is the only handle that makes the message replayable
 * once the routing cause is fixed.
 *
 * Never throws: failing to record a failure must not also fail the response.
 */
export async function deadLetterInbound(
  supabaseUrl: string,
  headers: SupaHeaders,
  input: {
    source: string;
    errorCategory: string;
    error: string;
    payload: Record<string, unknown>;
    /** Both tenant columns are written together; a CHECK requires they match. */
    organizationId?: string | null;
    correlationId?: string | null;
  },
): Promise<boolean> {
  try {
    await rest(supabaseUrl, "/rest/v1/comms_dead_letters", headers, {
      method: "POST",
      body: {
        source: input.source,
        error_category: input.errorCategory,
        error: input.error,
        payload: input.payload,
        organization_id: input.organizationId ?? null,
        org_id: input.organizationId ?? null,
        correlation_id: input.correlationId ?? null,
      },
    });
    await notifyDeadLetter(supabaseUrl, headers, input);
    return true;
  } catch (error) {
    console.error(
      "dead-letter insert failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Tell someone a message was parked, instead of waiting for a human to think to
 * go looking.
 *
 * Targets `profiles.is_super_admin` rather than a role list. An unroutable
 * message has no organization, so there is no tenant audience to notify — and
 * the role-based precedent elsewhere in the codebase filters on
 * role IN ('admin','super_admin'), which matches no account in this deployment
 * and would silently notify nobody.
 *
 * organization_id is left null on purpose: the alert is platform-level, because
 * the failure is that we could not determine the tenant.
 *
 * Best-effort. A notification that cannot be delivered must never turn a parked
 * message into a lost one, so failures are logged and swallowed.
 */
async function notifyDeadLetter(
  supabaseUrl: string,
  headers: SupaHeaders,
  input: { source: string; errorCategory: string; error: string },
): Promise<void> {
  try {
    const admins = await rest<Array<{ user_id: string }>>(
      supabaseUrl,
      "/rest/v1/profiles?is_super_admin=is.true&select=user_id",
      headers,
    );
    if (!admins?.length) {
      console.error(
        "dead-letter recorded but no super-admin exists to notify:",
        input.errorCategory,
      );
      return;
    }

    await rest(supabaseUrl, "/rest/v1/admin_notifications", headers, {
      method: "POST",
      body: admins.map((admin) => ({
        user_id: admin.user_id,
        organization_id: null,
        type: "comms_dead_letter",
        title: "Inbound message could not be delivered",
        message:
          `${input.source} parked a message (${input.errorCategory}). ${input.error}`,
        meta: { source: input.source, error_category: input.errorCategory },
      })),
    });
  } catch (error) {
    console.error(
      "dead-letter notification failed (message is still parked):",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function markInboundEvent(
  supabaseUrl: string,
  headers: SupaHeaders,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await rest(
    supabaseUrl,
    `/rest/v1/provider_inbound_events?id=eq.${id}`,
    headers,
    { method: "PATCH", body: patch },
  );
}
