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
