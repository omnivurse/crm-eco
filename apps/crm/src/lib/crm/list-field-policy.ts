/**
 * Which list columns are DISPLAY-ONLY — shown from a linked / resolved
 * source rather than from the value stored under `data->>key` — and must
 * therefore neither advertise server sort nor be offered as a filter.
 *
 * `getRecords` orders and filters `data->>field`; for these columns that is
 * not what the cell shows:
 *   - resolved ownership names (`advisor_name`, `normalized_*`, `owner_id`)
 *     come from `resolveOwnershipName` over several keys — every module;
 *   - the Members coverage columns (`plan_name`, `effective_date` and their
 *     aliases `product`, `sharing_effective_date`) are a blank-fill overlay
 *     of the Contacts twin (`projectMembersCoverageAliases`,
 *     lib/crm/resolve-record-twin) — so a members filter/sort on them would
 *     only match the rows that happen to store their own value (LS-4 / D11:
 *     disabled-with-reason now, a server-side twin view is a follow-up).
 *
 * Module-aware: `isDisplayOnlyListField('plan_name', 'members')` is true,
 * `('plan_name', 'contacts')` is false (contacts store their own plan). With
 * no module key the union applies (the pre-LS-4 behaviour of RecordTable).
 *
 * `list-sort-policy.ts` re-exports the old names as aliases.
 */

/** Display-only in EVERY module (resolved names / ownership). */
export const DISPLAY_ONLY_FIELDS_ALL_MODULES = [
  'advisor_name',
  'normalized_advisor_name',
  'normalized_agent_name',
  'owner_id',
] as const;

/** Display-only only inside the named module (twin overlays). */
export const DISPLAY_ONLY_FIELDS_BY_MODULE: Readonly<Record<string, readonly string[]>> = {
  members: ['plan_name', 'product', 'effective_date', 'sharing_effective_date'],
};

/** Every key that is display-only somewhere (the module-less fallback). */
export const DISPLAY_ONLY_LIST_FIELDS: readonly string[] = Array.from(
  new Set<string>([
    ...DISPLAY_ONLY_FIELDS_ALL_MODULES,
    ...Object.values(DISPLAY_ONLY_FIELDS_BY_MODULE).flat(),
  ]),
);

/**
 * True when the column's list cell is an overlay / resolved value, so it must
 * not be offered for server sort OR filter. Without `moduleKey` the union of
 * every module's display-only keys applies.
 */
export function isDisplayOnlyListField(field: string, moduleKey?: string | null): boolean {
  if ((DISPLAY_ONLY_FIELDS_ALL_MODULES as readonly string[]).includes(field)) return true;
  if (moduleKey === undefined || moduleKey === null || moduleKey === '') {
    return DISPLAY_ONLY_LIST_FIELDS.includes(field);
  }
  return DISPLAY_ONLY_FIELDS_BY_MODULE[moduleKey]?.includes(field) ?? false;
}

/**
 * User-voice reason shown on the disabled affordance (rail row `title`,
 * column header `title`, chips-bar menu). One sentence, no developer words.
 */
export const DISPLAY_ONLY_FIELD_HINT =
  'Shown from linked records — filtering and sorting by it is not available yet';

/** Short label rendered next to a display-only field in the filter rail. */
export const DISPLAY_ONLY_FIELD_BADGE = 'display only';
