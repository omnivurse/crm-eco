import { describe, expect, it } from 'vitest';
import { MEMBER_PORTAL_HOWTO, MEMBER_PORTAL_PLACES } from './catalogs';
import { hrefAllowed } from './href-guard';
import { runGizmoTurn } from './run-turn';

describe('member Gizmo never leaks CRM', () => {
  it('catalog hrefs stay in the portal', () => {
    for (const p of MEMBER_PORTAL_PLACES) {
      expect(hrefAllowed('member_portal', p.href)).toBe(true);
      expect(p.href.startsWith('/crm')).toBe(false);
    }
    for (const h of MEMBER_PORTAL_HOWTO) {
      expect(hrefAllowed('member_portal', h.href)).toBe(true);
      expect(h.href.startsWith('/crm')).toBe(false);
    }
  });

  it('pipeline / Jane Doe / another member return refuse and zero CRM hrefs', () => {
    for (const q of ['show pipeline', 'find Jane Doe', 'another member', 'contacts pipeline']) {
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
      expect(turn.reply).not.toContain('/crm');
      expect(turn.cards.some((c) => c.href.includes('/crm'))).toBe(false);
    }
  });
});
