import { describe, expect, it } from 'vitest';
import {
  formatPhoneOwnerLabel,
  isCleanPhoneValue,
  phoneOwnerFieldKey,
  phoneOwnerNameFieldKey,
} from './phone-owner';

describe('phone-owner', () => {
  it('builds companion field keys', () => {
    expect(phoneOwnerFieldKey('mobile')).toBe('mobile_owner');
    expect(phoneOwnerNameFieldKey('phone2')).toBe('phone2_owner_name');
  });

  it('formats owner + name badge labels', () => {
    expect(
      formatPhoneOwnerLabel('mobile', {
        mobile_owner: 'Spouse / Partner',
        mobile_owner_name: 'Alex',
      }),
    ).toBe('Spouse / Partner · Alex');
    expect(
      formatPhoneOwnerLabel('phone', { phone_owner: 'Parent / Guardian' }),
    ).toBe('Parent / Guardian');
    expect(formatPhoneOwnerLabel('phone', {})).toBeNull();
    expect(formatPhoneOwnerLabel('fax', { fax_owner: 'Self' })).toBeNull();
  });

  it('accepts clean dialable values and rejects letters', () => {
    expect(isCleanPhoneValue('303-555-1212')).toBe(true);
    expect(isCleanPhoneValue('(303) 555-1212')).toBe(true);
    expect(isCleanPhoneValue('')).toBe(true);
    expect(isCleanPhoneValue('303-555-1212 J')).toBe(false);
    expect(isCleanPhoneValue('3035551212 Cody')).toBe(false);
  });
});
