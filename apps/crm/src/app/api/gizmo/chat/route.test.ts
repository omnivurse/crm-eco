import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runGizmoTurn, stripDisallowedHrefs } from '@crm-eco/lib/gizmo';
import { CRM_HOWTO, CRM_PLACES } from '@crm-eco/lib/gizmo/catalogs/crm';
import { PALETTE_TABS } from '@/lib/crm/palette-pages';

describe('crm gizmo chat collect-time safety', () => {
  it('loads palette tabs without the client ModuleContext', () => {
    expect(Array.isArray(PALETTE_TABS)).toBe(true);
    expect(PALETTE_TABS[0]).toBe('crm');
    const route = readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
    expect(route).not.toMatch(/ModuleContext/);
  });
});

describe('crm gizmo chat fallback', () => {
  it('finds import how-to without an API key', () => {
    const turn = runGizmoTurn({
      app: 'crm',
      query: 'how do I import contacts',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(turn.refused).toBe(false);
    expect(turn.cards.some((c) => c.href.includes('/crm/learn/contacts/importing'))).toBe(true);
  });

  it('refuses member-portal billing and strips invented record hrefs', () => {
    const turn = runGizmoTurn({
      app: 'crm',
      query: 'pay my sharing bill',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(turn.refused).toBe(true);
    expect(turn.cards).toHaveLength(0);

    const leaked = stripDisallowedHrefs(
      'crm',
      'Try /billing or [x](/needs)',
      turn.allowedHrefs,
    );
    expect(leaked).not.toContain('/billing');
    expect(leaked).not.toContain('/needs');
  });
});
