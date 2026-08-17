import { describe, expect, it } from 'vitest';
import {
  ORG_CHROME_TTL_MS,
  invalidateOrgChromeEntry,
  readOrgChromeEntry,
  writeOrgChromeEntry,
  type OrgChrome,
  type OrgChromeEntry,
} from './org-chrome-cache-store';

const ORG_A = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-000000000002';

function chrome(modules: OrgChrome['modules']): OrgChrome {
  return { modules, fieldCounts: {}, navProfile: 'full' };
}

describe('org chrome cache', () => {
  it('returns a live entry for the same org and misses after TTL', () => {
    const store = new Map<string, OrgChromeEntry>();
    const now = 1_000_000;
    const value = chrome([
      {
        id: 'm1',
        org_id: ORG_A,
        key: 'contacts',
        name: 'Contact',
        name_plural: 'Contacts',
        icon: 'user',
        description: null,
        is_system: true,
        is_enabled: true,
        display_order: 1,
        settings: {},
        created_at: '',
        updated_at: '',
      },
    ]);

    writeOrgChromeEntry(store, ORG_A, value, now);
    expect(readOrgChromeEntry(store, ORG_A, now + 1)).toEqual(value);
    expect(readOrgChromeEntry(store, ORG_B, now + 1)).toBeNull();
    expect(readOrgChromeEntry(store, ORG_A, now + ORG_CHROME_TTL_MS + 1)).toBeNull();
  });

  it('never stores an empty module list', () => {
    const store = new Map<string, OrgChromeEntry>();
    writeOrgChromeEntry(store, ORG_A, chrome([]), 1_000);
    expect(readOrgChromeEntry(store, ORG_A, 1_001)).toBeNull();
  });

  it('invalidate drops only that org', () => {
    const store = new Map<string, OrgChromeEntry>();
    const now = 1_000;
    const a = chrome([
      {
        id: 'm1',
        org_id: ORG_A,
        key: 'contacts',
        name: 'Contact',
        name_plural: 'Contacts',
        icon: 'user',
        description: null,
        is_system: true,
        is_enabled: true,
        display_order: 1,
        settings: {},
        created_at: '',
        updated_at: '',
      },
    ]);
    const b = { ...a, modules: [{ ...a.modules[0], id: 'm2', org_id: ORG_B }] };
    writeOrgChromeEntry(store, ORG_A, a, now);
    writeOrgChromeEntry(store, ORG_B, b, now);
    invalidateOrgChromeEntry(store, ORG_A);
    expect(readOrgChromeEntry(store, ORG_A, now + 1)).toBeNull();
    expect(readOrgChromeEntry(store, ORG_B, now + 1)).toEqual(b);
  });
});
