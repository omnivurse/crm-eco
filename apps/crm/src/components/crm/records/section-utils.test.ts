import { describe, expect, it } from 'vitest';
import {
  buildEffectiveSections,
  compareSectionOrder,
  fallbackSectionHeadingFromFieldSection,
  findSectionNavGroupForKey,
  getSectionMeta,
  getSectionNavGroup,
  groupSectionsForNav,
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  normalizeLegacySectionHeading,
  resolveSectionAccent,
  shouldAlwaysShowEmptySection,
  type SectionMeta,
} from './section-utils';
import type { CrmField } from '@/lib/crm/types';

function field(key: string, section: string): CrmField {
  return {
    id: key,
    org_id: 'org',
    module_id: 'mod',
    key,
    label: key,
    type: 'text',
    required: false,
    is_system: false,
    display_order: 1,
    section,
    width: 'half',
    created_at: '',
    updated_at: '',
  };
}

describe('section-utils person coverage visibility', () => {
  it('recognizes person modules', () => {
    expect(isPersonModuleKey('contacts')).toBe(true);
    expect(isPersonModuleKey('leads')).toBe(true);
    expect(isPersonModuleKey('history')).toBe(true);
    expect(isPersonModuleKey('deals')).toBe(false);
  });

  it('recognizes coverage section keys', () => {
    expect(isPersonCoverageSectionKey('health_insurance')).toBe(true);
    expect(isPersonCoverageSectionKey('insurance')).toBe(true);
    expect(isPersonCoverageSectionKey('core')).toBe(false);
  });

  it('keeps empty coverage sections visible on contacts without inline edit', () => {
    expect(shouldAlwaysShowEmptySection('contacts', 'health_insurance', false)).toBe(true);
    expect(shouldAlwaysShowEmptySection('contacts', 'address', false)).toBe(false);
  });

  it('does not force orphan non-coverage sections just because inline edit is on', () => {
    // Blank fields in a real section stay visible via shouldIncludeSectionInNav;
    // zero-field layout leftovers (start_date, notes_history form card) must not.
    expect(shouldAlwaysShowEmptySection('deals', 'address', true)).toBe(false);
    expect(shouldAlwaysShowEmptySection('contacts', 'start_date', true)).toBe(false);
    expect(shouldAlwaysShowEmptySection('contacts', 'notes_history', true)).toBe(false);
    expect(shouldAlwaysShowEmptySection('contacts', 'health_insurance', true)).toBe(true);
  });

  it('labels legacy insurance section distinctly from health_sharing', () => {
    expect(fallbackSectionHeadingFromFieldSection('insurance')).toBe('Insurance');
    expect(fallbackSectionHeadingFromFieldSection('health_sharing')).toBe('HealthShare');
    expect(normalizeLegacySectionHeading('insurance', 'Membership & Product')).toBe(
      'Product',
    );
    expect(normalizeLegacySectionHeading('insurance', 'Insurance')).toBe('HealthShare');
    expect(normalizeLegacySectionHeading('relationships', 'Relationships')).toBe('Partner Type');
    expect(normalizeLegacySectionHeading('relationships', 'Relationship')).toBe('Partner Type');
    expect(fallbackSectionHeadingFromFieldSection('relationships')).toBe('Partner Type');
  });

  it('does not count matching ownership aliases toward the Ownership badge', () => {
    const meta = getSectionMeta(
      [
        field('producer_name', 'management'),
        field('advisor', 'management'),
        field('agent', 'management'),
        field('referring_member', 'management'),
      ],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [{ key: 'management', label: 'Ownership', columns: 2 }],
        },
        created_at: '',
        updated_at: '',
      },
      {
        producer_name: 'Wendy Scipione',
        advisor: 'Wendy Scipione',
        agent: '',
        referring_member: 'Jennifer Abbott',
      },
      'contacts',
    );
    const ownership = meta.find((s) => s.key === 'management');
    expect(ownership?.fieldCount).toBe(2);
    expect(ownership?.filledCount).toBe(2);
  });

  it('does not count matching Street + Mailing Street toward the Address badge', () => {
    const meta = getSectionMeta(
      [
        field('street', 'address'),
        field('mailing_street', 'address'),
        field('city', 'address'),
        field('state', 'address'),
        field('zip_code', 'address'),
        field('county', 'address'),
      ],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [{ key: 'address', label: 'Address', columns: 2 }],
        },
        created_at: '',
        updated_at: '',
      },
      {
        street: '64197 Peach Valley Road',
        mailing_street: '64197 Peach Valley Road',
        city: 'Montrose',
        state: 'CO',
        zip_code: '81401',
      },
      'leads',
    );
    const address = meta.find((s) => s.key === 'address');
    expect(address?.fieldCount).toBe(5);
    expect(address?.filledCount).toBe(4);
  });

  it('includes empty coverage layout sections for person modules in nav meta', () => {
    const meta = getSectionMeta(
      [field('sharing_entity', 'health_sharing')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'health_sharing', label: 'Health Share', columns: 2 },
            { key: 'health_insurance', label: 'Health Insurance', columns: 2 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      {},
      'contacts',
    );
    expect(meta.map((s) => s.key)).toContain('health_insurance');
    expect(meta.find((s) => s.key === 'health_insurance')?.fieldCount).toBe(0);
  });

  it('sorts sections in canonical display order (name before coverage before address)', () => {
    const meta = getSectionMeta(
      [
        field('mailing_street', 'address'),
        field('sharing_entity', 'health_sharing'),
        field('first_name', 'core'),
        field('note', 'notes_history'),
      ],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'address', label: 'Address', columns: 2 },
            { key: 'health_sharing', label: 'Health Share', columns: 2 },
            { key: 'core', label: 'Name', columns: 2 },
            { key: 'notes_history', label: 'Notes', columns: 1 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      {},
      'contacts',
      { inlineEditable: true },
    );
    expect(meta.map((s) => s.key)).toEqual([
      'core',
      'notes_history',
      'health_sharing',
      'address',
    ]);
  });

  it('syncs the notes pill to the real note count and links it to the Notes list', () => {
    const meta = getSectionMeta(
      [field('first_name', 'core'), field('notes_history', 'notes_history')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'core', label: 'Lead Information', columns: 2 },
            { key: 'notes_history', label: 'Notes History', columns: 1 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      // Legacy notes_history textarea is empty, but 6 note records exist.
      { first_name: 'Andrea' },
      'leads',
      { inlineEditable: true, noteCount: 6 },
    );

    const notes = meta.find((s) => s.key === 'notes_history');
    expect(notes?.label).toBe('Notes');
    expect(notes?.badgeCount).toBe(6);
    expect(notes?.navAction).toBe('open-notes');
    // Non-notes sections are untouched by the note-count sync.
    const core = meta.find((s) => s.key === 'core');
    expect(core?.badgeCount).toBeUndefined();
    expect(core?.navAction).toBeUndefined();
  });

  it('leaves the notes pill as a field-fill count when no note count is supplied', () => {
    const meta = getSectionMeta(
      [field('notes_history', 'notes_history')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: { sections: [{ key: 'notes_history', label: 'Notes History', columns: 1 }] },
        created_at: '',
        updated_at: '',
      },
      {},
      'leads',
      { inlineEditable: true },
    );

    const notes = meta.find((s) => s.key === 'notes_history');
    expect(notes?.label).toBe('Notes History');
    expect(notes?.badgeCount).toBeUndefined();
    // Notes-group pills always open the Notes tab, even without a count.
    expect(notes?.navAction).toBe('open-notes');
  });

  it('applies semantic accent colors by section key', () => {
    expect(resolveSectionAccent('core')).toBe('blue');
    expect(resolveSectionAccent('health_sharing')).toBe('emerald');
    expect(resolveSectionAccent('address')).toBe('teal');
    expect(resolveSectionAccent('notes_history')).toBe('sky');
    expect(resolveSectionAccent('unknown_section')).toBe('slate');
  });

  it('compareSectionOrder ranks known keys before unknown keys alphabetically', () => {
    expect(compareSectionOrder('core', 'address', 'contacts')).toBeLessThan(0);
    expect(compareSectionOrder('address', 'core', 'contacts')).toBeGreaterThan(0);
    expect(compareSectionOrder('zzz_extra', 'aaa_extra', 'contacts')).toBeGreaterThan(0);
  });

  it('orders deal sections with pipeline before notes', () => {
    const ordered = buildEffectiveSections(
      {
        sections: [
          { key: 'notes_history', label: 'Notes', columns: 1 },
          { key: 'pipeline', label: 'Pipeline', columns: 2 },
          { key: 'core', label: 'Deal', columns: 2 },
        ],
      },
      ['core', 'pipeline', 'notes_history'],
      'deals',
    ).map((s) => s.key);
    expect(ordered).toEqual(['core', 'pipeline', 'notes_history']);
  });

  it('nav groups coverage separately from identity', () => {
    expect(getSectionNavGroup('core')).toBe('identity');
    expect(getSectionNavGroup('health_sharing')).toBe('coverage');
    expect(getSectionNavGroup('address')).toBe('address');
    expect(getSectionNavGroup('payment')).toBe('admin');
  });

  it('splits Family from Address and Ownership from Admin', () => {
    expect(getSectionNavGroup('family')).toBe('family');
    expect(getSectionNavGroup('family_spouse')).toBe('family');
    expect(getSectionNavGroup('family_children')).toBe('family');
    expect(getSectionNavGroup('relationships')).toBe('family');
    expect(getSectionNavGroup('address')).toBe('address');
    expect(getSectionNavGroup('mailing_address')).toBe('address');
    expect(getSectionNavGroup('advisor')).toBe('ownership');
    expect(getSectionNavGroup('management')).toBe('ownership');
    expect(getSectionNavGroup('agent')).toBe('ownership');
    expect(getSectionNavGroup('system')).toBe('admin');
    expect(getSectionNavGroup('identifiers')).toBe('admin');
    expect(getSectionNavGroup('zoho_system')).toBe('admin');
    // Account related-list sections are neither family nor address.
    expect(getSectionNavGroup('contacts')).toBe('other');
    expect(getSectionNavGroup('deals')).toBe('other');
  });

  it('hides empty read-only sections from nav but keeps inline-editable ones', () => {
    const metaReadOnly = getSectionMeta(
      [field('mailing_street', 'address')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'core', label: 'Name', columns: 2 },
            { key: 'address', label: 'Address', columns: 2 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      { mailing_street: '123 Main' },
      'contacts',
      { inlineEditable: false },
    );
    expect(metaReadOnly.map((s) => s.key)).toEqual(['address']);

    const metaInline = getSectionMeta(
      [field('first_name', 'core')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: { sections: [{ key: 'core', label: 'Name', columns: 2 }] },
        created_at: '',
        updated_at: '',
      },
      {},
      'contacts',
      { inlineEditable: true },
    );
    expect(metaInline.map((s) => s.key)).toEqual(['core']);
  });

  it('drops orphan layout sections with zero fields (start_date) from nav', () => {
    const meta = getSectionMeta(
      [field('first_name', 'core'), field('notes_history', 'notes_history')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'core', label: 'Name', columns: 2 },
            { key: 'notes_history', label: 'Notes History', columns: 1 },
            { key: 'start_date', label: 'Start Date', columns: 2 },
            { key: 'health_insurance', label: 'Health Insurance', columns: 2 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      { first_name: 'Travis' },
      'contacts',
      { inlineEditable: true, noteCount: 2 },
    );

    expect(meta.map((s) => s.key)).toEqual([
      'core',
      'notes_history',
      'health_insurance',
    ]);
    expect(meta.find((s) => s.key === 'notes_history')?.badgeCount).toBe(2);
    expect(meta.find((s) => s.key === 'notes_history')?.navAction).toBe('open-notes');
    expect(meta.find((s) => s.key === 'start_date')).toBeUndefined();
  });

  it('credits email/phone toward Contact section fill counts on person modules', () => {
    const meta = getSectionMeta(
      [
        field('mobile_2', 'contact'),
        field('email', 'core'),
        field('phone', 'core'),
        field('first_name', 'core'),
      ],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'core', label: 'Name', columns: 2 },
            { key: 'contact', label: 'Contact', columns: 2 },
          ],
        },
        created_at: '',
        updated_at: '',
      },
      {
        first_name: 'David',
        email: 'DaveLung@Da2Ventures.com',
        phone: '970-779-4782',
      },
      'contacts',
      { inlineEditable: true },
    );

    const contact = meta.find((s) => s.key === 'contact');
    expect(contact).toBeDefined();
    // mobile_2 empty + email/phone populated among identity extras
    expect(contact!.filledCount).toBeGreaterThanOrEqual(2);
    expect(contact!.fieldCount).toBeGreaterThan(1);
  });

  it('hides every live PIF orphan layout band from nav in inline-edit mode', () => {
    // Live default layouts still declare these sections with zero assigned fields.
    const orphanKeys = [
      'start_date',
      'activity',
      'additional',
      'family',
      'zoho_system',
      'commissions',
    ];
    const meta = getSectionMeta(
      [field('first_name', 'core')],
      {
        id: 'layout',
        org_id: 'org',
        module_id: 'mod',
        name: 'Default',
        is_default: true,
        config: {
          sections: [
            { key: 'core', label: 'Name', columns: 2 },
            ...orphanKeys.map((key) => ({ key, label: key, columns: 2 as const })),
          ],
        },
        created_at: '',
        updated_at: '',
      },
      { first_name: 'Travis' },
      'contacts',
      { inlineEditable: true },
    );

    expect(meta.map((s) => s.key)).toEqual(['core']);
    for (const key of orphanKeys) {
      expect(meta.find((s) => s.key === key)).toBeUndefined();
      expect(shouldAlwaysShowEmptySection('contacts', key, true)).toBe(false);
    }
  });
});

describe('groupSectionsForNav', () => {
  const meta = (
    key: string,
    filled: number,
    total: number,
    extra: Partial<SectionMeta> = {},
  ): SectionMeta => ({
    key,
    label: key,
    fieldCount: total,
    filledCount: filled,
    navGroup: getSectionNavGroup(key),
    ...extra,
  });

  it('collapses sections into ordered group bands and sums counts', () => {
    const bands = groupSectionsForNav([
      meta('core', 3, 4),
      meta('contact', 1, 2),
      meta('health_sharing', 5, 9),
      meta('address', 2, 6),
      meta('family', 0, 4),
      meta('advisor', 1, 1),
      meta('mystery', 0, 2),
    ]);
    expect(bands.map((b) => b.group)).toEqual([
      'identity',
      'coverage',
      'address',
      'family',
      'ownership',
      'other',
    ]);
    expect(bands[0]).toMatchObject({ label: 'Profile', filledCount: 4, fieldCount: 6 });
    expect(bands[0].sections.map((s) => s.key)).toEqual(['core', 'contact']);
    expect(bands[2]).toMatchObject({ label: 'Address', filledCount: 2, fieldCount: 6 });
    expect(bands[3]).toMatchObject({ label: 'Family', filledCount: 0, fieldCount: 4 });
    expect(bands[4]).toMatchObject({ label: 'Ownership', filledCount: 1, fieldCount: 1 });
    expect(bands[5].label).toBe('More');
  });

  it('orders people-module bands Profile · Coverage · Family · Address · Ownership · Admin', () => {
    const bands = groupSectionsForNav([
      meta('core', 1, 1),
      meta('health_sharing', 1, 1),
      meta('family_spouse', 1, 1),
      meta('family_children', 0, 1),
      meta('address', 1, 1),
      meta('advisor', 1, 1),
      meta('management', 1, 1),
      meta('payment', 1, 1),
      meta('system', 1, 1),
    ]);
    expect(bands.map((b) => b.label)).toEqual([
      'Profile',
      'Coverage',
      'Family',
      'Address',
      'Ownership',
      'Admin',
    ]);
    expect(bands[2].sections.map((s) => s.key)).toEqual(['family_spouse', 'family_children']);
    expect(bands[4].sections.map((s) => s.key)).toEqual(['advisor', 'management']);
  });

  it('carries the note badge onto the notes band', () => {
    const bands = groupSectionsForNav([
      meta('core', 1, 1),
      meta('notes_history', 0, 0, { badgeCount: 7, navAction: 'open-notes' }),
    ]);
    const notes = bands.find((b) => b.group === 'notes');
    expect(notes?.badgeCount).toBe(7);
    expect(notes?.sections[0].navAction).toBe('open-notes');
  });

  it('keeps a single band when every section shares a group', () => {
    const bands = groupSectionsForNav([meta('core', 1, 1), meta('personal', 2, 2)]);
    expect(bands).toHaveLength(1);
    expect(bands[0].sections).toHaveLength(2);
  });

  it('resolves the owning group for a section key', () => {
    const bands = groupSectionsForNav([meta('core', 1, 1), meta('address', 1, 1)]);
    expect(findSectionNavGroupForKey(bands, 'address')).toBe('address');
    expect(findSectionNavGroupForKey(bands, 'nope')).toBeNull();
  });
});

describe('Partner Details section — visible only for partners', () => {
  const partnerFields = [
    field('relationship_type', 'main'),
    field('partner_industry', 'partner'),
    field('partner_services', 'partner'),
    field('partner_since', 'partner'),
  ];
  const layout = {
    id: 'l',
    config: {
      sections: [
        { key: 'main', label: 'Main', columns: 2 as const },
        { key: 'partner', label: 'Partner Details', columns: 2 as const },
      ],
    },
  } as never;

  const partnerSection = (data: Record<string, unknown>, inlineEditable: boolean) =>
    getSectionMeta(partnerFields, layout, data, 'contacts', { inlineEditable }).find(
      (s) => s.key === 'partner',
    );

  it('is absent on an untagged contact, even while inline-editing', () => {
    // The 15,627 blank-relationship contacts must not grow an empty card —
    // inlineEditable normally forces every section to stay visible.
    expect(partnerSection({ relationship_type: '' }, false)).toBeUndefined();
    expect(partnerSection({ relationship_type: '' }, true)).toBeUndefined();
  });

  it('is absent for the neighbouring relationship values', () => {
    for (const v of ['Member', 'Advisor', 'Agency', 'DPC Provider', 'Provider']) {
      expect(partnerSection({ relationship_type: v }, true)).toBeUndefined();
    }
  });

  it('appears for a Referring Partner (Robin Anderson)', () => {
    const robin = partnerSection(
      { relationship_type: 'Referring Partner', partner_industry: 'Financial Advisor / Wealth Management' },
      false,
    );
    expect(robin?.label).toBe('Partner Details');
    expect(robin?.fieldCount).toBe(3);
    expect(robin?.filledCount).toBe(1);
  });

  it('appears for a service Partner', () => {
    expect(partnerSection({ relationship_type: 'Partner' }, true)?.fieldCount).toBe(3);
  });

  it('still shows a stranded partner value on a re-tagged record', () => {
    const s = partnerSection(
      { relationship_type: 'Member', partner_industry: 'Chiropractic' },
      false,
    );
    expect(s?.fieldCount).toBe(1);
    expect(s?.filledCount).toBe(1);
  });

  it('sits under Main and inside the Profile nav band', () => {
    expect(getSectionNavGroup('partner')).toBe('identity');
    expect(compareSectionOrder('main', 'partner', 'contacts')).toBeLessThan(0);
    expect(compareSectionOrder('partner', 'personal', 'contacts')).toBeLessThan(0);
  });

  it('falls back to "Partner Details" when no layout names the section', () => {
    expect(fallbackSectionHeadingFromFieldSection('partner')).toBe('Partner Details');
  });
});
