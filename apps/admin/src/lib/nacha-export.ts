import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ACH_ORIGINATOR_SETTING_KEY,
  NACHA_BALANCING_ENTRY_ID,
  coalesceAccountLast4,
  generateNachaFile,
  loadAchVault,
  nextFileIdModifier,
  parseAchOriginator,
  type AchOriginatorConfig,
  type NachaEntryInput,
  type NachaFileResult,
} from '@crm-eco/lib/billing';

export const MEMBER_BANK_DETAILS_UNAVAILABLE = 'MEMBER_BANK_DETAILS_UNAVAILABLE';
export const NACHA_TRANSACTION_CLAIM_CONFLICT = 'NACHA_TRANSACTION_CLAIM_CONFLICT';

export class NachaTransactionClaimError extends Error {
  readonly code = NACHA_TRANSACTION_CLAIM_CONFLICT;

  constructor() {
    super('One or more ACH transactions were already claimed by another export. Refresh and try again.');
    this.name = 'NachaTransactionClaimError';
  }
}

export interface PendingAchTransaction {
  id: string;
  member_id: string;
  amount: number;
  transaction_type: string;
  status: string;
  payment_profile_id: string | null;
  account_last4: string | null;
  account_type: string | null;
  member_first_name: string | null;
  member_last_name: string | null;
  member_email: string | null;
}

export interface UnavailableBankDetail {
  transactionId: string;
  memberName: string;
  accountLast4: string | null;
  reason: string;
}

export async function loadAchOriginator(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AchOriginatorConfig> {
  const { data } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('organization_id', organizationId)
    .eq('setting_key', ACH_ORIGINATOR_SETTING_KEY)
    .maybeSingle();
  return parseAchOriginator(data?.setting_value ?? null);
}

export async function loadPendingAchTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  transactionIds?: string[],
): Promise<PendingAchTransaction[]> {
  let query = supabase
    .from('billing_transactions')
    .select(
      `
      id,
      member_id,
      amount,
      transaction_type,
      status,
      payment_profile_id,
      payment_profile:payment_profiles!inner(account_last4, last_four, account_type, payment_type),
      member:members(first_name, last_name, email)
    `,
    )
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .in('transaction_type', ['charge', 'refund'])
    .eq('payment_profile.payment_type', 'bank_account')
    .order('created_at', { ascending: false })
    .limit(200);

  if (transactionIds?.length) {
    query = query.in('id', transactionIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const record = row as unknown as {
      id: string;
      member_id: string;
      amount: number;
      transaction_type: string;
      status: string;
      payment_profile_id: string | null;
      payment_profile?:
        | { account_last4: string | null; last_four: string | null; account_type: string | null }
        | { account_last4: string | null; last_four: string | null; account_type: string | null }[]
        | null;
      member?:
        | { first_name: string | null; last_name: string | null; email: string | null }
        | { first_name: string | null; last_name: string | null; email: string | null }[]
        | null;
    };
    const profile = Array.isArray(record.payment_profile)
      ? record.payment_profile[0]
      : record.payment_profile;
    const member = Array.isArray(record.member) ? record.member[0] : record.member;
    return {
      id: record.id,
      member_id: record.member_id,
      amount: Number(record.amount),
      transaction_type: record.transaction_type,
      status: record.status,
      payment_profile_id: record.payment_profile_id,
      account_last4: coalesceAccountLast4(profile?.account_last4, profile?.last_four),
      account_type: profile?.account_type ?? null,
      member_first_name: member?.first_name ?? null,
      member_last_name: member?.last_name ?? null,
      member_email: member?.email ?? null,
    };
  });
}

/**
 * Phase 2: decrypt the local ACH vault. Never invent routing/account.
 * Processor vaults (NMI / Auth.net) only have last4 and cannot originate.
 */
export async function resolveMemberBankDetails(
  supabase: SupabaseClient,
  organizationId: string,
  txn: PendingAchTransaction,
): Promise<NachaEntryInput | UnavailableBankDetail> {
  const memberName = [txn.member_first_name, txn.member_last_name].filter(Boolean).join(' ').trim();
  const unavailable = (reason: string): UnavailableBankDetail => ({
    transactionId: txn.id,
    memberName: memberName || 'Unknown member',
    accountLast4: txn.account_last4,
    reason,
  });
  if (!txn.payment_profile_id) {
    return unavailable('Payment profile is missing.');
  }
  try {
    const vault = await loadAchVault(supabase, organizationId, txn.payment_profile_id);
    if (!vault) {
      return unavailable('Member routing and account are not in the ACH vault.');
    }
    const amountCents = Math.abs(Math.round(Number(txn.amount) * 100));
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return unavailable('Amount is not a positive charge or refund.');
    }
    if (txn.transaction_type !== 'charge' && txn.transaction_type !== 'refund') {
      return unavailable('Only charge and refund rows can be originated.');
    }
    return {
      transactionId: txn.id,
      transactionType: txn.transaction_type,
      amountCents,
      routingNumber: vault.routingNumber,
      accountNumber: vault.accountNumber,
      accountType: vault.accountType,
      individualName: memberName || 'Unknown member',
      individualId: txn.member_id,
      accountLast4: vault.last4,
    };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'ACH vault could not be read.');
  }
}

export async function countExportsToday(
  supabase: SupabaseClient,
  organizationId: string,
  now = new Date(),
): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { count, error } = await supabase
    .from('nacha_files')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('file_type', 'export')
    .gte('created_at', start.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function buildResolvedEntries(
  supabase: SupabaseClient,
  organizationId: string,
  txns: PendingAchTransaction[],
): Promise<{
  entries: NachaEntryInput[];
  unavailable: UnavailableBankDetail[];
}> {
  const entries: NachaEntryInput[] = [];
  const unavailable: UnavailableBankDetail[] = [];
  for (const txn of txns) {
    const resolved = await resolveMemberBankDetails(supabase, organizationId, txn);
    if ('reason' in resolved) {
      unavailable.push(resolved);
      continue;
    }
    entries.push(resolved);
  }
  return { entries, unavailable };
}

export async function persistNachaExport(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  profileId: string;
  originator: AchOriginatorConfig;
  effectiveDate: string;
  txns: PendingAchTransaction[];
  file: NachaFileResult;
}): Promise<string> {
  const { supabase, organizationId, profileId, originator, effectiveDate, txns, file } = opts;
  const { data: inserted, error: fileError } = await supabase
    .from('nacha_files')
    .insert({
      organization_id: organizationId,
      file_type: 'export',
      file_name: file.fileName,
      status: 'generated',
      effective_date: effectiveDate,
      file_content: null,
      file_size: file.contents.length,
      batch_count: 1,
      total_debit_amount: file.debitCents / 100,
      total_credit_amount: file.creditCents / 100,
      transaction_count: txns.length,
      company_name: originator.companyName,
      company_id: originator.companyId,
      odfi_id: originator.odfiId,
      created_by: profileId,
      processing_notes: (() => {
        const balancing = file.traces.find((trace) => trace.transactionId === NACHA_BALANCING_ENTRY_ID);
        return {
          fileIdModifier: file.lines[0]?.[33] ?? null,
          entryHash: file.entryHash,
          serviceClassCode: file.serviceClassCode,
          balanced: file.debitCents === file.creditCents,
          balancingEntry: balancing
            ? {
                traceNumber: balancing.traceNumber,
                amountCents: balancing.amountCents,
                transactionCode: balancing.transactionCode,
                accountLast4: balancing.accountLast4,
              }
            : null,
          redacted: true,
        };
      })(),
    })
    .select('id')
    .single();

  if (fileError || !inserted) {
    throw new Error(fileError?.message || 'Failed to record NACHA file');
  }

  const transactionIds = txns.map((txn) => txn.id);
  const submittedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('billing_transactions')
    .update({
      status: 'processing',
      nacha_job_id: inserted.id,
      submitted_at: submittedAt,
    })
    .in('id', transactionIds)
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .select('id');

  const claimedIds = (claimed ?? []).map((row) => row.id as string);
  if (claimError || claimedIds.length !== transactionIds.length) {
    if (claimedIds.length > 0) {
      await supabase
        .from('billing_transactions')
        .update({
          status: 'pending',
          nacha_job_id: null,
          submitted_at: null,
        })
        .in('id', claimedIds)
        .eq('organization_id', organizationId)
        .eq('nacha_job_id', inserted.id)
        .eq('status', 'processing');
    }
    const message =
      claimError?.message ??
      'One or more ACH transactions were already claimed by another export.';
    await supabase
      .from('nacha_files')
      .update({ status: 'failed', error_message: message })
      .eq('id', inserted.id);
    if (claimError) throw new Error(claimError.message);
    throw new NachaTransactionClaimError();
  }

  const tracesByTxn = new Map(file.traces.map((trace) => [trace.transactionId, trace]));
  const lineRows = txns.map((txn) => {
    const trace = tracesByTxn.get(txn.id);
    return {
      nacha_file_id: inserted.id,
      transaction_id: txn.id,
      trace_number: trace?.traceNumber ?? null,
      entry_status: 'originated',
    };
  });

  const { error: linesError } = await supabase.from('nacha_file_transactions').insert(lineRows);
  if (linesError) {
    await supabase
      .from('billing_transactions')
      .update({
        status: 'pending',
        nacha_job_id: null,
        submitted_at: null,
      })
      .in('id', claimedIds)
      .eq('organization_id', organizationId)
      .eq('nacha_job_id', inserted.id)
      .eq('status', 'processing');
    await supabase
      .from('nacha_files')
      .update({ status: 'failed', error_message: linesError.message })
      .eq('id', inserted.id);
    throw new Error(linesError.message);
  }

  await recordNachaJobRun({
    supabase,
    organizationId,
    profileId,
    jobType: 'nacha_export',
    jobName: file.fileName,
    status: 'completed',
    recordsProcessed: txns.length,
    recordsSucceeded: txns.length,
    result: { nachaFileId: inserted.id, fileName: file.fileName },
  });

  return inserted.id;
}

export async function recordNachaJobRun(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  profileId?: string | null;
  jobType: 'nacha_export' | 'nacha_import';
  jobName: string;
  status: 'completed' | 'failed';
  errorMessage?: string | null;
  recordsProcessed?: number;
  recordsSucceeded?: number;
  recordsFailed?: number;
  result?: Record<string, unknown>;
  triggerType?: 'manual' | 'system';
}): Promise<string | null> {
  const started = new Date();
  const { data, error } = await opts.supabase
    .from('job_runs')
    .insert({
      organization_id: opts.organizationId,
      job_type: opts.jobType,
      job_name: opts.jobName,
      status: opts.status,
      trigger_type: opts.triggerType ?? 'manual',
      triggered_by: opts.profileId ?? null,
      started_at: started.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Math.max(0, Date.now() - started.getTime()),
      records_processed: opts.recordsProcessed ?? 0,
      records_succeeded: opts.recordsSucceeded ?? 0,
      records_failed: opts.recordsFailed ?? 0,
      error_message: opts.errorMessage ?? null,
      result: opts.result ?? {},
      logs: [
        {
          timestamp: started.toISOString(),
          level: opts.status === 'failed' ? 'error' : 'info',
          message: opts.errorMessage || `${opts.jobName} ${opts.status}`,
        },
      ],
    })
    .select('id')
    .single();

  if (error) {
    console.error('[nacha] job_runs insert failed', error.message);
    return null;
  }
  return data?.id ?? null;
}

export function generateFromResolved(opts: {
  originator: AchOriginatorConfig;
  entries: NachaEntryInput[];
  effectiveDate: string;
  fileIdModifier: string;
  createdAt?: Date;
}) {
  return generateNachaFile(opts);
}

export { nextFileIdModifier };
