import { describe, expect, it } from 'vitest';
import { applyHouseholdCsvRules, describeRecordedAge, householdAgeSlot } from './household-age';

describe('applyHouseholdCsvRules', () => {
  const opts = { fileModifiedIso: '2025-09-30', todayIso: '2026-08-22' };

  it('routes a "Yes - 45" name-box marker to the age field and flag, never into the name box', () => {
    const patch = applyHouseholdCsvRules({ spouse: 'Yes - 45' }, {}, opts);
    expect(patch).toEqual({ spouse_age: 45, has_spouse: true, spouse_age_as_of: '2025-09-30' });
  });

  it('drops the marker but keeps an age a human already entered', () => {
    const patch = applyHouseholdCsvRules({ child_1: '20' }, { child_1_age: 19, has_kids: true }, opts);
    expect(patch).toEqual({});
  });

  it('does not invent an age beside a known DOB; still sets the flag', () => {
    const patch = applyHouseholdCsvRules({ child_2: '3' }, { child_2_dob: '2023-05-01' }, opts);
    expect(patch).toEqual({ has_kids: true });
  });

  it('lets an explicit age column in the file win over the marker', () => {
    const patch = applyHouseholdCsvRules({ spouse: 'Yes - 45', spouse_age: 46 }, {}, opts);
    expect(patch).toEqual({ spouse_age: 46, has_spouse: true, spouse_age_as_of: '2025-09-30' });
  });

  it('never overwrites a real name with a marker (the marker still proves the spouse exists)', () => {
    // the diff engine put 'Yes - 45' in the patch because the file differs from the stored name
    const patch = applyHouseholdCsvRules({ spouse: 'Yes - 45' }, { spouse: 'Dawn Meath', spouse_age: 50 }, opts);
    expect(patch).toEqual({ has_spouse: true });
    expect(applyHouseholdCsvRules({ spouse: 'Yes - 45' }, { spouse: 'Dawn Meath', spouse_age: 50, has_spouse: true }, opts))
      .toEqual({});
  });

  it('resolves yes / no markers to the flags', () => {
    expect(applyHouseholdCsvRules({ child_3: ' yes ' }, {}, opts)).toEqual({ has_kids: true });
    expect(applyHouseholdCsvRules({ spouse: 'no' }, {}, opts)).toEqual({ has_spouse: false });
    // an explicit stored answer is not second-guessed by a stray 'no'
    expect(applyHouseholdCsvRules({ spouse: 'N' }, { has_spouse: true }, opts)).toEqual({});
    // a child 'no' just vanishes from the name box
    expect(applyHouseholdCsvRules({ child_1: 'none' }, {}, opts)).toEqual({});
  });

  it('leaves real names and out-of-range digits alone', () => {
    expect(applyHouseholdCsvRules({ spouse: 'Talon Hernandez' }, {}, opts)).toEqual({ spouse: 'Talon Hernandez' });
    const big = applyHouseholdCsvRules({ spouse: '150' }, {}, opts);
    expect(big.spouse).toBeUndefined(); // marker-shaped, so it still stays out of the name box
    expect(big.spouse_age).toBeUndefined();
    expect(big.has_spouse).toBe(true);
  });

  it('stamps a recorded-on date for every changed age, from the file when it has one', () => {
    expect(applyHouseholdCsvRules({ spouse_age: 46 }, { spouse_age_as_of: '2024-03-01' }, opts))
      .toEqual({ spouse_age: 46, spouse_age_as_of: '2025-09-30' });
    expect(applyHouseholdCsvRules({ child_1_age: 12 }, {}, { fileModifiedIso: null, todayIso: '2026-08-22' }))
      .toEqual({ child_1_age: 12, child_1_age_as_of: '2026-08-22' });
  });

  it('clears the recorded-on date when the age is cleared, and respects a supplied one', () => {
    expect(applyHouseholdCsvRules({ spouse_age: null }, {}, opts)).toEqual({ spouse_age: null, spouse_age_as_of: null });
    expect(applyHouseholdCsvRules({ spouse_age: 46, spouse_age_as_of: '2024-03-01' }, {}, opts))
      .toEqual({ spouse_age: 46, spouse_age_as_of: '2024-03-01' });
  });
});

const NOW = new Date(2027, 9, 15); // 15 Oct 2027

describe('householdAgeSlot', () => {
  it('recognises the six household age keys and nothing else', () => {
    expect(householdAgeSlot('spouse_age')).toBe('spouse');
    expect(householdAgeSlot('child_3_age')).toBe('child_3');
    expect(householdAgeSlot('child_6_age')).toBeNull();
    expect(householdAgeSlot('age')).toBeNull();
    expect(householdAgeSlot('spouse_age_as_of')).toBeNull();
    expect(householdAgeSlot('estimated_age')).toBeNull();
  });
});

describe('describeRecordedAge', () => {
  it('returns null for non-household keys so the default renderer is used', () => {
    expect(describeRecordedAge('age', 45, { age_as_of: '2026-08-22' }, NOW)).toBeNull();
  });

  it('returns null for a non-numeric value', () => {
    expect(describeRecordedAge('spouse_age', 'forty', { spouse_age_as_of: '2026-08-22' }, NOW)).toBeNull();
    expect(describeRecordedAge('spouse_age', '', {}, NOW)).toBeNull();
  });

  it('shows the stored age with no hint when the recorded-on date is missing or invalid', () => {
    expect(describeRecordedAge('spouse_age', 45, {}, NOW)).toEqual({
      stored: 45, asOf: null, current: 45, hint: null,
    });
    expect(describeRecordedAge('spouse_age', 45, { spouse_age_as_of: 'not a date' }, NOW)?.hint).toBeNull();
  });

  it('captions a fresh age with just the recorded month', () => {
    const r = describeRecordedAge('child_1_age', 20, { child_1_age_as_of: '2027-08-22' }, NOW);
    expect(r?.current).toBe(20);
    expect(r?.hint).toBe('recorded Aug 2027');
  });

  it('adds whole elapsed years to estimate today, respecting the anniversary', () => {
    // recorded 22 Aug 2026, now 15 Oct 2027 → one full year elapsed
    expect(describeRecordedAge('spouse_age', 45, { spouse_age_as_of: '2026-08-22' }, NOW)?.hint)
      .toBe('≈ 46 today · recorded Aug 2026');
    // recorded 1 Nov 2026, now 15 Oct 2027 → anniversary not yet reached
    expect(describeRecordedAge('spouse_age', 45, { spouse_age_as_of: '2026-11-01' }, NOW)?.hint)
      .toBe('recorded Nov 2026');
    // three years on
    expect(describeRecordedAge('spouse_age', '45', { spouse_age_as_of: '2024-03-09' }, NOW)?.current).toBe(48);
  });

  it('never counts a future recorded-on date as negative years', () => {
    const r = describeRecordedAge('spouse_age', 45, { spouse_age_as_of: '2030-01-01' }, NOW);
    expect(r?.current).toBe(45);
    expect(r?.hint).toBe('recorded Jan 2030');
  });

  it('reads the recorded-on date from the matching slot only', () => {
    const related = { spouse_age_as_of: '2020-01-01', child_1_age_as_of: '2027-09-01' };
    expect(describeRecordedAge('child_1_age', 18, related, NOW)?.hint).toBe('recorded Sep 2027');
  });
});
