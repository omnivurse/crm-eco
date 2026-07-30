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

  it('flags monthly_premium labeled Monthly Premium when dedicated premium also exists', () => {
    const fields = [
      field('sharing_entity', 'health_sharing'),
      field('member_tier', 'health_sharing'),
      field('monthly_contribution', 'health_sharing'),
      field('iua_amount', 'health_sharing'),
      field('sharing_effective_date', 'health_sharing'),
      field('sharing_end_date', 'health_sharing'),
      field('sharing_status', 'health_sharing'),
      field('sharing_member_id', 'health_sharing'),
      field('previous_membership', 'health_sharing'),
      field('health_insurance_carrier', 'health_insurance'),
      field('health_insurance_plan_name', 'health_insurance'),
      {
        ...field('health_insurance_premium', 'health_insurance'),
        label: 'Monthly Premium',
      },
      field('health_insurance_start_date', 'health_insurance'),
      field('health_insurance_end_date', 'health_insurance'),
      field('health_insurance_status', 'health_insurance'),
      {
        ...field('monthly_premium', 'insurance'),
        label: 'Monthly Premium',
      },
    ];
    const issues = auditPersonModuleCoverageFields('contacts', fields, [
      'health_sharing',
      'health_insurance',
    ]);
    expect(
      issues.some((i) => i.code === 'monthly_premium_should_be_contribution'),
    ).toBe(true);
    expect(issues.some((i) => i.code === 'duplicate_monthly_premium_labels')).toBe(true);
  });
});
