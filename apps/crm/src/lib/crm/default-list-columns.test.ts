import { describe, it, expect } from 'vitest';
import {
  pickDefaultListColumns,
  DEFAULT_LIST_COLUMN_MAX,
  type DefaultColumnCandidate,
} from './default-list-columns';

function field(
  key: string,
  overrides: Partial<DefaultColumnCandidate> = {},
): DefaultColumnCandidate {
  return { key, is_title_field: false, is_pinned: false, display_order: 0, ...overrides };
}

/** Members-like fixture: 91 fields, no title field, identity keys scattered. */
function membersLikeFields(): DefaultColumnCandidate[] {
  const out: DefaultColumnCandidate[] = [];
  for (let i = 0; i < 91; i++) out.push(field(`custom_${i}`, { display_order: i + 20 }));
  // Overwrite a few slots with well-known keys, out of "nice" order on purpose.
  out[5] = field('phone', { display_order: 25 });
  out[9] = field('member_number', { display_order: 29 });
  out[14] = field('membership_status', { display_order: 34 });
  out[30] = field('email', { display_order: 50 });
  out[40] = field('last_name', { display_order: 60 });
  out[41] = field('first_name', { display_order: 61 });
  out[60] = field('plan_status', { display_order: 80 });
  return out;
}

describe('pickDefaultListColumns', () => {
  it('members-like (91 fields, no views): returns a small identity-first subset', () => {
    const cols = pickDefaultListColumns(membersLikeFields());
    expect(cols).toHaveLength(DEFAULT_LIST_COLUMN_MAX);
    expect(cols.slice(0, 5)).toEqual(['first_name', 'last_name', 'member_number', 'email', 'phone']);
    // status-like fields next, in display_order
    expect(cols[5]).toBe('membership_status');
    expect(cols[6]).toBe('plan_status');
    // then remaining fields by display_order (custom_0 has the lowest order = 20)
    expect(cols[7]).toBe('custom_0');
    expect(new Set(cols).size).toBe(cols.length);
  });

  it('contacts-like: title field first, then identity, then status, then display order', () => {
    const cols = pickDefaultListColumns([
      field('created_at', { display_order: 99 }),
      field('contact_status', { display_order: 5 }),
      field('email', { display_order: 3 }),
      field('contact_name', { is_title_field: true, display_order: 1 }),
      field('phone', { display_order: 4 }),
      field('owner_id', { display_order: 6, is_pinned: true }),
      field('address', { display_order: 6 }),
      field('notes', { display_order: 7 }),
      field('dob', { display_order: 8 }),
    ]);
    expect(cols).toEqual([
      'contact_name',
      'email',
      'phone',
      'contact_status',
      // pinned wins the display_order tie
      'owner_id',
      'address',
      'notes',
      'dob',
    ]);
  });

  it('respects a custom max and never duplicates a title field that is also an identity key', () => {
    const cols = pickDefaultListColumns(
      [
        field('email', { is_title_field: true, display_order: 2 }),
        field('first_name', { display_order: 1 }),
        field('status', { display_order: 3 }),
        field('other', { display_order: 4 }),
      ],
      3,
    );
    expect(cols).toEqual(['email', 'first_name', 'status']);
  });

  it('falls back to first N by display_order when nothing is well-known', () => {
    const cols = pickDefaultListColumns(
      [
        field('z', { display_order: 3 }),
        field('y', { display_order: 2 }),
        field('x', { display_order: 1 }),
      ],
      2,
    );
    expect(cols).toEqual(['x', 'y']);
  });

  it('returns [] only for an empty field list, otherwise never empty', () => {
    expect(pickDefaultListColumns([])).toEqual([]);
    expect(pickDefaultListColumns([field('only')], 0)).toEqual(['only']);
  });

  it('skips duplicate ownership aliases so default lists get one Enrolled by column', () => {
    const cols = pickDefaultListColumns(
      [
        field('first_name', { display_order: 1 }),
        field('last_name', { display_order: 2 }),
        field('advisor', { display_order: 3 }),
        field('agent', { display_order: 4 }),
        field('producer_name', { display_order: 5 }),
        field('email', { display_order: 6 }),
        field('phone', { display_order: 7 }),
        field('contact_status', { display_order: 8 }),
      ],
      8,
    );
    expect(cols.filter((k) => ['advisor', 'agent', 'producer_name'].includes(k))).toEqual([
      'producer_name',
    ]);
    expect(cols).toContain('producer_name');
    expect(cols).not.toContain('advisor');
    expect(cols).not.toContain('agent');
  });

  it('is pure with respect to input order', () => {
    const input = membersLikeFields();
    const snapshot = input.map((f) => f.key);
    pickDefaultListColumns(input);
    expect(input.map((f) => f.key)).toEqual(snapshot);
  });
});
