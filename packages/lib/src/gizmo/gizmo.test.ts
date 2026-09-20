import { describe, expect, it } from 'vitest';
import { ADMIN_PLACES, ADVISOR_PORTAL_PLACES, CRM_HOWTO, CRM_PLACES, MEMBER_PORTAL_PLACES } from './catalogs';
import { attachAliasPlaces, hrefAllowed, sanitizeRecordHits, stripDisallowedHrefs } from './href-guard';
import { rankPlaces } from './match';
import { looksLikeRecordQuery, parseRecordQuery } from './parse-query';
import { detectForeignAsk } from './refuse';
import { runGizmoTurn } from './run-turn';
import type { GizmoPlace } from './types';

const SETTINGS_PLACES: GizmoPlace[] = [
  {
    id: 'api-keys',
    title: 'API Keys',
    href: '/crm/integrations?tab=api-keys',
    aliases: ['api keys', 'integrations', 'settings'],
    group: 'Integrations',
  },
  {
    id: 'assignment',
    title: 'Assignment Rules',
    href: '/crm/settings/automations/assignment',
    aliases: ['assignment', 'rules'],
    group: 'Settings',
  },
];

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

  it('treats a natural-language phone ask as a person search, not API Keys', () => {
    const parsed = parseRecordQuery("I need Frank Burnham's phone number please.");
    expect(parsed.shouldSearch).toBe(true);
    expect(parsed.isPersonLookup).toBe(true);
    expect(parsed.askedField?.key).toBe('phone');
    expect(parsed.searchTerm).toBe('Frank Burnham');
    expect(looksLikeRecordQuery("I need Frank Burnham's phone number please.")).toBe(true);
    expect(parseRecordQuery('I need Frank Burnham\u2019s phone number please').searchTerm).toBe(
      'Frank Burnham',
    );

    const places = rankPlaces([...CRM_PLACES, ...SETTINGS_PLACES], "I need Frank Burnham's phone number please.");
    expect(places.some((p) => p.title === 'API Keys')).toBe(false);
    expect(places.some((p) => p.title === 'Assignment Rules')).toBe(false);
  });

  it('extracts email asks and still treats bare settings titles as places', () => {
    const email = parseRecordQuery("what's Wendy Hall's email");
    expect(email.shouldSearch).toBe(true);
    expect(email.searchTerm).toBe('Wendy Hall');
    expect(email.askedField?.key).toBe('email');

    expect(parseRecordQuery('API Keys').isPersonLookup).toBe(false);
    expect(parseRecordQuery('Assignment Rules').isPersonLookup).toBe(false);
    const api = rankPlaces(SETTINGS_PLACES, 'API Keys');
    expect(api[0]?.title).toBe('API Keys');
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

  it('speaks Frank Burnham phone and never returns settings cards', () => {
    const hit = runGizmoTurn({
      app: 'crm',
      query: "I need Frank Burnham's phone number please.",
      places: [...CRM_PLACES, ...SETTINGS_PLACES],
      howto: CRM_HOWTO,
      records: [
        {
          title: 'Frank Burnham',
          href: '/crm/r/11111111-1111-1111-1111-111111111111',
          module: 'members',
          phone: '(555) 010-0199',
          email: 'frank@example.com',
        },
      ],
    });
    expect(hit.askedField?.key).toBe('phone');
    expect(hit.reply).toContain('(555) 010-0199');
    expect(hit.reply).toContain('Frank Burnham');
    expect(hit.cards).toHaveLength(1);
    expect(hit.cards[0]?.kind).toBe('record');
    expect(hit.cards[0]?.href).toBe('/crm/r/11111111-1111-1111-1111-111111111111');
    expect(hit.cards.some((c) => c.title === 'API Keys')).toBe(false);

    const miss = runGizmoTurn({
      app: 'crm',
      query: "I need Frank Burnham's phone number please.",
      places: [...CRM_PLACES, ...SETTINGS_PLACES],
      howto: CRM_HOWTO,
      records: [],
    });
    expect(miss.cards).toHaveLength(0);
    expect(miss.allowedHrefs).toHaveLength(0);
    expect(miss.reply).toMatch(/couldn't find anyone matching Frank Burnham/i);
    expect(miss.reply).not.toMatch(/API Keys is here/i);
  });

  it('speaks an email when asked and still navigates to API Keys on purpose', () => {
    const email = runGizmoTurn({
      app: 'crm',
      query: "what's Wendy Hall's email",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [
        {
          title: 'Wendy Hall',
          href: '/crm/r/22222222-2222-2222-2222-222222222222',
          module: 'contacts',
          email: 'wendy@example.com',
        },
      ],
    });
    expect(email.reply).toBe("Wendy Hall's email is wendy@example.com.");
    expect(email.cards[0]?.kind).toBe('record');

    const api = runGizmoTurn({
      app: 'crm',
      query: 'API Keys',
      places: SETTINGS_PLACES,
      howto: [],
    });
    expect(api.cards[0]?.title).toBe('API Keys');
    expect(api.reply).toBe('API Keys is here.');

    const assignment = runGizmoTurn({
      app: 'crm',
      query: 'where is assignment rules',
      places: SETTINGS_PLACES,
      howto: [],
    });
    expect(assignment.cards[0]?.title).toBe('Assignment Rules');
  });
});

describe('gizmo record fields and syntax', () => {
  const frank = {
    title: 'Frank Burnham',
    href: '/crm/r/11111111-1111-1111-1111-111111111111',
    module: 'members',
    phone: '(555) 010-0199',
    email: 'frank@example.com',
    fields: {
      phone: '(555) 010-0199',
      email: 'frank@example.com',
      status: 'Active',
      member_number: '7788001',
      dob: '1962-03-14',
      date_of_birth: '1962-03-14',
      company: 'PIFH',
      address_line1: '10 Oak St',
      city: 'Denver',
      state: 'CO',
      zip: '80202',
      advisor_name: 'Jane Advisor',
      plan_name: 'PIFH-MSA-IND-1250',
    },
  };

  it('parses CRM field asks and strips type words from the search term', () => {
    const cases: Array<[string, string, string]> = [
      ["I need Frank Burnham's phone number please.", 'phone', 'Frank Burnham'],
      ["what's Wendy Hall's email", 'email', 'Wendy Hall'],
      ['email for Wendy Hall', 'email', 'Wendy Hall'],
      ["Frank Burnham's number please", 'phone', 'Frank Burnham'],
      ['phone for Frank Burnham', 'phone', 'Frank Burnham'],
      ["what's Frank Burnham's member number", 'member_number', 'Frank Burnham'],
      ["Frank Burnham's status", 'status', 'Frank Burnham'],
      ["what's Frank Burnham's address", 'address', 'Frank Burnham'],
      ["Frank Burnham's date of birth", 'dob', 'Frank Burnham'],
      ["Frank Burnham's company", 'company', 'Frank Burnham'],
      ["Frank Burnham's advisor", 'advisor_name', 'Frank Burnham'],
      ['find member Frank Burnham', 'null', 'Frank Burnham'],
      ['show me Frank Burnham', 'null', 'Frank Burnham'],
      ['get me Frank', 'null', 'Frank'],
    ];
    for (const [query, key, term] of cases) {
      const parsed = parseRecordQuery(query);
      expect(parsed.shouldSearch, query).toBe(true);
      expect(parsed.searchTerm, query).toBe(term);
      if (key === 'null') expect(parsed.askedField, query).toBeNull();
      else expect(parsed.askedField?.key, query).toBe(key);
    }
    expect(looksLikeRecordQuery('find member')).toBe(false);
    expect(looksLikeRecordQuery('find reports')).toBe(false);
  });

  it('speaks member number, address, status, and DOB from hit fields', () => {
    const memberNo = runGizmoTurn({
      app: 'crm',
      query: "what's Frank Burnham's member number",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [frank],
    });
    expect(memberNo.reply).toBe("Frank Burnham's member number is 7788001.");

    const address = runGizmoTurn({
      app: 'crm',
      query: "what's Frank Burnham's address",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [frank],
    });
    expect(address.reply).toContain('10 Oak St');
    expect(address.reply).toContain('Denver');

    const status = runGizmoTurn({
      app: 'crm',
      query: "Frank Burnham's status",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [frank],
    });
    expect(status.reply).toBe("Frank Burnham's status is Active.");

    const dob = runGizmoTurn({
      app: 'crm',
      query: "Frank Burnham's date of birth",
      places: CRM_PLACES,
      howto: CRM_HOWTO,
      records: [frank],
    });
    expect(dob.reply).toBe("Frank Burnham's date of birth is 1962-03-14.");
  });

  it('member portal speaks my phone and refuses another person', () => {
    const mine = runGizmoTurn({
      app: 'member_portal',
      query: "what's my phone number",
      places: MEMBER_PORTAL_PLACES,
      howto: [],
      records: [
        {
          title: 'Pat Member',
          href: '/coverage',
          module: 'self',
          phone: '555-0100',
          fields: { phone: '555-0100' },
        },
      ],
    });
    expect(mine.refused).toBe(false);
    expect(mine.reply).toContain('555-0100');
    expect(mine.cards[0]?.href).toBe('/coverage');

    const other = runGizmoTurn({
      app: 'member_portal',
      query: "I need Frank Burnham's phone number please.",
      places: MEMBER_PORTAL_PLACES,
      howto: [],
      records: [frank],
    });
    expect(other.refused).toBe(true);
    expect(other.cards).toHaveLength(0);
  });

  it('advisor and admin speak a book-of-business phone without CRM hrefs', () => {
    const advisor = runGizmoTurn({
      app: 'advisor_portal',
      query: "I need Frank Burnham's phone number please.",
      places: ADVISOR_PORTAL_PLACES,
      howto: [],
      records: [
        {
          title: 'Frank Burnham',
          href: '/contacts/member/abc',
          module: 'members',
          phone: '(555) 010-0199',
        },
      ],
    });
    expect(advisor.refused).toBe(false);
    expect(advisor.reply).toContain('(555) 010-0199');
    expect(advisor.cards.every((c) => c.href.startsWith('/contacts'))).toBe(true);

    const admin = runGizmoTurn({
      app: 'admin',
      query: "what's Frank Burnham's email",
      places: ADMIN_PLACES,
      howto: [],
      records: [
        {
          title: 'Frank Burnham',
          href: '/members/abc',
          module: 'members',
          email: 'frank@example.com',
        },
      ],
    });
    expect(admin.reply).toBe("Frank Burnham's email is frank@example.com.");
    expect(admin.cards[0]?.href).toBe('/members/abc');
  });
});
