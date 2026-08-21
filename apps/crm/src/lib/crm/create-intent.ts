/**
 * CreateIntent — one decision for every "create a person" entry.
 *
 * Invariant: contacts / members / leads open the quick drawer; full form is
 * an explicit escape (`kind: 'full'`). Deal create is blocked when the org
 * has deals disabled.
 */

import {
  isQuickCreateModuleKey,
  type QuickCreateModuleKey,
} from '@/lib/crm/quick-create-config';

export type CreateIntent =
  | { kind: 'quick'; moduleKey: QuickCreateModuleKey }
  | { kind: 'full'; href: string }
  | { kind: 'blocked'; reason: 'deals-disabled' };

export function resolveCreateIntent(input: {
  moduleKey: string;
  dealsEnabled?: boolean;
}): CreateIntent {
  const key = input.moduleKey.trim().toLowerCase();
  if (key === 'deals' && input.dealsEnabled === false) {
    return { kind: 'blocked', reason: 'deals-disabled' };
  }
  if (key === 'members' || key === 'contacts') {
    return { kind: 'quick', moduleKey: 'contacts' };
  }
  if (isQuickCreateModuleKey(key)) {
    return { kind: 'quick', moduleKey: key };
  }
  return { kind: 'full', href: `/crm/modules/${encodeURIComponent(key)}/new` };
}
