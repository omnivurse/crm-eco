import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { applySponsorEligibilityEndings } from '../sponsor-service';

function queryBuilder(result: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'in', 'limit', 'maybeSingle']) {
    builder[method] =
      method === 'maybeSingle'
        ? vi.fn(() => Promise.resolve(result))
        : vi.fn(() => builder);
  }
  builder.then = vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject));
  return builder;
}

describe('applySponsorEligibilityEndings', () => {
  it('never resolves a missing sponsorship link from another sponsor membership', async () => {
    const sponsorships = queryBuilder({
      data: [
        {
          id: 'sponsorship-a',
          sponsor_id: 'sponsor-a',
          roster_id: 'roster-a',
          member_id: 'member-a',
          membership_id: null,
          enrollment_id: null,
          status: 'active',
          end_date: null,
          sponsor_roster: { id: 'roster-a', eligible_end: '2026-09-17', status: 'terminated' },
          memberships: null,
        },
      ],
      error: null,
    });
    const membership = queryBuilder({ data: null, error: null });
    const builders = [sponsorships, membership];
    const from = vi.fn(() => builders.shift()!);

    const result = await applySponsorEligibilityEndings(
      { from } as unknown as SupabaseClient,
      'org-a',
      '2026-09-18',
    );

    expect(result).toEqual({ ended: 0, skipped: 0 });
    expect(membership.eq).toHaveBeenCalledWith('sponsor_id', 'sponsor-a');
  });
});
