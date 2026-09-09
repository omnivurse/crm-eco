import { describe, expect, it } from 'vitest';
import { pickInitialSender } from './sender-select';

const addresses = [
  { id: '1', email: 'billing@payitforwardhealth.com', is_default: false },
  { id: '2', email: 'wendy@payitforwardhealth.com', is_default: true },
];

describe('pickInitialSender', () => {
  it('prefers the mailbox the reply belongs to over the org default', () => {
    expect(pickInitialSender(addresses, 'billing@payitforwardhealth.com')?.id).toBe('1');
  });

  it('falls back to the default sender for a new compose', () => {
    expect(pickInitialSender(addresses)?.id).toBe('2');
    expect(pickInitialSender(addresses, '   ')?.id).toBe('2');
  });

  it('returns null when there are no senders', () => {
    expect(pickInitialSender([])).toBeNull();
  });
});
