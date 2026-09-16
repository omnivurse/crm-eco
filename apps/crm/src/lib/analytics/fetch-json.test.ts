import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalyticsJson } from './fetch-json';

describe('fetchAnalyticsJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns session result on 401 so the UI can send the user to login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
    );

    const result = await fetchAnalyticsJson('/api/analytics/churn', '/crm/analytics?tab=churn');

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'session') throw new Error('expected session miss');
    expect(result.href).toBe('/crm-login?redirect=%2Fcrm%2Fanalytics%3Ftab%3Dchurn');
    expect(result.title).toMatch(/session expired/i);
  });

  it('returns error on 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })),
    );

    const result = await fetchAnalyticsJson('/api/analytics/churn', '/crm/analytics?tab=churn');
    expect(result).toEqual({ ok: false, reason: 'error' });
  });

  it('returns JSON on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ summary: { totalMembers: 4 } }), { status: 200 })),
    );

    const result = await fetchAnalyticsJson<{ summary: { totalMembers: number } }>(
      '/api/analytics/churn',
      '/crm/analytics?tab=churn',
    );
    expect(result).toEqual({ ok: true, data: { summary: { totalMembers: 4 } } });
  });
});
