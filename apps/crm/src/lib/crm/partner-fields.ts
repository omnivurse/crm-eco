/**
 * Partner tracking — the pure rules behind the `partner` field section.
 *
 * PIFH works with two different kinds of partner and the CRM had a word for
 * neither, so both were being typed into free text (`partners`, `referral_source`,
 * `referring_member`) and lost:
 *
 *   Partner            an organization PIFH contracts WITH to deliver services to
 *                      members — MEC, virtual care / telehealth, a DPC clinic,
 *                      pharmacy, labs. They serve our members.
 *   Referring Partner  a professional or organization in ANOTHER field who sends
 *                      us business — an insurance agent in a different line, a
 *                      financial advisor, a CPA, a trainer, a chamber or
 *                      association. They send us members.
 *
 * Both are values of the existing `relationship_type` picklist (section `main`),
 * so no new "kind of record" concept is introduced — a partner is still a
 * contact/lead/member, tagged.
 *
 * `partner_industry` is the reporting dimension: it is what "which industries
 * generate the most referrals?" groups by. It is a curated picklist, so the
 * owner grows the list in Settings → Dropdown lists without a deploy.
 *
 * WHY the visibility gate: these fields are defined on all three person modules,
 * but only ~0.5% of records are partners. Without a gate every one of the 15,627
 * blank-relationship contacts would carry an empty "Partner Details" card in the
 * edit form. Same shape as {@link shouldShowAddressFieldInForm} /
 * {@link shouldShowOwnershipFieldInForm}: pure, value-driven, and it NEVER hides
 * a field that already holds data — a mis-tagged record must not swallow its own
 * partner details.
 */

/** Values of `relationship_type` that mark the record as a partner of some kind. */
export const PARTNER_RELATIONSHIP_VALUES = ['Partner', 'Referring Partner'] as const;

/** The picklist field that decides whether the partner section applies. */
export const RELATIONSHIP_TYPE_KEY = 'relationship_type';

/** User-facing label for `relationship_type` and the legacy `relationships` card. */
export const PARTNER_TYPE_LABEL = 'Partner Type';

/** `crm_fields.section` slug the partner fields live in. */
export const PARTNER_SECTION_KEY = 'partner';

/** Heading the section renders under (also written into `crm_layouts`). */
export const PARTNER_SECTION_LABEL = 'Partner Details';

/** Every field key that belongs to the partner section. */
export const PARTNER_FIELD_KEYS = [
  'partner_industry',
  'partner_services',
  'partner_since',
] as const;

const PARTNER_FIELD_KEY_SET: ReadonlySet<string> = new Set(PARTNER_FIELD_KEYS);

/** Trim + collapse inner whitespace + lowercase, so " referring  partner " matches. */
function normalize(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const PARTNER_VALUE_SET: ReadonlySet<string> = new Set(
  PARTNER_RELATIONSHIP_VALUES.map(normalize),
);

/** True when `relationship_type` marks this record as a Partner / Referring Partner. */
export function isPartnerRelationshipValue(value: unknown): boolean {
  const key = normalize(value);
  return key !== '' && PARTNER_VALUE_SET.has(key);
}

/** True when the field key is one of the partner-section fields. */
export function isPartnerFieldKey(fieldKey: string): boolean {
  return PARTNER_FIELD_KEY_SET.has(fieldKey);
}

/** A value counts as present for "never hide stored data" purposes. */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export interface PartnerFieldVisibilityArgs {
  fieldKey: string;
  /** Merged record values (JSONB `data` overlaid with indexed columns). */
  values?: Record<string, unknown> | null;
}

/**
 * Whether a field should render in the record form / section nav.
 *
 * Non-partner fields are always shown — this helper only ever narrows the
 * partner section. A partner field shows when the record is tagged as a partner,
 * OR when that specific field already holds a value.
 */
export function shouldShowPartnerFieldInForm({
  fieldKey,
  values,
}: PartnerFieldVisibilityArgs): boolean {
  if (!isPartnerFieldKey(fieldKey)) return true;
  const data = values && typeof values === 'object' ? values : {};
  if (isPopulated(data[fieldKey])) return true;
  return isPartnerRelationshipValue(data[RELATIONSHIP_TYPE_KEY]);
}
