import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MEMBERSHIP_WEBHOOK_EVENTS = [
  'member.created',
  'membership.updated',
  'invoice.paid',
] as const;

export type MembershipWebhookEvent = (typeof MEMBERSHIP_WEBHOOK_EVENTS)[number];

export interface MembershipWebhookTarget {
  id: string;
  url?: string;
  secret?: string;
  events?: string[] | null;
  status?: string | null;
  timeout_ms?: number | null;
}

export function planMembershipWebhookDeliveries(
  webhooks: MembershipWebhookTarget[],
  eventType: MembershipWebhookEvent,
) {
  return webhooks.filter(
    (hook) => hook.status === 'active' && Array.isArray(hook.events) && hook.events.includes(eventType),
  );
}

export function signMembershipWebhook(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function isMembershipWebhookSendEnabled(): boolean {
  return process.env.PUBLIC_API_WEBHOOKS_ENABLED === 'true';
}

export async function emitMembershipWebhook(
  supabase: SupabaseClient,
  organizationId: string,
  eventType: MembershipWebhookEvent,
  payload: Record<string, unknown>,
): Promise<{ planned: number; delivered: number; dryRun: boolean }> {
  const { data: hooks } = await supabase
    .from('crm_webhooks')
    .select('id, url, secret, events, status, timeout_ms')
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  const targets = planMembershipWebhookDeliveries(hooks ?? [], eventType);
  const dryRun = !isMembershipWebhookSendEnabled();
  if (dryRun || targets.length === 0) {
    return { planned: targets.length, delivered: 0, dryRun };
  }

  let delivered = 0;
  const body = JSON.stringify({
    event: eventType,
    organization_id: organizationId,
    data: payload,
    created_at: new Date().toISOString(),
  });

  for (const hook of targets) {
    if (!hook.url) continue;
    const signature = signMembershipWebhook(hook.secret || '', body);
    const started = Date.now();
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-crm-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(hook.timeout_ms ?? 10000),
      });
      await supabase.from('crm_webhook_deliveries').insert({
        organization_id: organizationId,
        webhook_id: hook.id,
        event_type: eventType,
        request_url: hook.url,
        request_body: JSON.parse(body),
        response_status: res.status,
        status: res.ok ? 'success' : 'failed',
        duration_ms: Date.now() - started,
      });
      if (res.ok) delivered += 1;
    } catch (err) {
      await supabase.from('crm_webhook_deliveries').insert({
        organization_id: organizationId,
        webhook_id: hook.id,
        event_type: eventType,
        request_url: hook.url,
        request_body: JSON.parse(body),
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'delivery failed',
        duration_ms: Date.now() - started,
      });
    }
  }

  return { planned: targets.length, delivered, dryRun: false };
}
