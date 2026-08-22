import { describe, expect, it } from 'vitest';
import { campaignTrackingId, injectCampaignTracking } from './campaign-tracking';

describe('campaign tracking', () => {
  it('injects an open pixel and rewrites http(s) links', () => {
    const html = '<p><a href="https://example.com/a">A</a></p>';
    const out = injectCampaignTracking(html, 'https://crm.example.com', campaignTrackingId('c1', 'r1'));
    expect(out).toContain('/api/tracking/open/c1_r1');
    expect(out).toContain('/api/tracking/click/c1_r1?url=https%3A%2F%2Fexample.com%2Fa');
    expect(out).not.toContain('href="https://example.com/a"');
  });
});
