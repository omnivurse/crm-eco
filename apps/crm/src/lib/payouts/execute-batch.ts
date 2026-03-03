/**
 * Payout Batch Execution Service
 *
 * Orchestrates the execution of a payout batch:
 * 1. Calls execute_payout_batch() RPC to create provider transaction records
 * 2. For each item, calls the payment provider
 * 3. Records results via record_provider_result() RPC
 *
 * All operations are idempotent and retry-safe.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getPaymentProvider } from './providers';

interface ExecutionItem {
  txn_id: string;
  payout_item_id: string;
  advisor_id: string;
  amount: number;
  provider_type: string;
}

interface ExecutionResult {
  batchId: string;
  providerType: string;
  totalItems: number;
  succeeded: number;
  failed: number;
  items: Array<{
    txnId: string;
    payoutItemId: string;
    status: string;
    providerTransactionId: string | null;
    error?: string;
  }>;
}

/**
 * Execute all payout items in a batch through the payment provider.
 *
 * @param supabase - Service-role Supabase client
 * @param batchId - The batch to execute
 * @param providerId - Optional specific provider (uses org default if null)
 */
export async function executeBatch(
  supabase: SupabaseClient,
  batchId: string,
  providerId?: string
): Promise<ExecutionResult> {
  // Step 1: Create provider transaction records via RPC
  const { data: execData, error: execError } = await supabase.rpc(
    'execute_payout_batch',
    {
      p_batch_id: batchId,
      p_provider_id: providerId || null,
    }
  );

  if (execError) throw execError;

  if (execData?.error) {
    throw new Error(execData.error);
  }

  if (execData?.already_completed) {
    return {
      batchId,
      providerType: 'unknown',
      totalItems: 0,
      succeeded: 0,
      failed: 0,
      items: [],
    };
  }

  const items: ExecutionItem[] = execData.items || [];
  const providerType: string = execData.provider_type;
  const provider = getPaymentProvider(providerType);

  const results: ExecutionResult = {
    batchId,
    providerType,
    totalItems: items.length,
    succeeded: 0,
    failed: 0,
    items: [],
  };

  // Step 2: Process each item through the provider
  for (const item of items) {
    const result = await provider.sendPayout({
      txnId: item.txn_id,
      payoutItemId: item.payout_item_id,
      advisorId: item.advisor_id,
      amount: item.amount,
      currency: 'usd',
      idempotencyKey: `${batchId}:${item.payout_item_id}`,
      metadata: {
        batch_id: batchId,
      },
    });

    // Step 3: Record the result in DB
    const { error: recordError } = await supabase.rpc(
      'record_provider_result',
      {
        p_txn_id: item.txn_id,
        p_status: result.status,
        p_provider_txn_id: result.providerTransactionId,
        p_raw_response: result.rawResponse,
        p_failure_reason: result.failureReason || null,
        p_failure_code: result.failureCode || null,
      }
    );

    if (recordError) {
      console.error(`Failed to record result for txn ${item.txn_id}:`, recordError);
    }

    if (result.status === 'failed') {
      results.failed++;
    } else {
      results.succeeded++;
    }

    results.items.push({
      txnId: item.txn_id,
      payoutItemId: item.payout_item_id,
      status: result.status,
      providerTransactionId: result.providerTransactionId,
      error: result.failureReason,
    });
  }

  return results;
}
