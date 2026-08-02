import { describe, expect, it, vi } from 'vitest';
import { applyDueMembershipActivation, listDuePendingMemberships } from './billing-membership-activation';

function mockQuery(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.in = vi.fn(self);
  chain.update = vi.fn(self);
  // Terminal
  chain.then = undefined;
  // Make awaitable by returning a thenable from the last method that resolves
  const terminal = Promise.resolve(result);
  for (const key of ['select', 'eq', 'lte', 'in', 'update']) {
    (chain[key] as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // Keep chaining; attach then to the chain object for await
      Object.assign(chain, {
        then: terminal.then.bind(terminal),
        catch: terminal.catch.bind(terminal),
      });
      return chain;
    });
  }
  return chain;
}

describe('listDuePendingMemberships', () => {
  it('returns due rows for pending memberships with effective_date <= today', async () => {
    const due = [
      { id: 'm1', member_id: 'mem1', organization_id: 'o1', effective_date: '2026-08-01' },
    ];
    const from = vi.fn(() => mockQuery({ data: due, error: null }));
    const supabase = { from } as unknown as Parameters<typeof listDuePendingMemberships>[0];

    const result = await listDuePendingMemberships(supabase, '2026-08-01');
    expect(result.error).toBeUndefined();
    expect(result.due).toEqual(due);
    expect(from).toHaveBeenCalledWith('memberships');
  });

  it('surfaces query errors', async () => {
    const from = vi.fn(() => mockQuery({ data: null, error: { message: 'boom' } }));
    const supabase = { from } as unknown as Parameters<typeof listDuePendingMemberships>[0];
    const result = await listDuePendingMemberships(supabase, '2026-08-01');
    expect(result.error).toBe('boom');
    expect(result.due).toEqual([]);
  });
});

describe('applyDueMembershipActivation', () => {
  it('dry_run counts without updating', async () => {
    const due = [
      { id: 'm1', member_id: 'mem1', organization_id: 'o1', effective_date: '2026-08-01' },
      { id: 'm2', member_id: 'mem1', organization_id: 'o1', effective_date: '2026-08-01' },
    ];
    const from = vi.fn(() => mockQuery({ data: due, error: null }));
    const supabase = { from } as unknown as Parameters<typeof applyDueMembershipActivation>[0];

    const result = await applyDueMembershipActivation(supabase, '2026-08-01', { dryRun: true });
    expect(result.dry_run).toBe(true);
    expect(result.memberships_to_activate).toBe(2);
    expect(result.members_to_activate).toBe(1);
    expect(result.memberships_activated).toBe(0);
    expect(result.members_activated).toBe(0);
  });
});
