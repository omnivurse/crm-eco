/**
 * The payout RPCs (`approve_payout_batch`, `mark_payout_paid`,
 * `mark_payout_failed`, `reconcile_payouts`, `detect_payout_anomalies`) all
 * return a `jsonb` envelope, which the generated Supabase types surface as the
 * wide `Json` union. Reading `data.error` off that union does not compile, and
 * casting with `as any` at each call site throws away the check entirely.
 *
 * `asPayoutRpcResult` narrows at runtime instead: a JSON object becomes an
 * indexable record, while a scalar or array — which would mean the function
 * returned something other than the documented envelope — becomes null, so
 * callers handle it explicitly rather than reading properties off a string.
 */
export interface PayoutRpcResult {
  /** Present when the RPC refused the operation (compliance block, bad state). */
  error?: string;
  /** Machine-readable refusal code, e.g. SELF_APPROVE_BLOCKED, DUPLICATE_APPROVAL. */
  code?: string;
  [key: string]: unknown;
}

export function asPayoutRpcResult(data: unknown): PayoutRpcResult | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  return data as PayoutRpcResult;
}

/** Read a numeric field off an RPC envelope, or null when absent/not a number. */
export function payoutRpcNumber(
  result: PayoutRpcResult | null,
  key: string
): number | null {
  const value = result?.[key];
  return typeof value === 'number' ? value : null;
}
