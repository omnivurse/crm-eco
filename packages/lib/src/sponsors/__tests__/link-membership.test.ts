import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { linkSponsorshipToMembership } from '../linkMembership';

function queryBuilder(result: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'in', 'update']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject));
  return builder;
}

describe('linkSponsorshipToMembership', () => {
  it('does not fall back across every sponsorship for a bare member id', async () => {
    const byEnrollment = queryBuilder({ data: [], error: null });
    const from = vi.fn(() => byEnrollment);

    const result = await linkSponsorshipToMembership(
      { from } as unknown as SupabaseClient,
      {
        organizationId: 'org-a',
        enrollmentId: 'enrollment-a',
        membershipId: 'membership-a',
        memberId: 'member-a',
      },
    );

    expect(result).toEqual({ linked: 0, sponsorId: null });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('scopes the member fallback to the exact sponsor', async () => {
    const byEnrollment = queryBuilder({ data: [], error: null });
    const byMember = queryBuilder({
      data: [{ id: 'sponsorship-a', sponsor_id: 'sponsor-a', status: 'pending' }],
      error: null,
    });
    const updateSponsorship = queryBuilder({ data: null, error: null });
    const updateMembership = queryBuilder({ data: null, error: null });
    const builders = [byEnrollment, byMember, updateSponsorship, updateMembership];
    const from = vi.fn(() => builders.shift()!);

    const result = await linkSponsorshipToMembership(
      { from } as unknown as SupabaseClient,
      {
        organizationId: 'org-a',
        enrollmentId: 'enrollment-a',
        membershipId: 'membership-a',
        memberId: 'member-a',
        sponsorId: 'sponsor-a',
      },
    );

    expect(result).toEqual({ linked: 1, sponsorId: 'sponsor-a' });
    expect(byMember.eq).toHaveBeenCalledWith('sponsor_id', 'sponsor-a');
  });
});
