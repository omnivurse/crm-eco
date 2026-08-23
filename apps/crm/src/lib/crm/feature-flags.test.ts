/**
 * Road to Ten FB-4 (decision D8): the V1 record shell and its per-user
 * `crm_layout_v2` opt-in are retired. The resolver must ignore
 * `profiles.ui_preferences` and only consult org / global rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { organization_id: string | null; enabled: boolean };
let rows: Row[] = [];
let dbError: { message: string } | null = null;

vi.mock('./queries', () => ({
  createCrmClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          or: async () => ({ data: rows, error: dbError }),
        }),
      }),
    }),
  }),
}));

import { isLayoutV2Enabled, isListSurfaceTrimEnabled, resolveCrmFeatureFlag } from './feature-flags';

const ORG = '00000000-0000-0000-0000-000000000001';

describe('resolveCrmFeatureFlag (FB-4: no per-user override)', () => {
  beforeEach(() => {
    rows = [];
    dbError = null;
  });

  it('ignores ui_preferences.crm_layout_v2 and reads the org row', async () => {
    rows = [{ organization_id: ORG, enabled: false }];
    const flag = await resolveCrmFeatureFlag(
      'crm.layout.v2',
      { organization_id: ORG, ui_preferences: { crm_layout_v2: true } },
      false,
    );
    expect(flag).toEqual({ enabled: false, source: 'org' });
  });

  it('falls through org → global → fallback', async () => {
    rows = [{ organization_id: null, enabled: true }];
    expect(
      await resolveCrmFeatureFlag('crm.layout.v2', { organization_id: ORG, ui_preferences: null }, false),
    ).toEqual({ enabled: true, source: 'global' });

    rows = [];
    expect(
      await resolveCrmFeatureFlag('crm.layout.v2', { organization_id: ORG, ui_preferences: null }, true),
    ).toEqual({ enabled: true, source: 'fallback' });
  });

  it('never reports a "user" source even when the preference is set', async () => {
    rows = [];
    const flag = await resolveCrmFeatureFlag(
      'crm.layout.v2',
      { organization_id: ORG, ui_preferences: { crm_layout_v2: true } },
      false,
    );
    expect(flag.source).not.toBe('user');
    expect(flag).toEqual({ enabled: false, source: 'fallback' });
  });

  it('DB errors fall back closed to the fallback arg', async () => {
    dbError = { message: 'boom' };
    expect(await isLayoutV2Enabled({ organization_id: ORG, ui_preferences: { crm_layout_v2: true } })).toBe(false);
  });
});

describe('isListSurfaceTrimEnabled (LS-9 / decision D11)', () => {
  beforeEach(() => {
    rows = [];
    dbError = null;
  });

  it('defaults to false with no row — orgs keep the full list surface', async () => {
    expect(await isListSurfaceTrimEnabled({ organization_id: ORG, ui_preferences: null })).toBe(false);
  });

  it('an org row turns the trim on', async () => {
    rows = [{ organization_id: ORG, enabled: true }];
    expect(await isListSurfaceTrimEnabled({ organization_id: ORG, ui_preferences: null })).toBe(true);
  });

  it('an org row wins over a global one', async () => {
    rows = [
      { organization_id: null, enabled: true },
      { organization_id: ORG, enabled: false },
    ];
    expect(await isListSurfaceTrimEnabled({ organization_id: ORG, ui_preferences: null })).toBe(false);
  });

  it('DB errors fall back to the untrimmed surface', async () => {
    dbError = { message: 'boom' };
    expect(await isListSurfaceTrimEnabled({ organization_id: ORG, ui_preferences: null })).toBe(false);
  });
});
