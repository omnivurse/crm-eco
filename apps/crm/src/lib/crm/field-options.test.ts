import { describe, it, expect } from 'vitest';
import {
  FieldOption,
  OPTION_TEXT_MAX,
  applyOptionPatches,
  deterministicOptionId,
  mergeOptionInto,
  normalizeOptions,
  sortOptions,
  validateOptions,
} from './field-options';

function opt(overrides: Partial<FieldOption> & { id: string }): FieldOption {
  return {
    value: overrides.id,
    label: overrides.id,
    color: null,
    icon: null,
    is_default: false,
    is_active: true,
    display_order: 0,
    metadata: {},
    ...overrides,
  };
}

const THREE: FieldOption[] = [
  opt({ id: 'a', value: 'Walker Bronze', label: 'Walker Bronze', display_order: 0 }),
  opt({ id: 'b', value: 'Silver PPO', label: 'Silver PPO', display_order: 1 }),
  opt({ id: 'c', value: 'Gold HMO', label: 'Gold HMO', display_order: 2 }),
];

describe('normalizeOptions', () => {
  it('returns [] for null/undefined/empty string', () => {
    expect(normalizeOptions(null)).toEqual([]);
    expect(normalizeOptions(undefined)).toEqual([]);
    expect(normalizeOptions('')).toEqual([]);
  });

  it('returns [] for the literal string "[]" and for invalid JSON', () => {
    expect(normalizeOptions('[]')).toEqual([]);
    expect(normalizeOptions('not json')).toEqual([]);
  });

  it('returns [] for non-array JSON', () => {
    expect(normalizeOptions({ a: 1 })).toEqual([]);
    expect(normalizeOptions('"just a string"')).toEqual([]);
  });

  it('reshapes plain string arrays into active options with stable order', () => {
    const out = normalizeOptions(['Bronze', 'Silver']);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ value: 'Bronze', label: 'Bronze', is_active: true, display_order: 0 });
    expect(out[1]).toMatchObject({ value: 'Silver', label: 'Silver', is_active: true, display_order: 1 });
    expect(out[0].id).toBeTruthy();
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('preserves full option objects and defaults missing flags', () => {
    const out = normalizeOptions([
      { id: 'x', value: 'v', label: 'L', is_active: false, display_order: 7, color: '#ff0000' },
      { value: 'only-value' },
      { label: 'only-label' },
    ]);
    expect(out[0]).toMatchObject({ id: 'x', value: 'v', label: 'L', is_active: false, display_order: 7, color: '#ff0000' });
    expect(out[1]).toMatchObject({ value: 'only-value', label: 'only-value', is_active: true, display_order: 1 });
    expect(out[2]).toMatchObject({ value: 'only-label', label: 'only-label' });
    expect(out[1].id).toBeTruthy();
  });

  it('parses a JSON string payload of option objects', () => {
    const out = normalizeOptions(JSON.stringify([{ id: 'x', value: 'v', label: 'L' }]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'x', value: 'v', label: 'L' });
  });
});

describe('sortOptions', () => {
  it('sorts by display_order then label, without mutating the input', () => {
    const input = [
      opt({ id: 'z', label: 'Zeta', display_order: 1 }),
      opt({ id: 'a', label: 'Alpha', display_order: 1 }),
      opt({ id: 'l', label: 'Last', display_order: 5 }),
      opt({ id: 'f', label: 'First', display_order: 0 }),
    ];
    const snapshot = [...input];
    const out = sortOptions(input);
    expect(out.map((o) => o.id)).toEqual(['f', 'a', 'z', 'l']);
    expect(input).toEqual(snapshot);
  });
});

describe('validateOptions', () => {
  it('accepts a healthy list', () => {
    expect(validateOptions(THREE)).toBeNull();
  });

  it('rejects an empty list', () => {
    expect(validateOptions([])).toMatch(/at least one option/);
  });

  it('rejects a list with zero ACTIVE options (deactivate-not-delete still needs one left)', () => {
    const allOff = THREE.map((o) => ({ ...o, is_active: false }));
    expect(validateOptions(allOff)).toMatch(/at least one active option/);
  });

  it('rejects empty and whitespace-only values and labels', () => {
    expect(validateOptions([opt({ id: 'a', value: '', label: 'x' })])).toMatch(/values must not be empty/);
    expect(validateOptions([opt({ id: 'a', value: '   ', label: 'x' })])).toMatch(/values must not be empty/);
    expect(validateOptions([opt({ id: 'a', value: 'x', label: ' ' })])).toMatch(/labels must not be empty/);
  });

  it('rejects values/labels beyond OPTION_TEXT_MAX', () => {
    const long = 'x'.repeat(OPTION_TEXT_MAX + 1);
    expect(validateOptions([opt({ id: 'a', value: long, label: 'ok' })])).toMatch(/at most 255/);
    expect(validateOptions([opt({ id: 'a', value: 'ok', label: long })])).toMatch(/at most 255/);
  });

  it('rejects duplicate values — exact, case-insensitive, and trimmed', () => {
    expect(
      validateOptions([opt({ id: 'a', value: 'Silver PPO' }), opt({ id: 'b', value: 'Silver PPO' })])
    ).toMatch(/Duplicate option value/);
    expect(
      validateOptions([opt({ id: 'a', value: 'Silver PPO' }), opt({ id: 'b', value: 'silver ppo' })])
    ).toMatch(/Duplicate option value/);
    expect(
      validateOptions([opt({ id: 'a', value: 'Silver PPO' }), opt({ id: 'b', value: '  Silver PPO  ' })])
    ).toMatch(/Duplicate option value/);
  });

  it('allows an inactive duplicate-free list with one active survivor', () => {
    const mixed = [
      opt({ id: 'a', value: 'Keep', is_active: true }),
      opt({ id: 'b', value: 'Retired', is_active: false }),
    ];
    expect(validateOptions(mixed)).toBeNull();
  });
});

describe('applyOptionPatches', () => {
  it('renames the label and leaves the stored value untouched', () => {
    const res = applyOptionPatches(THREE, [{ id: 'b', label: 'Silver PPO (2026)' }]);
    expect(res.error).toBeUndefined();
    const b = res.options!.find((o) => o.id === 'b')!;
    expect(b.label).toBe('Silver PPO (2026)');
    expect(b.value).toBe('Silver PPO'); // value is what records hold — never patched
  });

  it('deactivates without deleting: the option stays in the list', () => {
    const res = applyOptionPatches(THREE, [{ id: 'c', is_active: false }]);
    expect(res.options).toHaveLength(3);
    expect(res.options!.find((o) => o.id === 'c')!.is_active).toBe(false);
  });

  it('reactivates a previously deactivated option', () => {
    const withOff = THREE.map((o) => (o.id === 'c' ? { ...o, is_active: false } : o));
    const res = applyOptionPatches(withOff, [{ id: 'c', is_active: true }]);
    expect(res.options!.find((o) => o.id === 'c')!.is_active).toBe(true);
  });

  it('reorders one or more options in a single call', () => {
    const res = applyOptionPatches(THREE, [
      { id: 'a', display_order: 2 },
      { id: 'c', display_order: 0 },
    ]);
    expect(sortOptions(res.options!).map((o) => o.id)).toEqual(['c', 'b', 'a']);
  });

  it('is idempotent: applying the same patches twice equals once', () => {
    const patches = [
      { id: 'a', label: 'Renamed', display_order: 5 },
      { id: 'b', is_active: false },
    ];
    const once = applyOptionPatches(THREE, patches);
    const twice = applyOptionPatches(once.options!, patches);
    expect(twice.options).toEqual(once.options);
  });

  it('errors on an unknown option id and applies nothing', () => {
    const res = applyOptionPatches(THREE, [{ id: 'nope', label: 'x' }]);
    expect(res.error).toMatch(/Option not found: nope/);
    expect(res.options).toBeUndefined();
  });

  it('rejects a patch set that would deactivate every option', () => {
    const res = applyOptionPatches(THREE, THREE.map((o) => ({ id: o.id, is_active: false })));
    expect(res.error).toMatch(/at least one active option/);
  });

  it('rejects renaming a label to blank', () => {
    const res = applyOptionPatches(THREE, [{ id: 'a', label: '   ' }]);
    expect(res.error).toMatch(/labels must not be empty/);
  });

  it('does not mutate the input list', () => {
    const snapshot = JSON.parse(JSON.stringify(THREE));
    applyOptionPatches(THREE, [{ id: 'a', label: 'changed', is_active: false }]);
    expect(THREE).toEqual(snapshot);
  });
});

describe('mergeOptionInto', () => {
  it('deactivates the loser, keeps the winner active, removes nothing, rewrites no values', () => {
    const res = mergeOptionInto(THREE, 'a', 'b');
    expect(res.error).toBeUndefined();
    expect(res.options).toHaveLength(3); // never hard-deletes
    const loser = res.options!.find((o) => o.id === 'a')!;
    const winner = res.options!.find((o) => o.id === 'b')!;
    expect(loser.is_active).toBe(false);
    expect(winner.is_active).toBe(true);
    // Record data is untouched by design: values stay exactly as stored.
    expect(loser.value).toBe('Walker Bronze');
    expect(winner.value).toBe('Silver PPO');
  });

  it('clears is_default on the loser so a retired option cannot stay the default', () => {
    const withDefault = THREE.map((o) => (o.id === 'a' ? { ...o, is_default: true } : o));
    const res = mergeOptionInto(withDefault, 'a', 'b');
    expect(res.options!.find((o) => o.id === 'a')!.is_default).toBe(false);
  });

  it('reactivates an inactive winner', () => {
    const withOff = THREE.map((o) => (o.id === 'b' ? { ...o, is_active: false } : o));
    const res = mergeOptionInto(withOff, 'a', 'b');
    expect(res.options!.find((o) => o.id === 'b')!.is_active).toBe(true);
  });

  it('is idempotent: merging the same pair again is a no-op', () => {
    const once = mergeOptionInto(THREE, 'a', 'b');
    const twice = mergeOptionInto(once.options!, 'a', 'b');
    expect(twice.options).toEqual(once.options);
  });

  it('refuses to merge an option into itself', () => {
    expect(mergeOptionInto(THREE, 'a', 'a').error).toMatch(/into itself/);
  });

  it('errors on unknown loser or winner ids', () => {
    expect(mergeOptionInto(THREE, 'nope', 'b').error).toMatch(/Option not found: nope/);
    expect(mergeOptionInto(THREE, 'a', 'nope').error).toMatch(/Option not found: nope/);
  });

  it('rejects a merge that would leave no active option', () => {
    const twoLeft = [
      opt({ id: 'a', value: 'A', is_active: true }),
      opt({ id: 'b', value: 'B', is_active: false }),
    ];
    // Winner is reactivated, so this stays valid…
    expect(mergeOptionInto(twoLeft, 'a', 'b').error).toBeUndefined();
    // …but a single-option field can never merge away its only option.
    const oneOnly = [opt({ id: 'a', value: 'A', is_active: true })];
    expect(mergeOptionInto(oneOnly, 'a', 'a').error).toMatch(/into itself/);
  });
});

describe('deterministic ids for legacy entries (prod contacts.product / leads.product_type shape)', () => {
  it('gives legacy string entries the SAME ids on every normalize — a rename can round-trip GET → PATCH', () => {
    const raw = ['Silver PPO', 'Gold HMO', 'Walker Bronze'];
    const first = normalizeOptions(raw);
    const second = normalizeOptions(raw);
    expect(second.map((o) => o.id)).toEqual(first.map((o) => o.id));
    expect(first[0].id).toBe(deterministicOptionId('Silver PPO'));
  });

  it('derives UUID-shaped ids that pass the route zod .uuid() gate', () => {
    for (const value of ['Silver PPO', 'x', 'Héalth Sharing — Tier 2']) {
      expect(deterministicOptionId(value)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
  });

  it('trims before deriving: " Silver PPO " and "Silver PPO" are the same option', () => {
    expect(deterministicOptionId('  Silver PPO  ')).toBe(deterministicOptionId('Silver PPO'));
  });

  it('distinct values derive distinct ids; exact duplicates stay distinct AND stable', () => {
    expect(deterministicOptionId('PPO')).not.toBe(deterministicOptionId('HMO'));
    const out = normalizeOptions(['PPO', 'PPO']);
    expect(out[0].id).not.toBe(out[1].id);
    const again = normalizeOptions(['PPO', 'PPO']);
    expect(again.map((o) => o.id)).toEqual(out.map((o) => o.id));
  });

  it('object entries missing an id also get deterministic ids; a stored id always wins', () => {
    const a = normalizeOptions([{ value: 'Bronze' }, { id: 'kept', value: 'Gold' }]);
    const b = normalizeOptions([{ value: 'Bronze' }, { id: 'kept', value: 'Gold' }]);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).toBe(deterministicOptionId('Bronze'));
    expect(a[1].id).toBe('kept');
  });
});
