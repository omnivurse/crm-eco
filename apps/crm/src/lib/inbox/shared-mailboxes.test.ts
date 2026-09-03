import { describe, expect, it } from 'vitest';
import {
  buildSharedMailboxes,
  compareMailboxes,
  mailboxLabel,
  mailboxLocalPart,
} from './shared-mailboxes';

describe('mailboxLocalPart', () => {
  it('lowercases the local part', () => {
    expect(mailboxLocalPart('Billing@PayItForwardHealth.com')).toBe('billing');
  });
});

describe('mailboxLabel', () => {
  it('uses the purpose label for known role addresses', () => {
    expect(mailboxLabel('billing@payitforwardhealth.com')).toBe('Billing');
    expect(mailboxLabel('support@payitforwardhealth.com')).toBe('Member & general support');
    expect(mailboxLabel('noreply@payitforwardhealth.com')).toBe('System / automated');
  });

  it('falls back to the registry name for a person mailbox', () => {
    expect(mailboxLabel('wendy@payitforwardhealth.com', 'Wendy Scipione')).toBe('Wendy Scipione');
  });

  it('titleizes an unknown address with no registry name', () => {
    expect(mailboxLabel('owens@payitforwardhealth.com')).toBe('Owens');
  });

  it('applies labels across subdomains', () => {
    expect(mailboxLabel('support@mail.payitforwardhealth.com')).toBe('Member & general support');
  });
});

describe('compareMailboxes', () => {
  it('puts human-worked queues ahead of automated ones', () => {
    const sorted = [
      'noreply@pifh.com',
      'notifications@pifh.com',
      'support@pifh.com',
      'billing@pifh.com',
    ].sort(compareMailboxes);

    expect(sorted).toEqual([
      'support@pifh.com',
      'billing@pifh.com',
      'notifications@pifh.com',
      'noreply@pifh.com',
    ]);
  });

  it('puts person mailboxes ahead of purpose and automated queues', () => {
    const sorted = ['zeta@pifh.com', 'wendy@pifh.com', 'noreply@pifh.com', 'support@pifh.com'].sort(
      compareMailboxes,
    );
    expect(sorted).toEqual([
      'wendy@pifh.com',
      'zeta@pifh.com',
      'support@pifh.com',
      'noreply@pifh.com',
    ]);
  });
});

describe('buildSharedMailboxes', () => {
  const registry = [
    { email: 'noreply@payitforwardhealth.com', name: 'Pay It Forward Health' },
    { email: 'support@payitforwardhealth.com', name: 'Pay It Forward Health Support' },
    { email: 'wendy@payitforwardhealth.com', name: 'Wendy Scipione' },
  ];

  it('keeps quiet mailboxes visible with a zero count', () => {
    const boxes = buildSharedMailboxes(registry, {
      'support@payitforwardhealth.com': 4,
    });

    expect(boxes.map((b) => [b.email, b.unreadCount])).toEqual([
      ['wendy@payitforwardhealth.com', 0],
      ['support@payitforwardhealth.com', 4],
      ['noreply@payitforwardhealth.com', 0],
    ]);
  });

  it('normalizes case and drops duplicate registry rows', () => {
    const boxes = buildSharedMailboxes(
      [
        { email: 'Billing@PayItForwardHealth.com', name: 'Billing' },
        { email: 'billing@payitforwardhealth.com', name: 'Billing dup' },
      ],
      { 'billing@payitforwardhealth.com': 2 },
    );

    expect(boxes).toHaveLength(1);
    expect(boxes[0].email).toBe('billing@payitforwardhealth.com');
    expect(boxes[0].unreadCount).toBe(2);
  });

  it('ignores blank rows rather than rendering an empty queue', () => {
    expect(buildSharedMailboxes([{ email: '' }], {})).toEqual([]);
  });
});
