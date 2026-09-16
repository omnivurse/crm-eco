import { describe, expect, it } from 'vitest';
import { runGizmoTurn } from '@crm-eco/lib/gizmo';
import { ADMIN_HOWTO, ADMIN_PLACES } from '@crm-eco/lib/gizmo/catalogs/admin';

describe('admin gizmo isolation', () => {
  it('finds commission rates and refuses CRM workqueue', () => {
    const hit = runGizmoTurn({
      app: 'admin',
      query: 'commission rates',
      places: ADMIN_PLACES,
      howto: ADMIN_HOWTO,
    });
    expect(hit.cards.some((c) => c.href === '/commissions/rates')).toBe(true);
    expect(hit.cards.every((c) => !c.href.startsWith('/crm'))).toBe(true);

    const refuse = runGizmoTurn({
      app: 'admin',
      query: 'CRM workqueue',
      places: ADMIN_PLACES,
      howto: ADMIN_HOWTO,
    });
    expect(refuse.refused).toBe(true);
    expect(refuse.cards).toHaveLength(0);
  });
});
