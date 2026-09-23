import { describe, expect, it } from 'vitest';
import { resolveWebformDedupeFilters } from './webform-dedupe';

const systemFields = new Set(['email', 'phone']);
const isSafeDataField = (field: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(field);

describe('resolveWebformDedupeFilters', () => {
  it('returns a complete composite key across indexed and JSON fields', () => {
    expect(
      resolveWebformDedupeFilters(
        ['email', 'postal_code'],
        systemFields,
        { email: 'person@example.com' },
        { postal_code: '80202' },
        isSafeDataField,
      ),
    ).toEqual([
      {
        field: 'email',
        source: 'column',
        value: 'person@example.com',
      },
      {
        field: 'postal_code',
        source: 'data',
        value: '80202',
      },
    ]);
  });

  it('returns null when a public submission omits a configured dedupe field', () => {
    expect(
      resolveWebformDedupeFilters(
        ['email'],
        systemFields,
        {},
        { first_name: 'Attacker-controlled update' },
        isSafeDataField,
      ),
    ).toBeNull();
  });

  it('returns null instead of partially matching a composite key', () => {
    expect(
      resolveWebformDedupeFilters(
        ['email', 'postal_code'],
        systemFields,
        { email: 'person@example.com' },
        {},
        isSafeDataField,
      ),
    ).toBeNull();
  });

  it('returns null for unsafe JSON filter paths', () => {
    expect(
      resolveWebformDedupeFilters(
        ['profile->>role'],
        systemFields,
        {},
        { 'profile->>role': 'admin' },
        isSafeDataField,
      ),
    ).toBeNull();
  });

  it('preserves finite numeric and boolean values', () => {
    expect(
      resolveWebformDedupeFilters(
        ['household_size', 'is_primary'],
        systemFields,
        {},
        { household_size: 0, is_primary: false },
        isSafeDataField,
      ),
    ).toEqual([
      { field: 'household_size', source: 'data', value: 0 },
      { field: 'is_primary', source: 'data', value: false },
    ]);
  });
});
