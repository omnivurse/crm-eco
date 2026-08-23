/**
 * One lexicon for people lists + one search promise (NV-1 / NV-6, D10).
 * File-read assertions keep the shell surfaces on the shared constants so a
 * stray literal placeholder or "Advisor / Agent" can't creep back in.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { describe, expect, it } from 'vitest';
import {
  ADVISORS_HREF,
  ADVISORS_LABEL,
  ADVISOR_LABEL,
  CRM_MEMBERS_HREF,
  MEMBER_ROSTER_HREF,
  PEOPLE_SECTION_LABEL,
} from './nav-lexicon';
import { SEARCH_ARIA_LABEL, SEARCH_PLACEHOLDER, SEARCH_PLACEHOLDER_ON_RECORD } from './search-copy';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

/** Every shell surface that renders the global search promise. */
const SEARCH_SURFACES = [
  'components/crm/shell/CrmTopBar.tsx',
  'components/crm/shell/ZohoContextualSidebar.tsx',
  'components/crm/shell/CrmCommandBar.tsx',
  'components/crm/shell/CommandPalette.tsx',
  'components/dashboard/command-desk/DeskGreeting.tsx',
];

describe('nav lexicon', () => {
  it('keeps CRM Members and the admin roster on different paths', () => {
    expect(CRM_MEMBERS_HREF).toBe('/crm/modules/members');
    expect(MEMBER_ROSTER_HREF).toBe('/crm/members');
    expect(CRM_MEMBERS_HREF).not.toBe(MEMBER_ROSTER_HREF);
  });

  it('points Advisors at the CRM module list (there is no /crm/advisors route)', () => {
    expect(ADVISORS_HREF).toBe('/crm/modules/advisors');
    expect(ADVISORS_LABEL).toBe('Advisors');
    expect(ADVISOR_LABEL).toBe('Advisor');
  });

  it('names the people section "People" (D10) and the CRM nav uses the constant', () => {
    expect(PEOPLE_SECTION_LABEL).toBe('People');
    const moduleContext = read('contexts/ModuleContext.tsx');
    expect(moduleContext).toMatch(/key: 'sec-pipeline', separator: true, sectionTitle: PEOPLE_SECTION_LABEL/);
    expect(moduleContext).not.toContain("'Sales Pipeline'");
  });

  it('no "Advisor / Agent" copy anywhere in src (ADVISOR_LABEL instead)', () => {
    const files = fg.sync(['**/*.ts', '**/*.tsx'], { cwd: SRC, ignore: ['**/*.test.*', 'lib/crm/nav-lexicon.ts'] });
    const offenders = files.filter((f) => read(f).includes('Advisor / Agent'));
    expect(offenders).toEqual([]);
  });
});

describe('search promise (NV-1)', () => {
  it('is one compact string that fits every pill, with the full promise in the aria-label', () => {
    expect(SEARCH_PLACEHOLDER).toBe('Search name, phone, member #…');
    expect(SEARCH_PLACEHOLDER.length).toBeLessThanOrEqual(30);
    expect(SEARCH_PLACEHOLDER_ON_RECORD.endsWith(SEARCH_PLACEHOLDER.replace(/^Search/, 'search'))).toBe(true);
    expect(SEARCH_ARIA_LABEL).toMatch(/name, email, phone or member number/);
    for (const s of [SEARCH_PLACEHOLDER, SEARCH_PLACEHOLDER_ON_RECORD]) {
      expect(s.endsWith('…')).toBe(true);
      expect(s).not.toContain('...');
    }
  });

  it('no shell surface carries a literal "Search …" placeholder or label — all import search-copy', () => {
    for (const rel of SEARCH_SURFACES) {
      const src = read(rel);
      expect(src, rel).toMatch(/from '@\/lib\/crm\/search-copy'/);
      // A literal "Search <words>…"/"..." in placeholder / aria-label / JSX text.
      const literal = /(placeholder|aria-label)=["'`]Search[^"'`]*["'`]|>\s*Search [^<{]*(…|\.\.\.)\s*</;
      expect(src, `${rel} must not hard-code the search promise`).not.toMatch(literal);
    }
    const stale = ['Search or workflow', 'Search people or work', 'Search records, jump to a module', 'Open command palette'];
    // search-copy.ts quotes the old strings in its own doc comment.
    const files = fg.sync(['**/*.ts', '**/*.tsx'], { cwd: SRC, ignore: ['**/*.test.*', 'lib/crm/search-copy.ts'] });
    const offenders = files.filter((f) => {
      const s = read(f);
      return stale.some((needle) => s.includes(needle));
    });
    expect(offenders).toEqual([]);
  });

  it('the icon-only search buttons announce the same promise and the palette input the full label', () => {
    const topBar = read('components/crm/shell/CrmTopBar.tsx');
    expect(topBar).toMatch(/data-testid="crm-topbar-search-mobile"/);
    expect(topBar).toMatch(/aria-label=\{SEARCH_PLACEHOLDER\}/);
    expect(topBar).toMatch(/<span className="whitespace-nowrap">\{SEARCH_PLACEHOLDER\}<\/span>/);
    const sidebar = read('components/crm/shell/ZohoContextualSidebar.tsx');
    expect(sidebar).toMatch(/aria-label=\{SEARCH_PLACEHOLDER\}/);
    expect(sidebar).toMatch(/\{SEARCH_PLACEHOLDER\}<\/span>/);
    const palette = read('components/crm/shell/CommandPalette.tsx');
    expect(palette).toMatch(/aria-label=\{SEARCH_ARIA_LABEL\}/);
  });
});
