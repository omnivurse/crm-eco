import { describe, expect, it } from 'vitest';
import {
  applySectionFieldLayout,
  mergeSectionFieldLayout,
  parseSectionFieldLayoutMap,
  sectionFieldLayoutStorageKey,
} from './section-field-layout';
import { normalizeCoverageSnapshotOrder } from './coverage-snapshot-layout';

const addressKeys = ['mailing_street', 'mailing_city', 'mailing_state', 'mailing_zip'];

describe('section field layout', () => {
  it('keys storage per module type', () => {
    expect(sectionFieldLayoutStorageKey('contacts')).toBe('crm.section-field-layout.contacts');
  });

  it('keeps the card order until a custom order is stored', () => {
    expect(normalizeCoverageSnapshotOrder(addressKeys, null, addressKeys)).toEqual(addressKeys);
    const shown = applySectionFieldLayout(
      addressKeys.map((key) => ({ key })),
      null,
    ).map((f) => f.key);
    expect(shown).toEqual(addressKeys);
  });

  it('honors a custom order and hides optional fields, not required ones', () => {
    const fields = [
      { key: 'first_name', required: true },
      { key: 'nickname', required: false },
      { key: 'title', required: false },
    ];
    const shown = applySectionFieldLayout(fields, {
      v: 1,
      order: ['title', 'nickname', 'first_name'],
      hidden: ['nickname', 'first_name'],
    }).map((f) => f.key);
    expect(shown).toEqual(['title', 'first_name']);
  });

  it('preserves customized-away fields for native form submission', () => {
    const fields = [
      { key: 'first_name', required: true },
      { key: 'nickname', required: false },
      { key: 'title', required: false },
    ];
    const shown = applySectionFieldLayout(
      fields,
      {
        v: 1,
        order: ['title', 'nickname', 'first_name'],
        hidden: ['nickname'],
      },
      { preserveHidden: true },
    ).map((f) => f.key);

    expect(shown).toEqual(['title', 'nickname', 'first_name']);
  });

  it('keeps section cards and module types isolated', () => {
    const merged = mergeSectionFieldLayout(
      {
        members: { address: { v: 1, order: ['city'], hidden: [] } },
        contacts: { health_share: { v: 1, order: ['iua_amount'], hidden: [] } },
      },
      'contacts',
      'address',
      { v: 1, order: ['mailing_street'], hidden: [] },
    );
    expect(merged.contacts?.address?.order).toEqual(['mailing_street']);
    expect(merged.contacts?.health_share?.order).toEqual(['iua_amount']);
    expect(merged.members?.address?.order).toEqual(['city']);
  });

  it('reset removes only that section', () => {
    const next = mergeSectionFieldLayout(
      {
        contacts: {
          address: { v: 1, order: ['mailing_street'], hidden: [] },
          profile: { v: 1, order: ['first_name'], hidden: [] },
        },
      },
      'contacts',
      'address',
      null,
    );
    expect(next.contacts?.address).toBeUndefined();
    expect(next.contacts?.profile?.order).toEqual(['first_name']);
    expect(parseSectionFieldLayoutMap(next).contacts?.profile?.order).toEqual(['first_name']);
  });
});
