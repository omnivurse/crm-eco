/**
 * One allowlist for “this crm_records row is a person.”
 *
 * Three copies used to omit `history` (notes, coverage chrome, queue). History
 * is a person door — same UUID, different module — so notes / coverage / lanes
 * / search chips must treat it like Contacts. The working queue must not.
 */

export const PERSON_MODULE_KEYS = ['contacts', 'leads', 'members', 'history'] as const;
export type PersonModuleKey = (typeof PERSON_MODULE_KEYS)[number];

/** Contacts + History share one person. Members-module twins stay on members. */
export const ROSTER_IDENTITY_KEYS = ['contacts', 'history'] as const;
export type RosterIdentityKey = (typeof ROSTER_IDENTITY_KEYS)[number];

/** Every person-module door, including the members-source twin. */
export const PEOPLE_IDENTITY_KEYS = ['contacts', 'members', 'history'] as const;
export type PeopleIdentityKey = (typeof PEOPLE_IDENTITY_KEYS)[number];

/** Dashboard people / starting-soon surfaces. History is not a working queue. */
export const WORKING_QUEUE_MODULE_KEYS = ['contacts', 'members', 'leads'] as const;

/** Pending-activation lane. History never belongs here. */
export const PENDING_QUEUE_MODULE_KEYS = ['contacts', 'members'] as const;

export const HISTORICAL_STATUSES = ['Cancelled', 'Terminated', 'Deceased'] as const;
export type HistoricalStatus = (typeof HISTORICAL_STATUSES)[number];

/** Statuses that keep a person on the working Contacts list (or bounce History back). */
export const WORKING_OPEN_STATUSES = [
  'Active',
  'Inactive',
  'Pending',
  'In Process',
  'Prospect',
  'Lost',
  'Declined',
  'Abandoned',
] as const;
export type WorkingOpenStatus = (typeof WORKING_OPEN_STATUSES)[number];

export function normalizeModuleKey(moduleKey?: string | null): string {
  return (moduleKey || '').trim().toLowerCase();
}

export function isPersonModuleKey(moduleKey?: string | null): boolean {
  const key = normalizeModuleKey(moduleKey);
  if (!key) return false;
  return (PERSON_MODULE_KEYS as readonly string[]).includes(key);
}

export function isRosterIdentityKey(moduleKey?: string | null): boolean {
  return (ROSTER_IDENTITY_KEYS as readonly string[]).includes(normalizeModuleKey(moduleKey));
}

/** Create-import / monthly CSV for Contacts or History must search both doors. */
export function shouldExpandPeopleLookup(moduleKey?: string | null): boolean {
  return isRosterIdentityKey(moduleKey);
}

export function isHistoricalStatus(status?: string | null): boolean {
  if (!status) return false;
  return (HISTORICAL_STATUSES as readonly string[]).includes(status.trim());
}

export function isWorkingOpenStatus(status?: string | null): boolean {
  if (!status) return false;
  return (WORKING_OPEN_STATUSES as readonly string[]).includes(status.trim());
}

/** Admin `members` sync twins — never hop these onto History. */
export function isMembersSourceRow(system: unknown): boolean {
  if (!system || typeof system !== 'object' || Array.isArray(system)) return false;
  return (system as { source_table?: unknown }).source_table === 'members';
}
