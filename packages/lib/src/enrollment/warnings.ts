/**
 * Enrollment warning computation helpers
 * 
 * These helpers compute warning flags for enrollments based on
 * member state and age.
 */

// States with individual health insurance mandates
// These are states that have their own individual mandate penalties
const MANDATE_STATES = ['MA', 'NJ', 'DC', 'CA', 'RI', 'VT'];

/**
 * Check if a state has an individual health insurance mandate
 */
export function isMandateState(state: string | null | undefined): boolean {
  if (!state) return false;
  return MANDATE_STATES.includes(state.toUpperCase().trim());
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Check if member is 65 or older (Medicare eligible)
 */
export function isAge65OrOlder(dateOfBirth: string | null | undefined): boolean {
  const age = calculateAge(dateOfBirth);
  return age !== null && age >= 65;
}

export interface EnrollmentWarnings {
  has_mandate_warning: boolean;
  has_age65_warning: boolean;
}

/**
 * Compute all enrollment warnings for a member
 */
export function computeEnrollmentWarnings(
  state: string | null | undefined,
  dateOfBirth: string | null | undefined
): EnrollmentWarnings {
  return {
    has_mandate_warning: isMandateState(state),
    has_age65_warning: isAge65OrOlder(dateOfBirth),
  };
}

/**
 * Get warning messages for display
 */
export function getWarningMessages(warnings: EnrollmentWarnings): string[] {
  const messages: string[] = [];
  
  if (warnings.has_mandate_warning) {
    messages.push('This member resides in a state with an individual health insurance mandate. Healthshare plans may not satisfy the mandate requirement.');
  }
  
  if (warnings.has_age65_warning) {
    messages.push('This member is 65 or older and may be eligible for Medicare. Consider reviewing Medicare eligibility before proceeding.');
  }
  
  return messages;
}

