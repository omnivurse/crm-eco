import { describe, it, expect } from 'vitest';
import { pickActiveMemberByName } from '../memberDedup';

describe('pickActiveMemberByName', () => {
  const keeper = {
    id: 'keeper-id',
    first_name: 'Jane',
    last_name: 'Doe',
    merged_into_id: null,
  };
  const mergedDup = {
    id: 'dup-id',
    first_name: 'Jane',
    last_name: 'Doe',
    merged_into_id: 'keeper-id',
  };

  it('returns the keeper when a soft-merged duplicate shares email + name', () => {
    const match = pickActiveMemberByName([mergedDup, keeper], 'jane', 'doe');
    expect(match?.id).toBe('keeper-id');
  });

  it('returns undefined when only merged duplicates match the name', () => {
    const match = pickActiveMemberByName([mergedDup], 'Jane', 'Doe');
    expect(match).toBeUndefined();
  });

  it('matches family members sharing an email but with different names', () => {
    const spouse = {
      id: 'spouse-id',
      first_name: 'John',
      last_name: 'Doe',
      merged_into_id: null,
    };
    const match = pickActiveMemberByName([keeper, spouse], 'John', 'DOE');
    expect(match?.id).toBe('spouse-id');
  });

  // The find-or-create recovery path (route falls back to a wider re-query after a unique
  // violation) relies on pickActiveMemberByName scanning the WHOLE cohort — the active
  // match may sit well past many non-matching / merged rows.
  it('finds the active match even when it appears after many non-matching/merged rows', () => {
    const noise = Array.from({ length: 60 }, (_, i) => ({
      id: `noise-${i}`,
      first_name: 'Other',
      last_name: `Person${i}`,
      merged_into_id: i % 2 === 0 ? 'someone' : null,
    }));
    const target = {
      id: 'target-id',
      first_name: 'Jane',
      last_name: 'Doe',
      merged_into_id: null,
    };
    const match = pickActiveMemberByName([...noise, mergedDup, target], 'Jane', 'Doe');
    expect(match?.id).toBe('target-id');
  });

  it('trims and lowercases both sides so stored whitespace/casing still matches', () => {
    const stored = {
      id: 'stored-id',
      first_name: '  Jane ',
      last_name: 'DOE',
      merged_into_id: null,
    };
    const match = pickActiveMemberByName([stored], 'jane', '  doe  ');
    expect(match?.id).toBe('stored-id');
  });
});
