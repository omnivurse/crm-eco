import { describe, expect, it } from 'vitest';
import {
  classifyCarrierValue,
  isKnownInsuranceCarrier,
  isKnownSharingEntity,
  normalizeCarrierMatchKey,
} from './coverage-carriers';

describe('normalizeCarrierMatchKey', () => {
  it('collapses case, spaces, and punctuation', () => {
    expect(normalizeCarrierMatchKey('United Healthcare')).toBe('unitedhealthcare');
    expect(normalizeCarrierMatchKey('UnitedHealthcare')).toBe('unitedhealthcare');
    expect(normalizeCarrierMatchKey('  florida-blue ')).toBe('floridablue');
    expect(normalizeCarrierMatchKey('Centene/Ambetter')).toBe('centeneambetter');
  });

  it('returns empty for non-strings', () => {
    expect(normalizeCarrierMatchKey(null)).toBe('');
    expect(normalizeCarrierMatchKey(12)).toBe('');
  });
});

describe('isKnownInsuranceCarrier', () => {
  it('recognizes spaced United Healthcare as UnitedHealthcare', () => {
    expect(isKnownInsuranceCarrier('United Healthcare')).toBe(true);
    expect(isKnownInsuranceCarrier('united healthcare')).toBe(true);
    expect(isKnownInsuranceCarrier('UnitedHealthcare')).toBe(true);
  });

  it('recognizes other spaced/punctuated insurer variants', () => {
    expect(isKnownInsuranceCarrier('Blue Cross')).toBe(true);
    expect(isKnownInsuranceCarrier('Florida Blue')).toBe(true);
    expect(isKnownInsuranceCarrier('Bright Health')).toBe(true);
  });

  it('rejects ministries and unknowns', () => {
    expect(isKnownInsuranceCarrier('Sedera')).toBe(false);
    expect(isKnownInsuranceCarrier('Other')).toBe(false);
    expect(isKnownInsuranceCarrier('')).toBe(false);
  });
});

describe('isKnownSharingEntity', () => {
  it('recognizes spaced ministry names', () => {
    expect(isKnownSharingEntity('Zion Health')).toBe(true);
    expect(isKnownSharingEntity('zion  health')).toBe(true);
    expect(isKnownSharingEntity('Knew Health')).toBe(true);
  });

  it('rejects insurers', () => {
    expect(isKnownSharingEntity('United Healthcare')).toBe(false);
    expect(isKnownSharingEntity('Cigna')).toBe(false);
  });
});

describe('classifyCarrierValue', () => {
  it('classifies spaced insurer as insurance', () => {
    expect(classifyCarrierValue('United Healthcare')).toBe('insurance');
  });

  it('classifies ministry as healthshare', () => {
    expect(classifyCarrierValue('Zion Health')).toBe('healthshare');
  });

  it('returns unknown for blank / free-text', () => {
    expect(classifyCarrierValue('')).toBe('unknown');
    expect(classifyCarrierValue('Acme Mutual')).toBe('unknown');
  });
});
