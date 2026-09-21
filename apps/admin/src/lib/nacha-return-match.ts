export interface ReturnMatchCandidate {
  line: {
    id: string;
    transaction_id: string;
    entry_status: string | null;
    return_code: string | null;
  };
  transaction: {
    id: string;
    payment_profile_id: string | null;
    billing_schedule_id: string | null;
    member_id: string;
    amount: number;
    status: string;
    account_last4: string | null;
  };
}

/** Fail closed when a reused trace cannot be tied to exactly one originated transaction. */
export function matchReturnCandidate(
  candidates: ReturnMatchCandidate[],
  entry: { amountCents: number; accountLast4: string | null },
): ReturnMatchCandidate | null {
  const matches = candidates.filter(({ transaction }) => {
    const amountCents = Math.abs(Math.round(Number(transaction.amount) * 100));
    if (amountCents !== entry.amountCents) return false;
    if (
      entry.accountLast4 &&
      transaction.account_last4 &&
      entry.accountLast4 !== transaction.account_last4
    ) {
      return false;
    }
    return true;
  });
  return matches.length === 1 ? matches[0] : null;
}
