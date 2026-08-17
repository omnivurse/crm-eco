/**
 * ownership-name — resolve the "who enrolled / who owns" name for a CRM
 * record.
 *
 * The normalized columns (`normalized_advisor_name` / `normalized_agent_name`)
 * are only populated for records that went through the normalization pass;
 * native and enrollment-created contacts usually carry the enrolling advisor
 * in `data.producer` (or `producer_name`, `advisor`, `agent`, `lead_owner`,
 * ...). This helper applies a single precedence so every surface (hero
 * ownership display, snapshot bands, list columns) agrees.
 *
 * Pure module — no React, no Supabase.
 */

export type OwnershipNameSource =
  | 'normalized_advisor_name'
  | 'normalized_agent_name'
  | `data.${string}`;

export interface OwnershipNameResult {
  name: string | null;
  source: OwnershipNameSource | null;
}

export interface OwnershipRecordLike {
  market_type?: string | null;
  normalized_advisor_name?: string | null;
  normalized_agent_name?: string | null;
  data?: Record<string, unknown> | null;
}

/** `data` keys consulted, in precedence order, when no normalized name fits. */
export const OWNERSHIP_DATA_KEYS: readonly string[] = [
  'producer_name',
  'producer',
  'advisor_name',
  'advisor',
  'normalized_advisor_name',
  'agent',
  'normalized_agent_name',
  'lead_owner',
  'contact_owner',
];

const BLANK_VALUES = new Set(['', '-', '—', 'n/a', 'na', 'none', 'null', 'undefined']);

/** Trim and reject blank / placeholder values. */
export function cleanOwnershipValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (BLANK_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * Resolve the ownership name for a record.
 *
 * Precedence:
 *   1. market `healthshare`             → `normalized_advisor_name`
 *   2. market `traditional_insurance`   → `normalized_agent_name`
 *   3. unknown market                   → advisor, then agent normalized name
 *   4. fallbacks from `record.data` in `OWNERSHIP_DATA_KEYS` order
 *
 * Tolerates `record.data` being undefined/null (list rows without JSONB).
 */
export function resolveOwnershipName(
  record: OwnershipRecordLike | null | undefined,
): OwnershipNameResult {
  if (!record) return { name: null, source: null };

  const market = record.market_type || 'unknown';
  const advisor = cleanOwnershipValue(record.normalized_advisor_name);
  const agent = cleanOwnershipValue(record.normalized_agent_name);

  if (market === 'healthshare' && advisor) {
    return { name: advisor, source: 'normalized_advisor_name' };
  }
  if (market === 'traditional_insurance' && agent) {
    return { name: agent, source: 'normalized_agent_name' };
  }
  if (market !== 'healthshare' && market !== 'traditional_insurance') {
    if (advisor) return { name: advisor, source: 'normalized_advisor_name' };
    if (agent) return { name: agent, source: 'normalized_agent_name' };
  }

  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? record.data
      : null;
  if (data) {
    for (const key of OWNERSHIP_DATA_KEYS) {
      const value = cleanOwnershipValue(data[key]);
      if (value) return { name: value, source: `data.${key}` };
    }
  }

  return { name: null, source: null };
}
