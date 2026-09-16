import { describe, expect, it } from 'vitest';
import { ADMIN_PLACES, ADVISOR_PORTAL_PLACES, CRM_HOWTO, CRM_PLACES, MEMBER_PORTAL_PLACES } from './catalogs';
import { attachAliasPlaces, hrefAllowed, sanitizeRecordHits, stripDisallowedHrefs } from './href-guard';
import { looksLikeRecordQuery, rankPlaces } from './match';
import { detectForeignAsk } from './refuse';
import { runGizmoTurn } from './run-turn';

describe('gizmo matcher', () => {
  it('finds CRM reports and MFA from catalog', () => {
    const reports = rankPlaces(CRM_PLACES, 'where is reports');
    expect(reports[0]?.href).toBe('/crm/reports');
    const mfa = rankPlaces(CRM_PLACES, 'MFA');
    expect(mfa[0]?.href).toBe('/crm/settings/security');
  });

  it('finds admin commission rates', () => {
    const hits = rankPlaces(ADMIN_PLACES, 'commission rates');
    expect(hits[0]?.href).toBe('/commissions/rates');
  });

  it('treats a person name as a record query, not a place query', () => {
    expect(looksLikeRecordQuery('Wendy Hall')).toBe(true);
    expect(looksLikeRecordQuery('find wendy')).toBe(true);
    expect(looksLikeRecordQuery('wendy hall')).toBe(true);
    expect(looksLikeRecordQuery('where is reports')).toBe(false);
    expect(looksLikeRecordQuery('find reports')).toBe(false);
    expect(looksLikeRecordQuery('how do I import contacts')).toBe(false);
  });

  it('keeps MFA aliases when Settings is on the palette', () => {
    const merged = attachAliasPlaces(
      [{ id: 's', title: 'Settings', href: '/crm/settings', aliases: ['settings'] }],
      CRM_PLACES,
      'crm',
    );
    expect(merged.some((p) => p.href === '/crm/settings/security' && p.aliases.includes('mfa'))).toBe(
      true,
    );
  });
});

describe('gizmo isolation', () => {
  it('never allows CRM hrefs in member or admin catalogs', () => {
    expect(MEMBER_PORTAL_PLACES.some((p) => p.href.startsWith('/crm'))).toBe(false);
    expect(ADMIN_PLACES.some((p) => p.href.startsWith('/crm'))).toBe(false);
    expect(hrefAllowed('member_portal', '/crm/r/abc')).toBe(false);
    expect(hrefAllowed('admin', '/crm/workqueue')).toBe(false);
    expect(hrefAllowed('crm', '/billing')).toBe(false);
    expect(hrefAllowed('crm', '/crm/r/11111111-1111-1111-1111-111111111111')).toBe(true);
  });

  it('strips invented CRM hrefs from member replies', () => {
    const text = 'Open [pipeline](/crm/modules/deals) or /crm/r/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const cleaned = stripDisallowedHrefs('member_portal', text, ['/coverage']);
    expect(cleaned).not.toContain('/crm/');
  });

  it('drops cross-app record hits', () => {
    const hits = sanitizeRecordHits('member_portal', [
      { title: 'Jane', href: '/crm/r/1', module: 'contacts' },
      { title: 'Me', href: '/coverage', module: 'self' },
    ]);
    expect(hits).toEqual([{ title: 'Me', href: '/coverage', module: 'self' }]);
  });

  it('refuses member asks about CRM book', () => {
    expect(detectForeignAsk('member_portal', 'show pipeline')?.reason).toBe('foreign_app');
    expect(detectForeignAsk('member_portal', 'find Jane Doe')?.reason).toBe('other_person');
    expect(detectForeignAsk('crm', 'pay my sharing bill')?.reason).toBe('foreign_app');
    expect(detectForeignAsk('admin', 'CRM workqueue')?.reason).toBe('foreign_app');
  });

  it('member turn never returns CRM cards even if adapter leaks them', () => {
    const turn = runGizmoTurn({
      app: 'member_portal',
      query: 'find Jane Doe',
      places: [{ id: 'leak', title: 'Contacts', href: '/crm/modules/contacts', aliases: [] }],
      howto: [],
      records: [{ title: 'Jane', href: '/crm/r/x', module: 'contacts' }],
    });
    expect(turn.refused).toBe(true);
    expect(turn.cards).toHaveLength(0);
    expect(turn.allowedHrefs).toHaveLength(0);
  });

  it('CRM fallback finds import how-to and refuses portal billing', () => {
    const howto = runGizmoTurn({
      app: 'crm',
      query: 'how do I import contacts',
      places: CRM_PLACES,
      howto: CRM_HOWTO,
    });
    expect(howto.cards.some((c) => c.href === '/crm/learn/contacts/importing')).toBe(true);
    expect(howto.cards.every((c) => c.href.startsWith('/crm'))).toBe(true);

    const refuse = runGizmoTurn({
      app: 'crm',
      query: 'pay my sharing bill',
      places: [],
      howto: [],
    });
    expect(refuse.refused).toBe(true);
    expect(refuse.cards).toHaveLength(0);
  });

  it('advisor catalog refuses CRM workqueue', () => {
    const turn = runGizmoTurn({
      app: 'advisor_portal',
      query: 'crm workqueue',
      places: ADVISOR_PORTAL_PLACES,
      howto: [],
    });
    expect(turn.refused).toBe(true);
    expect(turn.cards).toHaveLength(0);
  });

  it('answers what is this page from tips without inventing hrefs', () => {
    const turn = runGizmoTurn({
      app: 'crm',
      query: "what's this page",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      pageTips: [{ id: 't1', title: 'Import', body: 'Use the Import button.' }],
    });
    expect(turn.usedTools).toContain('page_context');
    expect(turn.reply).toContain('Import');
    expect(turn.cards).toHaveLength(0);
  });

  it('unknown query yields no fake link', () => {
    const miss = runGizmoTurn({
      app: 'crm',
      query: 'zzz-not-a-real-page-or-person',
      places: [],
      howto: [],
    });
    expect(miss.cards).toHaveLength(0);
    expect(miss.allowedHrefs).toHaveLength(0);
  });
});
