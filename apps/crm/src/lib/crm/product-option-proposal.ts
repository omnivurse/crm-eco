/**
 * Tier-A product/plan-name proposal seed for the picklist curation screen.
 *
 * Source: the production vocabulary census in
 * `scripts/e2e/product-options.proposed.json`, generated 2026-08-23 by
 * `scripts/audit-crm-product-vocabulary.mjs` against 16,284 live records
 * (68 raw spellings folded into 43 tier-A clusters of >= 10 records each).
 * The numbers here are a POINT-IN-TIME snapshot of that census — they exist
 * to justify each proposed option to the reviewer, not to stay live.
 *
 * The lean payload (value / label / order / count only — no raw spellings)
 * lives in `product-option-proposal.data.json` next to this file and is
 * bundled at build time; the running app never reads the census from disk.
 *
 * Nothing in this module writes anywhere. The UI uses `diffProposalAgainstOptions`
 * to offer "add the N names we found in your records that are not on the menu
 * yet" against a field's current `crm_fields.options`, without ever touching
 * options that are already present (active OR deactivated).
 */
import proposalData from './product-option-proposal.data.json';

/** One tier-A proposed picklist option, with the record count that justified it. */
export interface ProposedProductOption {
  value: string;
  label: string;
  display_order: number;
  count_total: number;
  count_by_module: { contacts?: number; leads?: number };
}

/** The crm_fields rows the proposal applies to (prod field ids, per the census). */
export interface ProposalFieldTarget {
  field_key: string;
  field_id: string;
}

/**
 * Structural subset of the wire `FieldOption` shape used by
 * `app/api/crm/field-options/route.ts` — only what the diff needs, so any
 * option object the API returns is accepted as-is.
 */
export interface CurrentFieldOptionLike {
  value: string;
  is_active?: boolean;
}

export interface ProposalDiff<T extends CurrentFieldOptionLike> {
  /** Proposal entries whose value already exists on the field (even deactivated). */
  alreadyPresent: Array<{ proposal: ProposedProductOption; current: T }>;
  /** Proposal entries not on the field yet — safe to offer as additions, in proposal order. */
  missing: ProposedProductOption[];
  /** Current options the census never saw — left strictly alone, listed for context. */
  extra: T[];
}

/** When the census snapshot was taken (ISO timestamp from the audit script). */
export const PRODUCT_PROPOSAL_CENSUS_DATE: string = proposalData.census_generated_at;

/** The fields this proposal targets: contacts.product and leads.product_type. */
export const PRODUCT_PROPOSAL_FIELDS: Readonly<Record<'contacts' | 'leads', ProposalFieldTarget>> =
  proposalData.fields;

/** The 43 tier-A proposed options, in census display order. */
export const PRODUCT_OPTION_PROPOSAL: readonly ProposedProductOption[] = proposalData.options;

/**
 * Match key for comparing a proposal value against a stored option value:
 * case-insensitive, trimmed, inner whitespace collapsed. Deliberately does
 * NOT strip punctuation — "Co-Pay Plan" and "Co-Pay Plan (GROUP)" are
 * distinct products.
 */
export function normalizeOptionValueKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Diff the tier-A proposal against a field's current options.
 *
 * - An option already on the field — including one that is merely
 *   deactivated (`is_active: false`) or spelled with different casing —
 *   lands in `alreadyPresent` and must never be re-added or overwritten.
 * - `missing` keeps the proposal's display order so the offer list is stable.
 * - `extra` is everything the client added that the census never saw; the
 *   diff reports it but proposes no action on it.
 *
 * Pure: never mutates `current` or the proposal.
 */
export function diffProposalAgainstOptions<T extends CurrentFieldOptionLike>(
  current: readonly T[],
  proposal: readonly ProposedProductOption[] = PRODUCT_OPTION_PROPOSAL
): ProposalDiff<T> {
  const currentByKey = new Map<string, T>();
  for (const option of current) {
    const key = normalizeOptionValueKey(option.value);
    if (key && !currentByKey.has(key)) currentByKey.set(key, option);
  }

  const alreadyPresent: Array<{ proposal: ProposedProductOption; current: T }> = [];
  const missing: ProposedProductOption[] = [];
  const matchedKeys = new Set<string>();

  for (const proposed of [...proposal].sort((a, b) => a.display_order - b.display_order)) {
    const key = normalizeOptionValueKey(proposed.value);
    const match = currentByKey.get(key);
    if (match) {
      alreadyPresent.push({ proposal: proposed, current: match });
      matchedKeys.add(key);
    } else {
      missing.push(proposed);
    }
  }

  const extra = current.filter((option) => !matchedKeys.has(normalizeOptionValueKey(option.value)));

  return { alreadyPresent, missing, extra };
}
