import { describe, expect, it } from 'vitest';
import { isGizmoResetQuery } from '@crm-eco/ui/lib/gizmo-reset';

describe('isGizmoResetQuery', () => {
  it('treats clear / new search as a fresh start', () => {
    expect(isGizmoResetQuery('clear')).toBe(true);
    expect(isGizmoResetQuery('Clear!')).toBe(true);
    expect(isGizmoResetQuery('please clear chat')).toBe(true);
    expect(isGizmoResetQuery('new search')).toBe(true);
    expect(isGizmoResetQuery('start over')).toBe(true);
    expect(isGizmoResetQuery('can you start a new search')).toBe(true);
  });

  it('does not steal a real find', () => {
    expect(isGizmoResetQuery('new search wendy hall')).toBe(false);
    expect(isGizmoResetQuery('clearwater members')).toBe(false);
    expect(isGizmoResetQuery('find reports')).toBe(false);
  });
});
