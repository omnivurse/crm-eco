import { describe, expect, it } from 'vitest';
import { planMembershipWebhookDeliveries, signMembershipWebhook } from './membership-webhooks';

describe('membership webhooks', () => {
  it('selects only active subscriptions for the event', () => {
    const targets = planMembershipWebhookDeliveries(
      [
        { id: '1', status: 'active', events: ['invoice.paid'] },
        { id: '2', status: 'disabled', events: ['invoice.paid'] },
        { id: '3', status: 'active', events: ['member.created'] },
      ],
      'invoice.paid',
    );
    expect(targets.map((hook) => hook.id)).toEqual(['1']);
  });

  it('signs the body with HMAC-SHA256', () => {
    expect(signMembershipWebhook('whsec_test', '{"ok":true}')).toHaveLength(64);
  });
});
