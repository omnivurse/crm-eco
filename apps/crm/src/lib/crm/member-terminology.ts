/**
 * Market-aware terminology for a converted / active person.
 *
 * "Member" fits health-sharing (they belong to a sharing community). Traditional
 * insurance clients are NOT members of anything shared, so calling them "Member"
 * conflates the two products. For insurance we say "Insurance Client".
 *
 * Display helpers never invent filters/cron behavior — stored values for the
 * insurance active status are canonicalized as "Active Insurance Client".
 * Legacy rows still stored as "Active Member" on insurance records are
 * relabeled on read.
 */

const INSURANCE_MARKETS = new Set(['traditional_insurance', 'insurance']);

export const ACTIVE_INSURANCE_CLIENT_STATUS = 'Active Insurance Client';

export function isInsuranceMarket(marketType?: string | null): boolean {
  return INSURANCE_MARKETS.has((marketType ?? '').trim().toLowerCase());
}

/**
 * Stored active-member statuses that should read as the insurance equivalent
 * when the record is an insurance-market record. Keyed by the exact stored
 * value → the insurance display label. Health-sharing statuses
 * (e.g. "Active HS Member") are intentionally absent so they keep their
 * community terminology.
 */
const INSURANCE_STATUS_RELABEL: Record<string, string> = {
  'Active Member': ACTIVE_INSURANCE_CLIENT_STATUS,
  Active: ACTIVE_INSURANCE_CLIENT_STATUS,
};

/**
 * Display label for a stored CRM status, relabeled for insurance records only.
 * Returns the status unchanged for non-insurance markets or statuses with no
 * insurance-specific term.
 */
export function relabelStatusForMarket(
  status?: string | null,
  marketType?: string | null,
): string {
  const s = (status ?? '').trim();
  if (isInsuranceMarket(marketType) && INSURANCE_STATUS_RELABEL[s]) {
    return INSURANCE_STATUS_RELABEL[s];
  }
  return s;
}

/** Convert-action button label, market-aware. */
export function getConvertActionLabel(marketType?: string | null): string {
  return isInsuranceMarket(marketType) ? 'Convert to Insurance Client' : 'Convert to Member';
}

/** Noun for the person, lowercase for use mid-sentence. */
export function getMemberNoun(marketType?: string | null): string {
  return isInsuranceMarket(marketType) ? 'insurance client' : 'member';
}

/** Title-cased noun for headings / menu items: "Member", "Insurance Client". */
export function getMemberNounTitle(marketType?: string | null): string {
  return getMemberNoun(marketType).replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The enrollment action label, market-aware: "Enroll as Member" / "Enroll as Insurance Client". */
export function getEnrollActionLabel(marketType?: string | null): string {
  return `Enroll as ${getMemberNounTitle(marketType)}`;
}

/** Core status options shown in the record header picker. */
export function getCoreStatusPickerItems(marketType?: string | null): string[] {
  if (isInsuranceMarket(marketType)) {
    return ['Active', ACTIVE_INSURANCE_CLIENT_STATUS, 'Inactive', 'In-Active', 'Pending', 'Hold'];
  }
  return [
    'Active',
    'Active HS Member',
    'Active Member',
    ACTIVE_INSURANCE_CLIENT_STATUS,
    'Inactive',
    'In-Active',
    'Pending',
    'Hold',
  ];
}

/** Whether a status should use the green "active coverage" badge styling. */
export function isActiveCoverageStatus(status?: string | null): boolean {
  const s = (status ?? '').trim();
  return (
    s === 'Active' ||
    s === 'Active HS Member' ||
    s === 'Active Member' ||
    s === ACTIVE_INSURANCE_CLIENT_STATUS ||
    s === 'Active DPC' ||
    s === 'Active ADVISOR'
  );
}
