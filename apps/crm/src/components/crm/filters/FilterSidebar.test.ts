/**
 * Road to Ten LS-9 (decision D11): the Zoho-leftover related-module filter
 * groups collapse behind "Show all" — but only for orgs with the
 * `crm.lists.trim_surface` flag on. Flag off must be byte-identical.
 */
import { describe, expect, it } from 'vitest';
import { visibleRelatedModules } from './FilterSidebar';

const NONE: ReadonlySet<string> = new Set();
const keys = (rows: { key: string }[]) => rows.map((r) => r.key);

describe('visibleRelatedModules (LS-9)', () => {
  it('flag off: every module, in catalogue order, whatever "Show all" says', () => {
    const off = visibleRelatedModules(false, false, NONE);
    expect(keys(off)).toEqual(keys(visibleRelatedModules(false, true, NONE)));
    expect(keys(off)).toContain('campaigns');
    expect(keys(off)).toContain('invoices');
    expect(keys(off)).toContain('solutions');
    expect(keys(off)).toContain('cirrusmd_contacts');
    expect(keys(off)).toContain('planstin_contacts');
  });

  it('flag on: the Zoho leftovers are hidden, the desk modules stay', () => {
    const on = keys(visibleRelatedModules(true, false, NONE));
    for (const gone of ['campaigns', 'invoices', 'solutions', 'cirrusmd_contacts', 'planstin_contacts', 'producers', 'pricing_matrix']) {
      expect(on).not.toContain(gone);
    }
    for (const kept of ['activities', 'calls', 'emails', 'meetings', 'tasks', 'notes', 'accounts', 'contacts', 'leads', 'aca_clients']) {
      expect(on).toContain(kept);
    }
    expect(on.length).toBeLessThan(keys(visibleRelatedModules(false, false, NONE)).length);
  });

  it('flag on + "Show all": hidden, not removed — the full catalogue comes back', () => {
    expect(keys(visibleRelatedModules(true, true, NONE))).toEqual(
      keys(visibleRelatedModules(false, false, NONE)),
    );
  });

  it('an already-filtered leftover is never hidden', () => {
    const on = keys(visibleRelatedModules(true, false, new Set(['invoices'])));
    expect(on).toContain('invoices');
    expect(on).not.toContain('campaigns');
  });

  it('preserves catalogue order (never re-sorts the rail)', () => {
    const all = keys(visibleRelatedModules(false, false, NONE));
    const trimmed = keys(visibleRelatedModules(true, false, NONE));
    expect(trimmed).toEqual(all.filter((k) => trimmed.includes(k)));
  });

  it('does not mutate the shared catalogue', () => {
    const before = keys(visibleRelatedModules(false, false, NONE));
    visibleRelatedModules(false, false, NONE).pop();
    expect(keys(visibleRelatedModules(false, false, NONE))).toEqual(before);
  });
});

/**
 * CLOSE-1: the flag is now wired (page.tsx → ModuleListClient → ModuleShell →
 * FilterSidebar), so the row counts below are the numbers the recorded walk
 * screenshots show — 27 related-module rows with the flag off, 10 with it on.
 */
describe('visibleRelatedModules — wired row counts (CLOSE-1)', () => {
  it('flag off renders the full 27-row catalogue (byte-identical to pre-LS-9)', () => {
    expect(visibleRelatedModules(false, false, NONE)).toHaveLength(27);
  });

  it('flag on renders 10 rows, and "Show all" brings all 27 back', () => {
    expect(visibleRelatedModules(true, false, NONE)).toHaveLength(10);
    expect(visibleRelatedModules(true, true, NONE)).toHaveLength(27);
  });

  it('the default prop value (false) is the untrimmed surface', () => {
    // FilterSidebar declares `trimSurface = false`, and page.tsx falls back to
    // false when the flag table errors — both land here.
    expect(keys(visibleRelatedModules(false, false, NONE))).toEqual(
      keys(visibleRelatedModules(false, true, NONE)),
    );
  });
});
