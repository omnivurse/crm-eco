import { describe, expect, it } from 'vitest';
import {
  buildEffectiveSections,
  compareSectionOrder,
  fallbackSectionHeadingFromFieldSection,
  getSectionMeta,
  getSectionNavGroup,
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  resolveSectionAccent,
  shouldAlwaysShowEmptySection,
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

  it('always shows empty sections when inline editable', () => {
    expect(shouldAlwaysShowEmptySection('deals', 'address', true)).toBe(true);
  });

  it('labels legacy insurance section distinctly from health_sharing', () => {
    expect(fallbackSectionHeadingFromFieldSection('insurance')).toBe('Membership & Product');
    expect(fallbackSectionHeadingFromFieldSection('health_sharing')).toBe('HealthShare');
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
        field('street', 'address'),
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
    expect(getSectionNavGroup('address')).toBe('location');
    expect(getSectionNavGroup('payment')).toBe('admin');
  });

  it('hides empty read-only sections from nav but keeps inline-editable ones', () => {
    const metaReadOnly = getSectionMeta(
      [field('street', 'address')],
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
      { street: '123 Main' },
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
});
