import { describe, expect, it } from 'vitest';
import { mailboxAddressForOutbound } from './compose-mailbox';

describe('mailboxAddressForOutbound', () => {
  it('stores the From address so the thread lands in that mailbox folder', () => {
    expect(mailboxAddressForOutbound('Billing@PayItForwardHealth.com')).toBe(
      'billing@payitforwardhealth.com',
    );
  });

  it('unwraps a display name', () => {
    expect(mailboxAddressForOutbound('PIFH <support@payitforwardhealth.com>')).toBe(
      'support@payitforwardhealth.com',
    );
  });

  it('returns null when From is missing or not an address', () => {
    expect(mailboxAddressForOutbound(undefined)).toBeNull();
    expect(mailboxAddressForOutbound('noreply')).toBeNull();
  });
});
