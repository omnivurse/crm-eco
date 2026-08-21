/**
 * Legacy key projection — general (non-health-share) families.
 *
 * WHY THIS EXISTS
 * The CRM detail form, list columns, in-record search and CSV export all render
 * exactly the keys that have a `crm_fields` definition for the record's module
 * (see DynamicRecordForm `visibleFields`). A Zoho-era value stored under a
 * legacy key that has no definition is therefore invisible everywhere — the
 * data is in the database, it just has no slot on screen.
 *
 * Two remedies exist, and picking the right one per key matters:
 *   PROJECT (here) — the legacy key and a DEFINED canonical key mean exactly
 *     the same thing (`city` vs `mailing_city`). Copy legacy → canonical when
 *     canonical is blank, so the value lands in the slot the layout already
 *     positions correctly.
 *   DEFINE (migration) — the legacy key is its OWN concept (`birth_month`,
 *     `middle_initial`, `phone2`, `do_not_call`). It gets a real crm_fields row
 *     instead. Projecting these into a similarly-named canonical field would
 *     mangle meaning (a birth MONTH is not a date of birth), so we never do.
 *
 * Health-share coverage keys are NOT handled here — `lead-contact-sharing-fields`
 * already owns that family (sharing_entity / sharing_member_id /
 * sharing_effective_date / monthly_contribution / sharing_status) with the
 * insurance-vs-ministry guards it needs. This module is the general complement;
 * both are invoked from the single seam `mergeCrmRecordRowIntoFormDefaults`.
 *
 * Direction is per-module and is NOT symmetric: contacts define `mailing_city`
 * and store legacy `city`; leads define `city` and store legacy `mailing_city`.
 * Street is the same split: contacts canonical is `mailing_street` (Zoho);
 * leads canonical is `street`; members canonical is `address_line1` (E123).
 * The table below encodes the real prod shape, verified against live crm_fields.
 */

// No cycle: coverage-snapshot-plan-fields → premium-field-aliases only.
import { isCapacityProductValue } from './coverage-snapshot-plan-fields';

/** canonical key → legacy keys that carry the same meaning, in priority order. */
export type LegacyAliasTable = Record<string, readonly string[]>;

/**
 * Contacts: layout defines the `mailing_*` address family, while Zoho wrote the
 * plain names. Gender arrived as `primary_member_gender`.
 */
const CONTACTS_ALIASES: LegacyAliasTable = {
  gender: ['primary_member_gender'],
  mailing_city: ['city'],
  mailing_state: ['state'],
  mailing_zip: ['zip_code', 'postal_code'],
  mailing_street: ['street', 'address_line1'],
  company: ['company_name'],
  secondary_email: ['email2'],
  referral_source: ['referral'],
  lead_source: ['source'],
};

/** Leads: mirror image of contacts — the plain names are the defined ones. */
const LEADS_ALIASES: LegacyAliasTable = {
  street: ['mailing_street', 'address_line1'],
  city: ['mailing_city'],
  state: ['mailing_state'],
  zip_code: ['mailing_zip', 'postal_code'],
  company: ['company_name'],
  secondary_email: ['email2'],
  lead_source: ['source'],
};

/**
 * Members coverage columns that mean the same thing as a key the row (or its
 * Contacts twin, once overlaid) carries under a legacy / health-share name.
 * Verified against live PIF-ECO-V2 crm_fields: members define `plan_name`
 * ("Plan") and `effective_date` ("Effective Date") with a 0/1,060 fill, while
 * the same person's Contacts twin carries `product` / `plan` and
 * `sharing_effective_date` / `start_date`.
 *
 * Shared by the members DETAIL page (via `projectLegacyKeys`) and the members
 * LIST (via `projectMembersCoverageAliases` in resolve-record-twin) so the two
 * surfaces can never disagree on what "Plan" / "Effective Date" show.
 *
 * `referral` is deliberately NOT aliased to `referring_member`: on members it
 * is a Yes/No flag, on contacts `referring_member` is a person's name.
 */
export const MEMBERS_COVERAGE_ALIASES: LegacyAliasTable = {
  plan_name: ['product', 'plan'],
  effective_date: ['sharing_effective_date', 'start_date'],
};

/**
 * Members: the address family is already defined with plain names, so only the
 * same-meaning strays need projecting — plus the coverage columns above.
 */
const MEMBERS_ALIASES: LegacyAliasTable = {
  gender: ['primary_member_gender'],
  address_line1: ['mailing_street', 'street'],
  city: ['mailing_city'],
  state: ['mailing_state'],
  zip_code: ['mailing_zip', 'postal_code'],
  ...MEMBERS_COVERAGE_ALIASES,
};

export const LEGACY_ALIASES_BY_MODULE: Record<string, LegacyAliasTable> = {
  contacts: CONTACTS_ALIASES,
  leads: LEADS_ALIASES,
  members: MEMBERS_ALIASES,
};

/**
 * Per-canonical reject predicates: an alias VALUE that must not be projected
 * even though it is non-blank (the next alias is tried instead). Legacy
 * `product` frequently holds a coverage TYPE ("Health Sharing" /
 * "Health Insurance") rather than a plan name — surfacing that as "Plan" on
 * the members page would be wrong. Minimal by design: only `plan_name` today.
 */
export const LEGACY_ALIAS_REJECTS_BY_MODULE: Record<
  string,
  Record<string, (value: unknown) => boolean>
> = {
  members: { plan_name: isCapacityProductValue },
};

/**
 * Legacy keys that must NEVER be projected onto a similarly-named canonical
 * field because they carry a different meaning. These are made visible by
 * giving them their own crm_fields definition instead (see the
 * `crm_legacy_field_definitions` migration). Listed explicitly so the
 * regression gate can assert every known legacy key is covered by exactly one
 * remedy — projection or definition — and none silently falls through.
 */
export const DEFINE_ONLY_LEGACY_KEYS: Record<string, readonly string[]> = {
  contacts: [
    'do_not_call',
    'advisor_code',
    'advisor_name',
    'cancellation_reason',
    'address_line2',
    'birth_month',
    'middle_initial',
    'phone2',
    'member_number',
    'internal_id',
    'producer_id',
    'scheduled_cancel_end_date',
  ],
  members: ['do_not_call', 'referral', 'source', 'company_name', 'phone2', 'email2', 'internal_id', 'advisor_id'],
  leads: ['producer_name', 'producer_id', 'advisor', 'agent'],
  advisors: [
    'advisor_code',
    'first_name',
    'last_name',
    'agent_role',
    'enrollment_code',
    'agency_name',
    'license_number',
    'commission_tier',
  ],
};

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Fill defined canonical keys from same-meaning legacy keys, in place.
 *
 * Never overwrites a populated canonical value, so a rep's own edit always wins
 * and the function is safe to run repeatedly on the same object.
 */
export function projectLegacyKeys(
  base: Record<string, unknown>,
  moduleKey?: string | null,
): void {
  if (!moduleKey) return;
  const table = LEGACY_ALIASES_BY_MODULE[moduleKey];
  if (!table) return;

  const rejects = LEGACY_ALIAS_REJECTS_BY_MODULE[moduleKey];
  for (const [canonicalKey, legacyKeys] of Object.entries(table)) {
    if (!isBlank(base[canonicalKey])) continue;
    const reject = rejects?.[canonicalKey];
    for (const legacyKey of legacyKeys) {
      const value = base[legacyKey];
      if (isBlank(value)) continue;
      if (reject?.(value)) continue;
      base[canonicalKey] = value;
      break;
    }
  }
}

/** Every legacy key this module projects, for the regression gate. */
export function projectedLegacyKeysFor(moduleKey: string): string[] {
  const table = LEGACY_ALIASES_BY_MODULE[moduleKey];
  if (!table) return [];
  return [...new Set(Object.values(table).flat())];
}
