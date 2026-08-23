/**
 * Sort-side aliases of `list-field-policy` (LS-4 widened the policy from
 * "no server sort" to "no server sort AND no filter"; the module-aware
 * predicate lives in list-field-policy.ts). Kept so existing imports
 * (RecordTable) keep compiling — new code should import list-field-policy.
 */

export {
  DISPLAY_ONLY_LIST_FIELDS as DISPLAY_ONLY_SORT_FIELDS,
  DISPLAY_ONLY_FIELD_HINT as DISPLAY_ONLY_SORT_HINT,
  isDisplayOnlyListField as isDisplayOnlySortField,
} from './list-field-policy';
