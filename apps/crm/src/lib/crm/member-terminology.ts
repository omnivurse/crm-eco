/**
 * Market-aware terminology for a converted / active person.
 *
 * "Member" fits health-sharing (they belong to a sharing community). Traditional
 * insurance clients are NOT members of anything shared, so calling them "Member"
 * conflates the two products. For insurance we say "Insurance Client".
 *
 * This is DISPLAY-ONLY: it never changes stored `status` / `market_type` values,
 * so filters, tone mappings, the activation cron, and analytics are untouched.
 * Only the label a rep reads changes.
 */

const INSURANCE_MARKETS = new Set(['traditional_insurance', 'insurance']);

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
  'Active Member': 'Active Insurance Client',
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
