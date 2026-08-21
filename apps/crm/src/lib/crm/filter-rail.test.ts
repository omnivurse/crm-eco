import { describe, expect, it } from 'vitest';
import {
  FILTER_RAIL_STORAGE_PREFIX,
  applyFilterButtonLabel,
  filterModuleByTitle,
  filterRailStorageKey,
  moduleFilterRailTitle,
  shouldCloseFilterHost,
} from './filter-rail';

describe('filterModuleByTitle', () => {
  it('names the rail after the module', () => {
    expect(filterModuleByTitle('Contacts')).toBe('Filter Contacts by');
    expect(filterModuleByTitle('Leads')).toBe('Filter Leads by');
    expect(filterModuleByTitle('Members')).toBe('Filter Members by');
    expect(filterModuleByTitle('Accounts')).toBe('Filter Accounts by');
    expect(filterModuleByTitle('Pipeline')).toBe('Filter Pipeline by');
  });

  it('falls back when the name is blank', () => {
    expect(filterModuleByTitle('   ')).toBe('Filter Records by');
  });
});

describe('moduleFilterRailTitle', () => {
  it('prefers the plural name', () => {
    expect(
      moduleFilterRailTitle({ name: 'Contact', name_plural: 'Contacts', key: 'contacts' }),
    ).toBe('Filter Contacts by');
  });
});

describe('shouldCloseFilterHost', () => {
  it('closes a dialog host after Apply', () => {
    expect(shouldCloseFilterHost('dialog')).toBe(true);
  });

  it('does not unmount a docked rail after Apply', () => {
    expect(shouldCloseFilterHost('docked')).toBe(false);
  });
});

describe('applyFilterButtonLabel', () => {
  it('names the docked primary action Apply Filter so the rail footer is obvious', () => {
    expect(applyFilterButtonLabel('docked')).toBe('Apply Filter');
    expect(applyFilterButtonLabel('docked', 2)).toBe('Apply Filter (2)');
  });

  it('keeps the dialog label short', () => {
    expect(applyFilterButtonLabel('dialog')).toBe('Apply');
    expect(applyFilterButtonLabel('dialog', 1)).toBe('Apply (1)');
  });
});

describe('filterRailStorageKey', () => {
  it('is per-module', () => {
    expect(filterRailStorageKey('contacts')).toBe(`${FILTER_RAIL_STORAGE_PREFIX}contacts`);
    expect(filterRailStorageKey('leads')).toBe(`${FILTER_RAIL_STORAGE_PREFIX}leads`);
  });
});
