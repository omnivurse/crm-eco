import { describe, expect, it } from 'vitest';
import {
  formatCurrencyDisplay,
  isValidCurrencyTyping,
  parseCurrencyInput,
  sanitizeCurrencyInput,
} from './currency-input';

describe('sanitizeCurrencyInput', () => {
  it('strips dollar signs, commas, and spaces', () => {
    expect(sanitizeCurrencyInput('$390.01')).toBe('390.01');
    expect(sanitizeCurrencyInput('$1,234.56')).toBe('1234.56');
    expect(sanitizeCurrencyInput('  $ 99.00  ')).toBe('99.00');
  });
});

describe('parseCurrencyInput', () => {
  it('parses formatted currency strings', () => {
    expect(parseCurrencyInput('$390.01')).toBe(390.01);
    expect(parseCurrencyInput('$1,234.56')).toBe(1234.56);
  });

  it('returns null for blank or invalid values', () => {
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('$')).toBeNull();
    expect(parseCurrencyInput('abc')).toBeNull();
  });
});

describe('isValidCurrencyTyping', () => {
  it('accepts pasted values with currency formatting', () => {
    expect(isValidCurrencyTyping('$390.01')).toBe(true);
    expect(isValidCurrencyTyping('$1,234.56')).toBe(true);
  });

  it('still accepts plain numeric typing', () => {
    expect(isValidCurrencyTyping('12.')).toBe(true);
    expect(isValidCurrencyTyping('12.3')).toBe(true);
  });
});

describe('formatCurrencyDisplay', () => {
  it('formats real amounts as USD', () => {
    expect(formatCurrencyDisplay(324)).toBe('$324.00');
    expect(formatCurrencyDisplay('324')).toBe('$324.00');
    expect(formatCurrencyDisplay(1234.5)).toBe('$1,234.50');
  });

  it('treats empty / unset values as no value (never "$0.00")', () => {
    // Regression: an empty JSONB amount ("") must NOT render "$0.00" — the
    // coverage snapshot showed a HealthShare member "$0.00" for a blank
    // monthly_contribution because Number('') === 0.
    expect(formatCurrencyDisplay('')).toBeNull();
    expect(formatCurrencyDisplay('   ')).toBeNull();
    expect(formatCurrencyDisplay(null)).toBeNull();
    expect(formatCurrencyDisplay(undefined)).toBeNull();
    expect(formatCurrencyDisplay('abc')).toBeNull();
  });

  it('still renders a genuine zero as "$0.00"', () => {
    expect(formatCurrencyDisplay(0)).toBe('$0.00');
    expect(formatCurrencyDisplay('0')).toBe('$0.00');
  });
});
