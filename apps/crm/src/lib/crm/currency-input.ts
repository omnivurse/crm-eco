/** Helpers for USD currency fields (2 decimal places). */

export const CURRENCY_INPUT_STEP = '0.01';
export const CURRENCY_DECIMAL_PLACES = 2;

/** Field keys that store dollar amounts even when CRM type is `number`. */
const MONETARY_FIELD_KEY_RE =
  /(?:^|_)(premium|amount|contribution|deductible|oop|cost|price|fee|rate|share|iua|moop|copay|coinsurance|billing)(?:_|$)/i;

export function isMonetaryFieldKey(key: string): boolean {
  return MONETARY_FIELD_KEY_RE.test(key);
}

/** True when the field should accept cents (e.g. $390.01). */
export function fieldUsesDecimalMoney(field: {
  type: string;
  key: string;
}): boolean {
  return field.type === 'currency' || (field.type === 'number' && isMonetaryFieldKey(field.key));
}

const CURRENCY_TYPING_RE = /^\d*(\.\d{0,2})?$/;

/** Strip currency formatting so pasted values like "$1,234.56" can be parsed. */
export function sanitizeCurrencyInput(raw: string): string {
  return raw.trim().replace(/[$,\s]/g, '');
}

/** True while the user is typing a partial currency value (e.g. "12." or "12.3"). */
export function isValidCurrencyTyping(raw: string): boolean {
  const sanitized = sanitizeCurrencyInput(raw);
  if (sanitized === '') return true;
  return CURRENCY_TYPING_RE.test(sanitized);
}

/** Parse and round to cents; returns null for blank/invalid input. */
export function parseCurrencyInput(raw: string): number | null {
  const sanitized = sanitizeCurrencyInput(raw);
  if (sanitized === '') return null;
  const n = Number(sanitized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Display value for a controlled currency input. */
export function formatCurrencyInputValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const trimmed = String(value).trim();
  if (trimmed === '') return '';
  return trimmed;
}
