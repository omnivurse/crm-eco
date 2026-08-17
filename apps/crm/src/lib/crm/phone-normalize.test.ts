import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, phoneDigits, phoneMatchKey } from './phone-normalize';

describe('phoneDigits', () => {
  it('strips everything but digits', () => {
    expect(phoneDigits('(303) 555-1212')).toBe('3035551212');
    expect(phoneDigits(null)).toBe('');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats every common stored style to NNN-NNN-NNNN', () => {
    expect(formatPhoneDisplay('3035551212')).toBe('303-555-1212');
    expect(formatPhoneDisplay('(303) 555-1212')).toBe('303-555-1212');
    expect(formatPhoneDisplay('303 555 1212')).toBe('303-555-1212');
    expect(formatPhoneDisplay('303.555.1212')).toBe('303-555-1212');
    expect(formatPhoneDisplay('+1 303 555 1212')).toBe('303-555-1212');
    expect(formatPhoneDisplay('1-303-555-1212')).toBe('303-555-1212');
    expect(formatPhoneDisplay(' 303-555-1212 ')).toBe('303-555-1212');
  });

  it('never destroys values it cannot safely reformat', () => {
    expect(formatPhoneDisplay('303-555-1212 x204')).toBe('303-555-1212 x204');
    expect(formatPhoneDisplay('555-1212')).toBe('555-1212');
    expect(formatPhoneDisplay('+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(formatPhoneDisplay('call after 5')).toBe('call after 5');
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay(null)).toBe('');
  });
});

describe('phoneMatchKey', () => {
  it('drops a leading US country code so both forms collide', () => {
    expect(phoneMatchKey('+1 (303) 555-1212')).toBe('3035551212');
    expect(phoneMatchKey('303-555-1212')).toBe('3035551212');
    expect(phoneMatchKey('555-1212')).toBe('5551212');
  });
});
