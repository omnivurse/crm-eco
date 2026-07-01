import { describe, expect, it } from 'vitest';
import {
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
