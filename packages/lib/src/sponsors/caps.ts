export const DEPENDENT_RELATIONSHIPS = ['spouse', 'child'] as const;

export function isDependentRelationship(relationship?: string | null): boolean {
  const rel = (relationship ?? '').trim().toLowerCase();
  return rel === 'spouse' || rel === 'child' || rel === 'dependent';
}

export function maxDependentsAllowed(
  cap: number | null | undefined,
  employeeCount: number
): number | null {
  if (cap == null) return null;
  return cap * Math.max(1, employeeCount);
}

export function wouldExceedDependentCap(input: {
  cap: number | null | undefined;
  employeeCount: number;
  dependentCountAfter: number;
}): boolean {
  const max = maxDependentsAllowed(input.cap, input.employeeCount);
  if (max == null) return false;
  return input.dependentCountAfter > max;
}

export function canAttachAnotherPlan(input: {
  allowMultiplePlans: boolean;
  attachedCount: number;
}): boolean {
  if (input.allowMultiplePlans) return true;
  return input.attachedCount < 1;
}
