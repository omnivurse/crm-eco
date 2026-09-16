import { describe, expect, it } from 'vitest';
import {
  ADMIN_HOWTO,
  ADMIN_PLACES,
  CRM_HOWTO,
  CRM_PLACES,
  MEMBER_PORTAL_HOWTO,
  MEMBER_PORTAL_PLACES,
} from './catalogs';
import { hrefAllowed, sanitizeRecordHits } from './href-guard';
import { runGizmoTurn } from './run-turn';

describe('gizmo verification matrix', () => {
  it('CRM: import how-to, reports place, refuse portal billing, miss has no href', () => {
    const howto = runGizmoTurn({
      app: 'crm',
      query: 'how do I import contacts',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(howto.cards.some((c) => c.href === '/crm/learn/contacts/importing')).toBe(true);

    const reports = runGizmoTurn({
      app: 'crm',
      query: 'where is reports',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [{ title: 'Reports Person', href: '/crm/r/leak', module: 'contacts' }],
    });
    expect(reports.cards[0]?.href).toBe('/crm/reports');
    expect(reports.cards.some((c) => c.kind === 'record')).toBe(false);

    const refuse = runGizmoTurn({
      app: 'crm',
      query: 'pay my sharing bill',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(refuse.refused).toBe(true);
    expect(refuse.cards).toHaveLength(0);

    const miss = runGizmoTurn({
      app: 'crm',
      query: 'zzz-not-a-real-page',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(miss.allowedHrefs).toHaveLength(0);
  });

  it('Admin: commission rates; refuse CRM workqueue', () => {
    const rates = runGizmoTurn({
      app: 'admin',
      query: 'commission rates',
      places: ADMIN_PLACES,
      howto: ADMIN_HOWTO,
    });
    expect(rates.cards.some((c) => c.href === '/commissions/rates')).toBe(true);

    const refuse = runGizmoTurn({
      app: 'admin',
      query: 'CRM workqueue',
      places: ADMIN_PLACES,
      howto: ADMIN_HOWTO,
    });
    expect(refuse.refused).toBe(true);
    expect(refuse.cards).toHaveLength(0);
  });

  it('Member: own pages only; pipeline / Jane Doe leak zero CRM hrefs', () => {
    const coverage = runGizmoTurn({
      app: 'member_portal',
      query: 'where is my coverage',
      places: MEMBER_PORTAL_PLACES,
      howto: MEMBER_PORTAL_HOWTO,
    });
    expect(coverage.cards.every((c) => hrefAllowed('member_portal', c.href))).toBe(true);
    expect(coverage.cards.some((c) => c.href === '/coverage')).toBe(true);

    for (const q of ['show pipeline', 'find Jane Doe']) {
      const turn = runGizmoTurn({
        app: 'member_portal',
        query: q,
        places: MEMBER_PORTAL_PLACES,
        howto: MEMBER_PORTAL_HOWTO,
        records: [{ title: 'Jane', href: '/crm/r/leak', module: 'contacts' }],
      });
      expect(turn.refused).toBe(true);
      expect(turn.cards).toHaveLength(0);
      expect(turn.allowedHrefs).toHaveLength(0);
    }
  });

  it('other-tenant / leaked record hrefs are dropped', () => {
    expect(
      sanitizeRecordHits('crm', [{ title: 'X', href: '/members/1', module: 'members' }]),
    ).toHaveLength(0);
    expect(
      sanitizeRecordHits('admin', [
        { title: 'X', href: '/crm/r/1', module: 'contacts' },
      ]),
    ).toHaveLength(0);
    expect(hrefAllowed('admin', '/commissions/rates')).toBe(true);
    expect(hrefAllowed('member_portal', '/crm/modules/contacts')).toBe(false);
  });
});
