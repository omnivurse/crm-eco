import { describe, expect, it } from 'vitest';
import { CRM_MEMBERS_HREF, MEMBER_ROSTER_HREF } from './nav-lexicon';

describe('nav lexicon', () => {
  it('keeps CRM Members and the admin roster on different paths', () => {
    expect(CRM_MEMBERS_HREF).toBe('/crm/modules/members');
    expect(MEMBER_ROSTER_HREF).toBe('/crm/members');
    expect(CRM_MEMBERS_HREF).not.toBe(MEMBER_ROSTER_HREF);
  });
});
