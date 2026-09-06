import { describe, expect, it } from 'vitest';
import { hasValidEnrollmentScope } from './enrollment-scope';

const validScope = {
  sequenceId: 'sequence-a',
  sequenceOrganizationId: 'org-a',
  recordOrganizationId: 'org-a',
  currentStepSequenceId: 'sequence-a',
};

describe('hasValidEnrollmentScope', () => {
  it('accepts a record and current step owned by the enrollment sequence', () => {
    expect(hasValidEnrollmentScope(validScope)).toBe(true);
  });

  it('rejects a cross-tenant CRM record', () => {
    expect(
      hasValidEnrollmentScope({
        ...validScope,
        recordOrganizationId: 'org-b',
      }),
    ).toBe(false);
  });

  it('rejects a current step from another sequence', () => {
    expect(
      hasValidEnrollmentScope({
        ...validScope,
        currentStepSequenceId: 'sequence-b',
      }),
    ).toBe(false);
  });

  it('rejects an enrollment whose sequence tenant cannot be established', () => {
    expect(
      hasValidEnrollmentScope({
        ...validScope,
        sequenceOrganizationId: null,
      }),
    ).toBe(false);
  });

  it('allows a deleted current step to reach the existing safe exit path', () => {
    expect(
      hasValidEnrollmentScope({
        ...validScope,
        currentStepSequenceId: null,
      }),
    ).toBe(true);
  });
});
