import { describe, expect, it } from 'vitest';
import { cleanOwnershipValue, resolveOwnershipName } from './ownership-name';

describe('cleanOwnershipValue', () => {
  it('trims and rejects placeholders', () => {
    expect(cleanOwnershipValue('  Jane Doe ')).toBe('Jane Doe');
    expect(cleanOwnershipValue('')).toBeNull();
    expect(cleanOwnershipValue('   ')).toBeNull();
    expect(cleanOwnershipValue('-')).toBeNull();
    expect(cleanOwnershipValue('N/A')).toBeNull();
    expect(cleanOwnershipValue(null)).toBeNull();
    expect(cleanOwnershipValue(undefined)).toBeNull();
    expect(cleanOwnershipValue({})).toBeNull();
    expect(cleanOwnershipValue(42)).toBe('42');
  });
});

describe('resolveOwnershipName', () => {
  it('returns null for missing record', () => {
    expect(resolveOwnershipName(null)).toEqual({ name: null, source: null });
    expect(resolveOwnershipName(undefined)).toEqual({ name: null, source: null });
  });

  it('healthshare prefers normalized_advisor_name', () => {
    expect(
      resolveOwnershipName({
        market_type: 'healthshare',
        normalized_advisor_name: 'Ann Advisor',
        normalized_agent_name: 'Al Agent',
        data: { producer: 'Pat Producer' },
      }),
    ).toEqual({ name: 'Ann Advisor', source: 'normalized_advisor_name' });
  });

  it('traditional_insurance prefers normalized_agent_name', () => {
    expect(
      resolveOwnershipName({
        market_type: 'traditional_insurance',
        normalized_advisor_name: 'Ann Advisor',
        normalized_agent_name: 'Al Agent',
      }),
    ).toEqual({ name: 'Al Agent', source: 'normalized_agent_name' });
  });

  it('unknown market uses advisor then agent normalized names', () => {
    expect(
      resolveOwnershipName({ market_type: null, normalized_agent_name: 'Al Agent' }),
    ).toEqual({ name: 'Al Agent', source: 'normalized_agent_name' });
    expect(
      resolveOwnershipName({
        market_type: 'unknown',
        normalized_advisor_name: 'Ann',
        normalized_agent_name: 'Al',
      }),
    ).toEqual({ name: 'Ann', source: 'normalized_advisor_name' });
  });

  it('falls back to data.producer when normalized names are empty (healthshare)', () => {
    expect(
      resolveOwnershipName({
        market_type: 'healthshare',
        normalized_advisor_name: null,
        normalized_agent_name: 'Al Agent',
        data: { producer: 'Pat Producer' },
      }),
    ).toEqual({ name: 'Pat Producer', source: 'data.producer' });
  });

  it('applies data-key precedence and skips blank values', () => {
    expect(
      resolveOwnershipName({
        data: {
          producer_name: ' - ',
          producer: '',
          advisor_name: 'n/a',
          advisor: 'Adele Advisor',
          agent: 'Agent Smith',
          lead_owner: 'Lead Owner',
        },
      }),
    ).toEqual({ name: 'Adele Advisor', source: 'data.advisor' });
    expect(
      resolveOwnershipName({ data: { lead_owner: 'Lead Owner', contact_owner: 'C Owner' } }),
    ).toEqual({ name: 'Lead Owner', source: 'data.lead_owner' });
    expect(resolveOwnershipName({ data: { contact_owner: 'C Owner' } })).toEqual({
      name: 'C Owner',
      source: 'data.contact_owner',
    });
  });

  it('tolerates missing / malformed data', () => {
    expect(resolveOwnershipName({ market_type: 'healthshare' })).toEqual({ name: null, source: null });
    expect(resolveOwnershipName({ data: null })).toEqual({ name: null, source: null });
    expect(
      resolveOwnershipName({ data: ['x'] as unknown as Record<string, unknown> }),
    ).toEqual({ name: null, source: null });
  });
});
