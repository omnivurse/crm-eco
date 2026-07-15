/**
 * Shared "why did this record match?" engine.
 *
 * Cross-record search (the ⌘K palette, the module spotlight, lookup pickers)
 * historically returned a row + a title and threw away *which field* produced
 * the hit — so a rep couldn't tell whether "555 0142" matched a mobile, a work
 * phone, or a member ID without opening the record. This module derives that
 * attribution: given a record (or a search-result row) and the query, it works
 * out which field(s) contain the terms, each field's human label + colour
 * category, and where to highlight inside the value.
 *
 * Pure + isomorphic on purpose: no React, no DOM. It runs server-side in
 * `/api/crm/search` (matches computed from the columns the RPC returns) and
 * client-side in the lookup pickers (matches computed from the returned rows).
 *
 * Colours live in `SEARCH_MATCH_COLORS` as full literal Tailwind class strings
 * so the JIT content scanner keeps them — never build these with interpolation.
 */

export type SearchFieldCategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'status'
  | 'address'
  | 'id'
  | 'date'
  | 'other';

export interface SearchFieldColor {
  /** Chip: the coloured field-name label. */
  chip: string;
  /** `<mark>`: the highlighted matched substring inside the value. */
  mark: string;
}

/**
 * Field-type colour system. Grouped by *kind* of field (not by module) so the
 * same hue means the same thing everywhere: teal=name, blue=email, green=phone,
 * amber=company, violet=status, cyan=address, indigo=id, rose=date, slate=other.
 */
export const SEARCH_MATCH_COLORS: Record<SearchFieldCategory, SearchFieldColor> = {
  name: {
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
    mark: 'bg-teal-200/70 text-teal-900 dark:bg-teal-400/30 dark:text-teal-50',
  },
  email: {
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    mark: 'bg-blue-200/70 text-blue-900 dark:bg-blue-400/30 dark:text-blue-50',
  },
  phone: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    mark: 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-400/30 dark:text-emerald-50',
  },
  company: {
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    mark: 'bg-amber-200/70 text-amber-900 dark:bg-amber-400/30 dark:text-amber-50',
  },
  status: {
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    mark: 'bg-violet-200/70 text-violet-900 dark:bg-violet-400/30 dark:text-violet-50',
  },
  address: {
    chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    mark: 'bg-cyan-200/70 text-cyan-900 dark:bg-cyan-400/30 dark:text-cyan-50',
  },
  id: {
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    mark: 'bg-indigo-200/70 text-indigo-900 dark:bg-indigo-400/30 dark:text-indigo-50',
  },
  date: {
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    mark: 'bg-rose-200/70 text-rose-900 dark:bg-rose-400/30 dark:text-rose-50',
  },
  other: {
    chip: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
    mark: 'bg-slate-200/80 text-slate-900 dark:bg-slate-400/30 dark:text-slate-50',
  },
};

/**
 * Classify a field into a colour category from its key (and label, if known).
 * Checks run most-specific first so `company_name` → company (not name) and
 * `member_number` → id (not name).
 */
export function categorizeSearchField(key: string, label?: string): SearchFieldCategory {
  const hay = `${key} ${label ?? ''}`.toLowerCase();
  const k = key.toLowerCase();
  const has = (...subs: string[]) => subs.some((s) => hay.includes(s));

  if (has('email', 'e-mail')) return 'email';
  if (has('phone', 'mobile', 'cell', 'fax', 'telephone')) return 'phone';
  if (
    k === 'id' ||
    k === 'record_id' ||
    has(
      'member_number',
      'member_id',
      'member number',
      'member id',
      'external_id',
      'account_number',
      'policy_number',
      'record id',
    )
  ) {
    return 'id';
  }
  if (has('company', 'account', 'employer', 'organization', 'organisation', 'business', 'group_name', 'group name')) {
    return 'company';
  }
  if (has('status', 'stage', 'lifecycle', 'pipeline', 'disposition')) return 'status';
  if (has('address', 'street', 'city', 'state', 'province', 'zip', 'postal', 'country', 'region')) {
    return 'address';
  }
  if (has('date', 'dob', 'birth', 'anniversary') || /_(at|on)$/.test(k)) return 'date';
  if (
    k === 'title' ||
    k === 'name' ||
    has(
      'first_name',
      'last_name',
      'full_name',
      'middle_name',
      'preferred_name',
      'contact_name',
      'display_name',
      'salutation',
      'nickname',
      'name',
    )
  ) {
    return 'name';
  }
  return 'other';
}

const KEY_LABELS: Record<string, string> = {
  title: 'Name',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  status: 'Status',
  stage: 'Stage',
  first_name: 'First name',
  last_name: 'Last name',
  middle_name: 'Middle name',
  preferred_name: 'Preferred name',
  full_name: 'Full name',
  contact_name: 'Contact name',
  company_name: 'Company',
  account_name: 'Account',
  member_number: 'Member ID',
  lead_status: 'Status',
  contact_status: 'Status',
  date_of_birth: 'Date of birth',
  dob: 'Date of birth',
  mobile: 'Mobile',
  work_phone: 'Work phone',
  home_phone: 'Home phone',
  zip: 'ZIP',
  zip_code: 'ZIP',
};

/** Human label for a field key when `crm_fields` labels aren't available. */
export function humanizeFieldKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export interface SearchMatchRange {
  /** Inclusive start offset in the value string. */
  start: number;
  /** Exclusive end offset in the value string. */
  end: number;
}

export interface RecordSearchMatch {
  fieldKey: string;
  label: string;
  category: SearchFieldCategory;
  /** Display value (truncated for very long fields). */
  value: string;
  /** Highlight ranges within `value` (empty ⇒ matched via phone-digit fallback). */
  ranges: SearchMatchRange[];
}

/** Minimal record shape the matcher understands — a full CrmRecord satisfies it. */
export interface SearchMatchRecordInput {
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  stage?: string | null;
  data?: Record<string, unknown> | null;
}

export interface GetRecordSearchMatchesOptions {
  /** Field key → human label (from `crm_fields`). Falls back to humanized keys. */
  fieldLabels?: Record<string, string>;
  /** Max chips to return (default 4). */
  maxMatches?: number;
}

/** Internal, non-user-facing data keys that should never become a chip. */
const IGNORED_DATA_KEYS = new Set([
  'is_converted',
  'converted_contact_id',
  'converted_from_lead_id',
  'converted_account_id',
  'converted_deal_id',
  'id',
  'org_id',
  'organization_id',
  'module_id',
  'owner_id',
  'advisor_id',
  'created_at',
  'updated_at',
  'search',
]);

const MAX_VALUE_LEN = 120;
/** Lead-in context kept before the match when a long value is windowed. */
const SNIPPET_CONTEXT = 24;

/**
 * Fields that are literally components of a person's own name. Only these get
 * collapsed against a broader same-category match (so "John" (first_name) is
 * dropped under the title "John Smith"), while genuinely distinct name-like
 * fields — e.g. a small-group lead's point-of-contact `contact_name` — survive.
 */
const NAME_PART_KEYS = new Set([
  'first_name',
  'last_name',
  'middle_name',
  'preferred_name',
  'full_name',
  'salutation',
  'name',
]);

/** Category display order — controls which chips survive truncation. */
const CATEGORY_PRIORITY: SearchFieldCategory[] = [
  'name',
  'id',
  'email',
  'phone',
  'company',
  'status',
  'address',
  'date',
  'other',
];

function stringifyValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(stringifyValue).filter(Boolean).join(', ');
  return ''; // nested objects aren't meaningfully searchable in a chip
}

function normalizeQueryTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 1);
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Merged, non-overlapping [start,end) ranges where any term appears in `text`. */
function findRanges(text: string, terms: string[]): SearchMatchRange[] {
  const lower = text.toLowerCase();
  const raw: SearchMatchRange[] = [];
  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    for (;;) {
      const i = lower.indexOf(term, from);
      if (i === -1) break;
      raw.push({ start: i, end: i + term.length });
      from = i + term.length;
    }
  }
  if (raw.length === 0) return [];
  raw.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: SearchMatchRange[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** Highlight ranges for a raw (unsplit) query — used to highlight titles. */
export function findQueryRanges(text: string, query: string): SearchMatchRange[] {
  return findRanges(text, normalizeQueryTerms(query));
}

/**
 * Keep a value within MAX_VALUE_LEN by taking a window centred on the first
 * match (so the highlight is always visible, not truncated off the end) and
 * rebasing the ranges onto the windowed string. Ranges are computed against the
 * full value, so they MUST be rebased here — never store full-value ranges
 * against a sliced value.
 */
function windowValueToRanges(
  value: string,
  ranges: SearchMatchRange[],
): { value: string; ranges: SearchMatchRange[] } {
  if (value.length <= MAX_VALUE_LEN) return { value, ranges };

  const firstStart = ranges.length > 0 ? ranges[0].start : 0;
  let winStart = Math.max(0, firstStart - SNIPPET_CONTEXT);
  let winEnd = winStart + MAX_VALUE_LEN;
  if (winEnd > value.length) {
    winEnd = value.length;
    winStart = Math.max(0, winEnd - MAX_VALUE_LEN);
  }

  const prefix = winStart > 0 ? '…' : '';
  const suffix = winEnd < value.length ? '…' : '';
  const windowed = `${prefix}${value.slice(winStart, winEnd)}${suffix}`;
  // Map an original offset i∈[winStart,winEnd] to the windowed string.
  const offset = prefix.length - winStart;

  const rebased: SearchMatchRange[] = [];
  for (const r of ranges) {
    const start = Math.max(r.start, winStart);
    const end = Math.min(r.end, winEnd);
    if (end <= start) continue; // range falls outside the window
    rebased.push({ start: start + offset, end: end + offset });
  }
  return { value: windowed, ranges: rebased };
}

/**
 * Work out which of a record's fields matched the query. Returns colour-coded,
 * labelled, highlight-ready matches ordered by field-category priority.
 */
export function getRecordSearchMatches(
  record: SearchMatchRecordInput,
  query: string,
  opts: GetRecordSearchMatchesOptions = {},
): RecordSearchMatch[] {
  const terms = normalizeQueryTerms(query);
  if (terms.length === 0) return [];

  const maxMatches = opts.maxMatches ?? 4;
  const labels = opts.fieldLabels ?? {};
  // Terms that look like a full phone/id → also try a digit-normalized match so
  // "5550142" matches a stored "(555) 0142". Require ≥7 digits (confident phone
  // length): shorter numeric fragments (years, ZIPs, small counts) still match
  // literally via findRanges, so this only guards against spurious attribution.
  const digitTerms = terms.map(digitsOnly).filter((d) => d.length >= 7);

  const seenKeys = new Set<string>();
  const matches: RecordSearchMatch[] = [];

  const consider = (key: string, rawValue: unknown) => {
    if (seenKeys.has(key)) return;
    const value = stringifyValue(rawValue);
    if (!value.trim()) return;

    const label = labels[key] ?? humanizeFieldKey(key);
    const category = categorizeSearchField(key, label);

    let ranges = findRanges(value, terms);
    let matched = ranges.length > 0;

    if (!matched && digitTerms.length > 0 && (category === 'phone' || category === 'id')) {
      const valDigits = digitsOnly(value);
      matched = digitTerms.some((d) => valDigits.includes(d));
      // Digit positions don't map cleanly back to the formatted string, so leave
      // ranges empty — the chip still names the field, the value renders plain.
      if (matched) ranges = [];
    }
    if (!matched) return;

    // Collapse name-part duplication only: skip a name component (first_name,
    // last_name, …) whose value is already contained in a kept name match (e.g.
    // first_name "John" under the title "John Smith"). Distinct name-like fields
    // such as a point-of-contact `contact_name` are NOT collapsed.
    if (NAME_PART_KEYS.has(key)) {
      const valueLower = value.toLowerCase();
      const redundant = matches.some(
        (m) => m.category === 'name' && m.value.toLowerCase().includes(valueLower),
      );
      if (redundant) return;
    }

    seenKeys.add(key);
    const windowed = windowValueToRanges(value, ranges);
    matches.push({
      fieldKey: key,
      label,
      category,
      value: windowed.value,
      ranges: windowed.ranges,
    });
  };

  // Core mirrored columns first (title/email/phone are the most complete forms).
  consider('title', record.title);
  consider('email', record.email);
  consider('phone', record.phone);
  consider('status', record.status);
  consider('stage', record.stage);

  const data = record.data ?? {};
  for (const [key, val] of Object.entries(data)) {
    if (IGNORED_DATA_KEYS.has(key)) continue;
    consider(key, val);
  }

  matches.sort(
    (a, b) => CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category),
  );
  return matches.slice(0, maxMatches);
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** Split a value into plain/highlighted segments for rendering. */
export function toHighlightSegments(value: string, ranges: SearchMatchRange[]): HighlightSegment[] {
  if (!ranges || ranges.length === 0) return [{ text: value, match: false }];
  const segs: HighlightSegment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    const start = Math.max(0, Math.min(r.start, value.length));
    const end = Math.max(start, Math.min(r.end, value.length));
    if (start > cursor) segs.push({ text: value.slice(cursor, start), match: false });
    if (end > start) segs.push({ text: value.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < value.length) segs.push({ text: value.slice(cursor), match: false });
  return segs;
}
