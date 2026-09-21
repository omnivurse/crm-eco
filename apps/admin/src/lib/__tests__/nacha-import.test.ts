import { describe, expect, it } from 'vitest';
import { matchReturnCandidate } from '../nacha-return-match';

function candidate(
  id: string,
  amount: number,
  accountLast4: string | null,
) {
  return {
    line: {
      id: `line-${id}`,
      transaction_id: id,
      entry_status: 'originated',
      return_code: null,
    },
    transaction: {
      id,
      payment_profile_id: `profile-${id}`,
      billing_schedule_id: null,
      member_id: `member-${id}`,
      amount,
      status: 'processing',
      account_last4: accountLast4,
    },
  };
}

describe('matchReturnCandidate', () => {
  it('uses amount to disambiguate a reused trace number', () => {
    const first = candidate('first', 10, '1111');
    const second = candidate('second', 20, '2222');

    expect(
      matchReturnCandidate([first, second], {
        amountCents: 2000,
        accountLast4: '2222',
      }),
    ).toEqual(second);
  });

  it('uses account last4 when reused traces have the same amount', () => {
    const first = candidate('first', 10, '1111');
    const second = candidate('second', 10, '2222');

    expect(
      matchReturnCandidate([first, second], {
        amountCents: 1000,
        accountLast4: '2222',
      }),
    ).toEqual(second);
  });

  it('fails closed when reused trace metadata still matches multiple transactions', () => {
    const first = candidate('first', 10, '1111');
    const second = candidate('second', 10, '1111');

    expect(
      matchReturnCandidate([first, second], {
        amountCents: 1000,
        accountLast4: '1111',
      }),
    ).toBeNull();
  });
});
