import { describe, expect, it } from 'vitest';
import {
  fallbackSectionHeadingFromFieldSection,
  getSectionMeta,
  isPersonCoverageSectionKey,
  isPersonModuleKey,
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
});
