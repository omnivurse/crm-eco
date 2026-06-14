import { describe, expect, it } from 'vitest';
import { auditPersonModuleCoverageFields } from './coverage-field-parity';
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

describe('auditPersonModuleCoverageFields', () => {
  it('flags missing sharing_entity on contacts', () => {
    const issues = auditPersonModuleCoverageFields(
      'contacts',
      [field('health_insurance_carrier', 'health_insurance')],
      ['health_sharing', 'health_insurance'],
    );
    expect(issues.some((i) => i.code === 'missing_field' && i.fieldKey === 'sharing_entity')).toBe(
      true,
    );
  });

  it('flags layout section with zero configured fields', () => {
    const issues = auditPersonModuleCoverageFields(
      'contacts',
      [field('sharing_entity', 'health_sharing')],
      ['health_sharing', 'health_insurance'],
    );
    expect(
      issues.some(
        (i) => i.code === 'layout_section_no_fields' && i.sectionKey === 'health_insurance',
      ),
    ).toBe(true);
  });

  it('ignores non-person modules', () => {
    expect(auditPersonModuleCoverageFields('deals', [], ['health_sharing'])).toEqual([]);
  });
});
