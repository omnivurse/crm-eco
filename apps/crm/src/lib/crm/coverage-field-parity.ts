/**
 * Canonical coverage field + section definitions shared across Leads, Contacts,
 * and Members. Used by UI guards and verification scripts to prevent post-conversion
 * "insurance section disappeared" regressions.
 */

import type { CrmField } from '@/lib/crm/types';
import {
  HEALTH_SHARING_DATA_KEYS,
  type HealthSharingDataKey,
} from '@/lib/crm/lead-contact-sharing-fields';
import {
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  PERSON_COVERAGE_SECTION_KEYS,
} from '@/components/crm/records/section-utils';

export { HEALTH_SHARING_DATA_KEYS, type HealthSharingDataKey };
export { PERSON_COVERAGE_SECTION_KEYS, isPersonCoverageSectionKey, isPersonModuleKey };

/** Minimum JSONB keys the lead→contact conversion RPC must carry. */
export const CONVERSION_INSURANCE_DATA_KEYS = [
  ...HEALTH_SHARING_DATA_KEYS,
  'carrier',
  'group_name',
  'tobacco_user',
  'previous_product',
  'add_on_product',
  'vision',
  'dental',
  'health_insurance_carrier',
  'insurance_carrier',
  'carrier_name',
  'health_insurance_start_date',
  'health_insurance_end_date',
  'health_insurance_plan_name',
  'health_insurance_premium',
  'health_insurance_status',
  'health_insurance_deductible',
  'insurance_effective_date',
  'product',
  'coverage_option',
  'monthly_premium',
  'start_date',
] as const;

/** Field keys every person module should expose for reps to enter coverage. */
export const REQUIRED_PERSON_COVERAGE_FIELD_KEYS = [
  'sharing_entity',
  'member_tier',
  'monthly_contribution',
  'iua_amount',
  'sharing_effective_date',
  'sharing_status',
  'sharing_member_id',
  'previous_membership',
  'health_insurance_carrier',
  'health_insurance_plan_name',
  'health_insurance_premium',
  'health_insurance_start_date',
  'health_insurance_end_date',
  'health_insurance_status',
] as const;

export interface CoverageParityIssue {
  code: 'missing_field' | 'wrong_section' | 'layout_section_no_fields';
  moduleKey: string;
  fieldKey?: string;
  sectionKey?: string;
  message: string;
}

/**
 * Detect schema/layout gaps that would hide coverage UI after lead conversion.
 */
export function auditPersonModuleCoverageFields(
  moduleKey: string,
  fields: CrmField[],
  layoutSectionKeys: string[],
): CoverageParityIssue[] {
  if (!isPersonModuleKey(moduleKey)) return [];

  const issues: CoverageParityIssue[] = [];
  const byKey = new Map(fields.map((f) => [f.key, f]));

  for (const fieldKey of REQUIRED_PERSON_COVERAGE_FIELD_KEYS) {
    const field = byKey.get(fieldKey);
    if (!field) {
      issues.push({
        code: 'missing_field',
        moduleKey,
        fieldKey,
        message: `${moduleKey} module is missing crm_fields row for "${fieldKey}"`,
      });
      continue;
    }
    if (!isPersonCoverageSectionKey(field.section || '')) {
      issues.push({
        code: 'wrong_section',
        moduleKey,
        fieldKey,
        sectionKey: field.section || 'main',
        message: `${moduleKey}.${fieldKey} is in section "${field.section}" — expected a coverage section`,
      });
    }
  }

  for (const sectionKey of layoutSectionKeys) {
    if (!isPersonCoverageSectionKey(sectionKey)) continue;
    const count = fields.filter((f) => (f.section || 'main') === sectionKey).length;
    if (count === 0) {
      issues.push({
        code: 'layout_section_no_fields',
        moduleKey,
        sectionKey,
        message: `${moduleKey} layout lists "${sectionKey}" but no crm_fields are assigned to that section`,
      });
    }
  }

  return issues;
}
