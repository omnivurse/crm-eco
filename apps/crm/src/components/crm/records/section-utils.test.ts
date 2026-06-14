import { describe, expect, it } from 'vitest';
import {
  fallbackSectionHeadingFromFieldSection,
  isPersonCoverageSectionKey,
  isPersonModuleKey,
  shouldAlwaysShowEmptySection,
} from './section-utils';

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
});
