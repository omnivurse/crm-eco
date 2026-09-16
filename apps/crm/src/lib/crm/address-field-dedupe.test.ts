import { describe, expect, it } from 'vitest';
import {
  addressFormLabel,
  collapseAddressListColumns,
  formatRecordAddress,
  preferredAddressLineListColumnKey,
  primaryAddressFieldKey,
  shouldShowAddressFieldInForm,
} from './address-field-dedupe';

describe('shouldShowAddressFieldInForm — lead Street + Mailing Street duplicate', () => {
  const shadrach = {
    street: '64197 Peach Valley Road',
    mailing_street: '64197 Peach Valley Road',
    city: 'Montrose',
    state: 'CO',
    zip_code: '81401',
  };

  it('keeps Street and hides the matching Mailing Street', () => {
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'street',
        moduleKey: 'leads',
        values: shadrach,
      }),
    ).toBe(true);
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'mailing_street',
        moduleKey: 'leads',
        values: shadrach,
      }),
    ).toBe(false);
    expect(addressFormLabel('street', 'leads', 'Street')).toBe('Street');
  });

  it('relabels contact mailing_* to Street / City / State / Zip', () => {
    expect(addressFormLabel('mailing_street', 'contacts', 'Mailing Street')).toBe(
      'Street',
    );
    expect(addressFormLabel('mailing_city', 'contacts', 'Mailing City')).toBe('City');
    expect(addressFormLabel('mailing_state', 'contacts', 'Mailing State')).toBe(
      'State',
    );
    expect(addressFormLabel('mailing_zip', 'contacts', 'Mailing Zip')).toBe('Zip');
    expect(addressFormLabel('address_line1', 'members', 'Address')).toBe('Street');
  });
});

describe('shouldShowAddressFieldInForm — contacts leftover street', () => {
  it('hides street when it copies mailing_street', () => {
    const values = {
      mailing_street: '123 Main St',
      street: '123 Main St',
    };
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'mailing_street',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(true);
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'street',
        moduleKey: 'contacts',
        values,
      }),
    ).toBe(false);
  });

  it('hides blank aliases', () => {
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'street',
        moduleKey: 'contacts',
        values: { mailing_street: '123 Main St', street: '  ' },
      }),
    ).toBe(false);
  });
});

describe('shouldShowAddressFieldInForm — real disagreement stays', () => {
  it('shows mailing_street on a lead when it is a different PO Box', () => {
    const values = {
      street: '1901 Buttermilk Road',
      mailing_street: 'PO Box 513',
    };
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'street',
        moduleKey: 'leads',
        values,
      }),
    ).toBe(true);
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'mailing_street',
        moduleKey: 'leads',
        values,
      }),
    ).toBe(true);
    expect(addressFormLabel('mailing_street', 'leads', 'Mailing Street')).toBe(
      'Mailing Street',
    );
  });

  it('treats case/whitespace as the same address', () => {
    expect(
      shouldShowAddressFieldInForm({
        fieldKey: 'mailing_street',
        moduleKey: 'leads',
        values: {
          street: '64197  Peach Valley Road',
          mailing_street: '64197 peach valley road',
        },
      }),
    ).toBe(false);
  });
});

describe('collapseAddressListColumns', () => {
  it('keeps one line-1 column', () => {
    expect(
      collapseAddressListColumns([
        'first_name',
        'street',
        'mailing_street',
        'address_line1',
        'email',
      ]),
    ).toEqual(['first_name', 'street', 'email']);
  });

  it('prefers mailing_street on contact-like field sets', () => {
    expect(
      preferredAddressLineListColumnKey(
        new Set(['street', 'mailing_street', 'email']),
      ),
    ).toBe('mailing_street');
  });
});

describe('formatRecordAddress', () => {
  it('joins the contact mailing family into one line', () => {
    expect(
      formatRecordAddress(
        {
          mailing_street: 'P.O. Box 4935',
          mailing_city: 'Eagle',
          mailing_state: 'CO',
          mailing_zip: '81631',
        },
        'contacts',
      ),
    ).toBe('P.O. Box 4935, Eagle, CO 81631');
    expect(primaryAddressFieldKey('contacts')).toBe('mailing_street');
  });

  it('fills member address_line1 from leftover mailing_street', () => {
    expect(
      formatRecordAddress(
        {
          mailing_street: '1 Sharing Way',
          city: 'Denver',
          state: 'CO',
          zip_code: '80202',
        },
        'members',
      ),
    ).toBe('1 Sharing Way, Denver, CO 80202');
  });

  it('returns null when every slot is blank', () => {
    expect(formatRecordAddress({}, 'contacts')).toBeNull();
  });
});
