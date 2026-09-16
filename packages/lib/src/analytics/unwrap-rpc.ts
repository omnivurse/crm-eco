/**
 * Advisor / healthcare RPCs return jsonb `{ rows, total }`.
 * Some callers historically treated the whole object as an array.
 */

export interface AdvisorRpcEnvelope {
  rows: Record<string, unknown>[];
  total: number;
}

export function unwrapAdvisorRpcResult(rpcData: unknown): AdvisorRpcEnvelope {
  if (rpcData == null) {
    return { rows: [], total: 0 };
  }

  if (Array.isArray(rpcData)) {
    return { rows: rpcData as Record<string, unknown>[], total: rpcData.length };
  }

  if (typeof rpcData === 'object') {
    const envelope = rpcData as Record<string, unknown>;
    // Live widget RPCs wrap lists under different keys:
    // advisor templates → rows; churn → advisors; retention → months.
    const listKey = ['rows', 'data', 'advisors', 'months'].find((key) =>
      Array.isArray(envelope[key]),
    );

    if (listKey) {
      const rows = envelope[listKey] as Record<string, unknown>[];
      const total = typeof envelope.total === 'number' ? envelope.total : rows.length;
      return { rows, total };
    }
  }

  return { rows: [], total: 0 };
}
