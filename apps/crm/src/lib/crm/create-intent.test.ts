import { describe, expect, it } from 'vitest';
import { resolveCreateIntent } from './create-intent';

describe('resolveCreateIntent', () => {
  it('opens the contact drawer for contacts and members', () => {
    expect(resolveCreateIntent({ moduleKey: 'contacts' })).toEqual({
      kind: 'quick',
      moduleKey: 'contacts',
    });
    expect(resolveCreateIntent({ moduleKey: 'members' })).toEqual({
      kind: 'quick',
      moduleKey: 'contacts',
    });
  });

  it('opens the lead drawer for leads', () => {
    expect(resolveCreateIntent({ moduleKey: 'leads' })).toEqual({
      kind: 'quick',
      moduleKey: 'leads',
    });
  });

  it('blocks deal create when deals are disabled', () => {
    expect(resolveCreateIntent({ moduleKey: 'deals', dealsEnabled: false })).toEqual({
      kind: 'blocked',
      reason: 'deals-disabled',
    });
  });

  it('allows the full deal form when deals are enabled', () => {
    expect(resolveCreateIntent({ moduleKey: 'deals', dealsEnabled: true })).toEqual({
      kind: 'full',
      href: '/crm/modules/deals/new',
    });
  });

  it('sends unknown modules to the full form', () => {
    expect(resolveCreateIntent({ moduleKey: 'tasks' })).toEqual({
      kind: 'full',
      href: '/crm/modules/tasks/new',
    });
  });
});
