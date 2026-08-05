/**
 * Smart Import mapping engine.
 *
 * Turns raw CSV headers (typically a Zoho CRM export) into confident
 * column → CRM-field mappings, and guesses the most likely target module,
 * WITHOUT requiring an LLM. An optional AI pass (see the smart-map API route)
 * only fills the gaps this deterministic engine leaves behind, so Smart Import
 * always works — even with no `OPENAI_API_KEY`.
 *
 * Zoho quirks handled here:
 *   - Module-prefixed labels ("Contact Owner", "Lead Source", "Account Name").
 *   - Address prefixes ("Mailing Street", "Other Zip").
 *   - Punctuation / spacing / case noise ("MPB Referral Fee", "Date of Birth").
 *   - System export columns ("Record Id", "Modified Time", "Tag", "Layout").
 */

import type { CrmField } from '@/lib/crm/types';
import { CONTACTS_FIELD_MAPPING } from '@/lib/imports/contacts-mapping';

export interface SmartMapping {
  sourceColumn: string;
  /** Target CRM field key, or null when we could not confidently map it. */
  targetField: string | null;
  /** 0..1 — how sure we are. Used to badge/sort the review UI. */
  confidence: number;
  /** True when confidence cleared the auto-map threshold. */
  autoMapped: boolean;
  /** Short human explanation (exact/alias/label/fuzzy) for the review UI. */
  reason: string;
}

export interface ModuleDetection {
  /** Best-guess module key among the ones supplied, or null if none scored. */
  moduleKey: string | null;
  confidence: number;
  /** Per-module raw signal scores (for debugging / display). */
  scores: Record<string, number>;
}

const AUTO_MAP_THRESHOLD = 0.6;

/** Lowercase, collapse all non-alphanumerics to single spaces, trim. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Normalize to a snake_case-ish key ("Mailing Zip" → "mailing_zip"). */
function normalizeKey(s: string): string {
  return normalizeLabel(s).replace(/\s+/g, '_');
}

/**
 * Zoho-label → crmKey alias index, seeded from the curated CONTACTS mapping
 * (161 real Zoho column names) plus hand-added cross-module synonyms. Keys are
 * normalized labels so lookups are punctuation/case-insensitive.
 */
const ALIAS_INDEX: Map<string, string> = (() => {
  const idx = new Map<string, string>();
  for (const m of CONTACTS_FIELD_MAPPING) {
    idx.set(normalizeLabel(m.csvColumn), m.crmKey);
  }
  // Cross-module + common-synonym aliases not covered by the contacts sheet.
  const extra: Record<string, string> = {
    'full name': 'contact_name',
    'name': 'contact_name',
    'e mail': 'email',
    'email address': 'email',
    'primary email': 'email',
    'secondary email': 'secondary_email',
    'mobile phone': 'mobile',
    'cell': 'mobile',
    'cell phone': 'mobile',
    'work phone': 'phone',
    'telephone': 'phone',
    'dob': 'date_of_birth',
    'birthdate': 'date_of_birth',
    'birth date': 'date_of_birth',
    'birthday': 'date_of_birth',
    'street': 'mailing_street',
    'address': 'mailing_street',
    'street address': 'mailing_street',
    'city': 'mailing_city',
    'state': 'mailing_state',
    'province': 'mailing_state',
    'zip': 'mailing_zip',
    'zip code': 'mailing_zip',
    'postal code': 'mailing_zip',
    'county': 'county',
    'country': 'mailing_country',
    'lead owner': 'owner',
    'contact owner': 'owner',
    'account owner': 'owner',
    'record owner': 'owner',
    'owner': 'owner',
    'source': 'lead_source',
    'lead source': 'lead_source',
    'status': 'status',
    'lead status': 'lead_status',
    'contact status': 'contact_status',
    'company': 'company',
    'account name': 'account_name',
    'deal name': 'deal_name',
    'amount': 'amount',
    'closing date': 'closing_date',
    'stage': 'stage',
    'notes': 'notes',
    'description': 'description',
    'referred by': 'referring_member',
    'referring member': 'referring_member',
  };
  for (const [alias, key] of Object.entries(extra)) {
    if (!idx.has(alias)) idx.set(alias, key);
  }
  return idx;
})();

/**
 * Zoho system/export columns that should never map to a data field. Matching
 * one yields an explicit "skip" so the review UI doesn't try to fuzzy-force it.
 */
const SYSTEM_COLUMN_PATTERNS: RegExp[] = [
  /^record id$/,
  /^(contact|lead|account|deal) id$/,
  /^id$/,
  /^(created|modified) (time|by)$/,
  /^last activity time$/,
  /^layout$/,
  /^locked$/,
  /^tag$/,
  /^unsubscribed (mode|time)$/,
  /^change log time$/,
  /^data (source|source details)$/,
];

function isSystemColumn(header: string): boolean {
  const n = normalizeLabel(header);
  return SYSTEM_COLUMN_PATTERNS.some((re) => re.test(n));
}

/** Tokens of a string as a Set (for Jaccard similarity). */
function tokens(s: string): Set<string> {
  return new Set(normalizeLabel(s).split(' ').filter(Boolean));
}

/** Token-set (Jaccard) similarity, 0..1. */
function tokenSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface FieldMatch {
  field: CrmField;
  confidence: number;
  reason: string;
}

/** Best field for a single header, or null. */
function bestFieldForHeader(
  header: string,
  fields: CrmField[],
  byKey: Map<string, CrmField>,
): FieldMatch | null {
  const nLabel = normalizeLabel(header);
  const nKey = normalizeKey(header);

  // 1) Exact key match.
  const keyHit = byKey.get(nKey);
  if (keyHit) return { field: keyHit, confidence: 1, reason: 'exact key' };

  // 2) Exact label match.
  const labelHit = fields.find((f) => normalizeLabel(f.label) === nLabel);
  if (labelHit) return { field: labelHit, confidence: 0.97, reason: 'exact label' };

  // 3) Zoho alias → crmKey (only if that key exists on this module).
  const aliasKey = ALIAS_INDEX.get(nLabel);
  if (aliasKey) {
    const aliasField = byKey.get(aliasKey);
    if (aliasField) {
      return { field: aliasField, confidence: 0.92, reason: 'Zoho alias' };
    }
  }

  // 4) Fuzzy token similarity against key + label; keep the strongest.
  let best: FieldMatch | null = null;
  for (const f of fields) {
    const sim = Math.max(
      tokenSimilarity(header, f.label),
      tokenSimilarity(header, f.key),
    );
    if (sim > 0 && (!best || sim > best.confidence)) {
      best = { field: f, confidence: sim, reason: 'fuzzy match' };
    }
  }
  return best && best.confidence >= 0.34 ? best : null;
}

/**
 * Produce column → field mappings for a set of headers against one module's
 * fields. Resolves conflicts (two headers → one field) in favour of the
 * higher-confidence header; the loser is left unmapped for manual review.
 */
export function suggestSmartMappings(
  headers: string[],
  fields: CrmField[],
): SmartMapping[] {
  const byKey = new Map<string, CrmField>();
  for (const f of fields) byKey.set(normalizeKey(f.key), f);

  // First pass: best candidate per header.
  const draft: SmartMapping[] = headers.map((header) => {
    if (isSystemColumn(header)) {
      return {
        sourceColumn: header,
        targetField: null,
        confidence: 0,
        autoMapped: false,
        reason: 'system column',
      };
    }
    const match = bestFieldForHeader(header, fields, byKey);
    if (!match) {
      return {
        sourceColumn: header,
        targetField: null,
        confidence: 0,
        autoMapped: false,
        reason: 'no match',
      };
    }
    return {
      sourceColumn: header,
      targetField: match.field.key,
      confidence: Number(match.confidence.toFixed(2)),
      autoMapped: match.confidence >= AUTO_MAP_THRESHOLD,
      reason: match.reason,
    };
  });

  // Second pass: dedupe target fields — highest confidence wins, drop the rest.
  const bestByTarget = new Map<string, number>();
  for (const m of draft) {
    if (!m.targetField) continue;
    const prev = bestByTarget.get(m.targetField);
    if (prev === undefined || m.confidence > prev) {
      bestByTarget.set(m.targetField, m.confidence);
    }
  }
  const claimed = new Set<string>();
  for (const m of draft) {
    if (!m.targetField) continue;
    const isBest = bestByTarget.get(m.targetField) === m.confidence;
    if (isBest && !claimed.has(m.targetField)) {
      claimed.add(m.targetField);
    } else {
      // A stronger header already owns this field.
      m.targetField = null;
      m.autoMapped = false;
      m.reason = 'duplicate of a stronger column';
      m.confidence = 0;
    }
  }

  return draft;
}

/** Module-detection signals keyed by module key. */
const MODULE_SIGNALS: Record<string, { strong: RegExp[]; weak: RegExp[] }> = {
  deals: {
    strong: [/^deal name$/, /^amount$/, /^closing date$/, /^pipeline$/, /^stage$/],
    weak: [/^contact name$/, /^account name$/, /probability/],
  },
  accounts: {
    strong: [/^account name$/, /^account site$/, /annual revenue/, /^industry$/],
    weak: [/^phone$/, /^website$/, /employees/],
  },
  leads: {
    strong: [/^lead status$/, /^lead source$/, /^lead owner$/, /converted/, /^company$/],
    weak: [/^first name$/, /^last name$/, /^email$/],
  },
  contacts: {
    strong: [
      /^contact name$/,
      /^contact owner$/,
      /^mailing (street|city|state|zip)$/,
      /date of birth/,
      /^member/,
      /sharing entity/,
      /health (share|insurance)/,
    ],
    weak: [/^first name$/, /^last name$/, /^email$/, /^phone$/, /salutation/],
  },
};

/**
 * Guess the target module from headers. Only considers `availableModuleKeys`
 * (the org's actual modules); falls back to the first available module — or
 * `contacts` if present — when no signal fires.
 */
export function detectModule(
  headers: string[],
  availableModuleKeys: string[],
): ModuleDetection {
  const normHeaders = headers.map(normalizeLabel);
  const scores: Record<string, number> = {};

  for (const key of availableModuleKeys) {
    const sig = MODULE_SIGNALS[key];
    if (!sig) {
      scores[key] = 0;
      continue;
    }
    let score = 0;
    for (const h of normHeaders) {
      if (sig.strong.some((re) => re.test(h))) score += 3;
      else if (sig.weak.some((re) => re.test(h))) score += 1;
    }
    scores[key] = score;
  }

  let bestKey: string | null = null;
  let bestScore = 0;
  let total = 0;
  for (const [key, score] of Object.entries(scores)) {
    total += score;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (!bestKey || bestScore === 0) {
    // No signal — prefer contacts, else the first available module.
    const fallback = availableModuleKeys.includes('contacts')
      ? 'contacts'
      : availableModuleKeys[0] ?? null;
    return { moduleKey: fallback, confidence: fallback ? 0.3 : 0, scores };
  }

  // Confidence = winner's share of total signal, floored so a clear winner
  // still reads as confident even when a runner-up shares generic fields.
  const share = total > 0 ? bestScore / total : 0;
  const confidence = Math.min(1, Math.max(0.5, share));
  return { moduleKey: bestKey, confidence: Number(confidence.toFixed(2)), scores };
}
