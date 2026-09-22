import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { loadPublicEnrollmentPlan } from '../submitPublicEnrollment';

function planLookupClient(result: {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);

  const from = vi.fn(() => builder);
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    builder,
  };
}

describe('loadPublicEnrollmentPlan', () => {
  it('scopes active plan lookup to the signed draft organization', async () => {
    const plan = {
      id: 'plan-1',
      name: 'Core Plan',
      code: 'CORE',
      monthly_share: 199,
    };
    const { client, from, builder } = planLookupClient({ data: plan, error: null });

    await expect(loadPublicEnrollmentPlan(client, 'org-1', 'plan-1')).resolves.toEqual({ plan });
    expect(from).toHaveBeenCalledWith('plans');
    expect(builder.eq.mock.calls).toEqual([
      ['id', 'plan-1'],
      ['organization_id', 'org-1'],
      ['is_active', true],
    ]);
  });

  it('rejects missing, foreign-tenant, and inactive plans before writes', async () => {
    const { client } = planLookupClient({ data: null, error: null });

    await expect(loadPublicEnrollmentPlan(client, 'org-1', 'foreign-plan')).resolves.toEqual({
      error: 'invalid_selected_plan',
      status: 400,
    });
  });

  it('fails closed when plan validation cannot reach the database', async () => {
    const { client } = planLookupClient({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(loadPublicEnrollmentPlan(client, 'org-1', 'plan-1')).resolves.toEqual({
      error: 'plan_lookup_failed',
      message: 'database unavailable',
      status: 500,
    });
  });
});
