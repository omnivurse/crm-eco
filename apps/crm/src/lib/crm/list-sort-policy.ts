/**
 * Columns whose list cell is an overlay (twin / resolved name) must not
 * advertise server sort — `getRecords` orders `data->>field`, which is not
 * what the cell shows.
 */

export const DISPLAY_ONLY_SORT_FIELDS = [
  'advisor_name',
  'normalized_advisor_name',
  'normalized_agent_name',
  'plan_name',
  'product',
  'effective_date',
  'sharing_effective_date',
  'owner_id',
] as const;

export function isDisplayOnlySortField(field: string): boolean {
  return (DISPLAY_ONLY_SORT_FIELDS as readonly string[]).includes(field);
}

export const DISPLAY_ONLY_SORT_HINT =
  'Sorted by stored value — turn off until display-sort exists';
