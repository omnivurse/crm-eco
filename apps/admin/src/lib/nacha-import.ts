import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AchVaultError,
  applyNocCorrection,
  coalesceAccountLast4,
  loadAchVault,
  persistAchVault,
  parseNachaReturnFile,
  nocAccountTypeFromCorrectedData,
  matchSettlementOffsetReturn,
  readBalancingTraceFromNotes,
  NachaReturnParseError,
  type NachaBalancingTrace,
  type NachaReturnEntry,
} from '@crm-eco/lib/billing';
import { recordNachaJobRun } from '@/lib/nacha-export';
import { matchReturnCandidate } from '@/lib/nacha-return-match';

export const UNMATCHED_TRACES = 'UNMATCHED_TRACES';
export const ALREADY_POSTED = 'ALREADY_POSTED';
export const NOC_VAULT_UNAVAILABLE = 'NOC_VAULT_UNAVAILABLE';

export interface MatchedReturnRow {
  entry: NachaReturnEntry;
  fileTransactionId: string;
  transactionId: string;
  paymentProfileId: string | null;
  billingScheduleId: string | null;
  memberId: string;
  amount: number;
  status: string;
  entryStatus: string | null;
  alreadyPosted: boolean;
}

export interface UnmatchedReturnRow {
  originalTrace: string;
  kind: NachaReturnEntry['kind'];
  code: string;
  amountCents: number;
  accountLast4: string | null;
}

export interface SettlementReturnRow {
  originalTrace: string;
  kind: NachaReturnEntry['kind'];
  code: string;
  reason: string;
  amountCents: number;
  accountLast4: string | null;
  nachaFileId?: string;
}

export interface NachaImportPreview {
  fileDate: string;
  fileHash: string;
  returnCount: number;
  nocCount: number;
  matched: MatchedReturnRow[];
  unmatched: UnmatchedReturnRow[];
  settlementReturns: SettlementReturnRow[];
  nocBlocked: Array<{ originalTrace: string; code: string; reason: string }>;
}

function fileHash(contents: string): string {
  return createHash('sha256').update(contents.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).digest('hex');
}

export async function buildNachaImportPreview(
  supabase: SupabaseClient,
  organizationId: string,
  contents: string,
): Promise<NachaImportPreview> {
  const parsed = parseNachaReturnFile(contents);
  const traces = [...new Set(parsed.entries.map((entry) => entry.originalTrace))];
  const { data: lineRows, error: lineError } = await supabase
    .from('nacha_file_transactions')
    .select(
      `
      id,
      transaction_id,
      trace_number,
      entry_status,
      return_code,
      nacha_file:nacha_files!inner(id, organization_id, file_type)
    `,
    )
    .in('trace_number', traces);
  if (lineError) throw new Error(lineError.message);

  const linesByTrace = new Map<
    string,
    Array<{
      id: string;
      transaction_id: string;
      entry_status: string | null;
      return_code: string | null;
    }>
  >();
  for (const row of lineRows ?? []) {
    const rec = row as {
      id: string;
      transaction_id: string;
      trace_number: string | null;
      entry_status: string | null;
      return_code: string | null;
      nacha_file?:
        | { id: string; organization_id: string; file_type: string }
        | { id: string; organization_id: string; file_type: string }[];
    };
    const file = Array.isArray(rec.nacha_file) ? rec.nacha_file[0] : rec.nacha_file;
    if (!file || file.organization_id !== organizationId || file.file_type !== 'export') continue;
    if (rec.trace_number) {
      const candidates = linesByTrace.get(rec.trace_number) ?? [];
      candidates.push(rec);
      linesByTrace.set(rec.trace_number, candidates);
    }
  }

  const { data: exportFiles, error: exportError } = await supabase
    .from('nacha_files')
    .select('id, processing_notes')
    .eq('organization_id', organizationId)
    .eq('file_type', 'export')
    .order('created_at', { ascending: false })
    .limit(100);
  if (exportError) throw new Error(exportError.message);
  const balancingTraces: NachaBalancingTrace[] = [];
  for (const file of exportFiles ?? []) {
    const balancing = readBalancingTraceFromNotes(file.processing_notes, file.id);
    if (balancing) balancingTraces.push(balancing);
  }

  const txnIds = [
    ...new Set(
      [...linesByTrace.values()].flatMap((candidates) =>
        candidates.map((row) => row.transaction_id),
      ),
    ),
  ];
  const txns = new Map<
    string,
    {
      id: string;
      payment_profile_id: string | null;
      billing_schedule_id: string | null;
      member_id: string;
      amount: number;
      status: string;
      account_last4: string | null;
    }
  >();
  if (txnIds.length) {
    const { data: txnRows, error: txnError } = await supabase
      .from('billing_transactions')
      .select(
        'id, payment_profile_id, billing_schedule_id, member_id, amount, status, payment_profile:payment_profiles(account_last4, last_four)',
      )
      .eq('organization_id', organizationId)
      .in('id', txnIds);
    if (txnError) throw new Error(txnError.message);
    for (const raw of txnRows ?? []) {
      const txn = raw as typeof raw & {
        payment_profile?:
          | { account_last4: string | null; last_four: string | null }
          | Array<{ account_last4: string | null; last_four: string | null }>
          | null;
      };
      const profile = Array.isArray(txn.payment_profile)
        ? txn.payment_profile[0]
        : txn.payment_profile;
      txns.set(txn.id, {
        id: txn.id,
        payment_profile_id: txn.payment_profile_id,
        billing_schedule_id: txn.billing_schedule_id,
        member_id: txn.member_id,
        amount: Number(txn.amount),
        status: txn.status,
        account_last4: coalesceAccountLast4(
          profile?.account_last4,
          profile?.last_four,
        ),
      });
    }
  }

  const matched: MatchedReturnRow[] = [];
  const unmatched: UnmatchedReturnRow[] = [];
  const settlementReturns: SettlementReturnRow[] = [];
  const nocBlocked: NachaImportPreview['nocBlocked'] = [];

  for (const entry of parsed.entries) {
    const candidates = (linesByTrace.get(entry.originalTrace) ?? []).flatMap((line) => {
      const transaction = txns.get(line.transaction_id);
      return transaction ? [{ line, transaction }] : [];
    });
    const matchedCandidate = matchReturnCandidate(candidates, entry);
    const line = matchedCandidate?.line;
    const txn = matchedCandidate?.transaction;
    if (!line || !txn) {
      if (candidates.length === 0) {
        const settlement = matchSettlementOffsetReturn(
          balancingTraces,
          entry.originalTrace,
          entry.amountCents,
          entry.accountLast4,
        );
        if (settlement) {
          settlementReturns.push({
            originalTrace: entry.originalTrace,
            kind: entry.kind,
            code: entry.code,
            reason: entry.reason,
            amountCents: entry.amountCents,
            accountLast4: entry.accountLast4,
            nachaFileId: settlement.nachaFileId,
          });
          continue;
        }
      }
      unmatched.push({
        originalTrace: entry.originalTrace,
        kind: entry.kind,
        code: entry.code,
        amountCents: entry.amountCents,
        accountLast4: entry.accountLast4,
      });
      continue;
    }
    const alreadyPosted =
      line.entry_status === 'returned' &&
      entry.kind === 'return' &&
      line.return_code === entry.code;
    if (entry.kind === 'noc' && !alreadyPosted) {
      if (!txn.payment_profile_id) {
        nocBlocked.push({
          originalTrace: entry.originalTrace,
          code: entry.code,
          reason: 'Payment profile is missing; NOC cannot update the vault.',
        });
      } else {
        const vault = await loadAchVault(supabase, organizationId, txn.payment_profile_id);
        if (!vault && entry.code !== 'C05') {
          nocBlocked.push({
            originalTrace: entry.originalTrace,
            code: entry.code,
            reason: 'ACH vault is empty. Do not invent routing or account from the NOC last4.',
          });
        } else if (!vault && entry.code === 'C05') {
          try {
            nocAccountTypeFromCorrectedData(entry.correctedData);
          } catch (error) {
            nocBlocked.push({
              originalTrace: entry.originalTrace,
              code: entry.code,
              reason: error instanceof Error ? error.message : 'NOC correction is invalid.',
            });
          }
        } else if (vault) {
          try {
            applyNocCorrection(vault, entry.code, entry.correctedData);
          } catch (error) {
            nocBlocked.push({
              originalTrace: entry.originalTrace,
              code: entry.code,
              reason: error instanceof Error ? error.message : 'NOC correction is invalid.',
            });
          }
        }
      }
    }
    matched.push({
      entry,
      fileTransactionId: line.id,
      transactionId: txn.id,
      paymentProfileId: txn.payment_profile_id,
      billingScheduleId: txn.billing_schedule_id,
      memberId: txn.member_id,
      amount: Number(txn.amount),
      status: txn.status,
      entryStatus: line.entry_status,
      alreadyPosted,
    });
  }

  return {
    fileDate: parsed.fileDate,
    fileHash: fileHash(contents),
    returnCount: parsed.returnCount,
    nocCount: parsed.nocCount,
    matched,
    unmatched,
    settlementReturns,
    nocBlocked,
  };
}

export async function persistNachaImport(opts: {
  supabase: SupabaseClient;
  organizationId: string;
  profileId: string;
  fileName: string;
  contents: string;
  preview?: boolean;
}): Promise<{
  preview: NachaImportPreview;
  nachaFileId?: string;
  posted: number;
  alreadyPosted: number;
}> {
  const preview = await buildNachaImportPreview(
    opts.supabase,
    opts.organizationId,
    opts.contents,
  );

  const { data: priorImports } = await opts.supabase
    .from('nacha_files')
    .select('id, status, processing_notes')
    .eq('organization_id', opts.organizationId)
    .eq('file_type', 'import')
    .order('created_at', { ascending: false })
    .limit(100);
  const existing = (priorImports ?? []).find((row) => {
    const notes = row.processing_notes as { fileHash?: string } | null;
    return notes?.fileHash === preview.fileHash && row.status === 'processed';
  });

  if (existing) {
    await recordNachaJobRun({
      supabase: opts.supabase,
      organizationId: opts.organizationId,
      profileId: opts.profileId,
      jobType: 'nacha_import',
      jobName: opts.fileName,
      status: 'failed',
      errorMessage: 'This return file was already posted.',
      result: { code: ALREADY_POSTED, nachaFileId: existing.id },
    });
    const error = new Error('This return file was already posted.') as Error & { code?: string };
    error.code = ALREADY_POSTED;
    throw error;
  }

  if (opts.preview) {
    return { preview, posted: 0, alreadyPosted: preview.matched.filter((row) => row.alreadyPosted).length };
  }

  if (preview.unmatched.length) {
    await writeFailedImport(opts, preview, 'One or more original traces are not in an originated export for this organization.');
    const error = new Error(
      'Unmatched original traces. Do not invent a billing row, and do not mark other ACH items success.',
    ) as Error & { code?: string; unmatched?: UnmatchedReturnRow[] };
    error.code = UNMATCHED_TRACES;
    error.unmatched = preview.unmatched;
    throw error;
  }
  if (preview.nocBlocked.length) {
    await writeFailedImport(opts, preview, preview.nocBlocked[0]?.reason ?? 'NOC could not be applied.');
    const error = new Error(preview.nocBlocked[0]?.reason ?? 'NOC could not be applied.') as Error & {
      code?: string;
    };
    error.code = NOC_VAULT_UNAVAILABLE;
    throw error;
  }

  const { data: inserted, error: fileError } = await opts.supabase
    .from('nacha_files')
    .insert({
      organization_id: opts.organizationId,
      file_type: 'import',
      file_name: opts.fileName.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'ACH_RETURNS.txt',
      status: 'processing',
      effective_date: preview.fileDate,
      file_content: null,
      transaction_count: preview.matched.length + preview.settlementReturns.length,
      return_count: preview.returnCount,
      processed_count: 0,
      failed_count: 0,
      success_count: 0,
      created_by: opts.profileId,
      processing_notes: {
        fileHash: preview.fileHash,
        redacted: true,
        returns: preview.matched
          .filter((row) => row.entry.kind === 'return')
          .map((row) => ({
            transactionId: row.transactionId,
            code: row.entry.code,
            accountLast4: row.entry.accountLast4,
          })),
        nocs: preview.matched
          .filter((row) => row.entry.kind === 'noc')
          .map((row) => ({
            transactionId: row.transactionId,
            code: row.entry.code,
            accountLast4: row.entry.accountLast4,
          })),
        settlementReturns: preview.settlementReturns.map((row) => ({
          originalTrace: row.originalTrace,
          code: row.code,
          amountCents: row.amountCents,
          accountLast4: row.accountLast4,
          nachaFileId: row.nachaFileId ?? null,
        })),
      },
    })
    .select('id')
    .single();
  if (fileError || !inserted) {
    throw new Error(fileError?.message || 'Failed to record return file');
  }

  let posted = 0;
  let alreadyPosted = 0;
  try {
    for (const row of preview.matched) {
      if (row.alreadyPosted) {
        alreadyPosted += 1;
        continue;
      }
      if (row.entry.kind === 'return') {
        await postReturn(opts.supabase, opts.organizationId, row);
      } else {
        await postNoc(opts.supabase, opts.organizationId, opts.profileId, row);
      }
      posted += 1;
    }

    const { data: completed, error: completeError } = await opts.supabase
      .from('nacha_files')
      .update({
        status: 'processed',
        processed_count: preview.matched.length + preview.settlementReturns.length,
        failed_count: preview.matched.filter((row) => row.entry.kind === 'return').length,
      })
      .eq('id', inserted.id)
      .eq('status', 'processing')
      .select('id')
      .maybeSingle();
    if (completeError || !completed) {
      throw new Error(completeError?.message || 'Return import could not be finalized');
    }
  } catch (error) {
    await opts.supabase
      .from('nacha_files')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Return posting failed',
      })
      .eq('id', inserted.id);
    throw error;
  }

  await recordNachaJobRun({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    profileId: opts.profileId,
    jobType: 'nacha_import',
    jobName: opts.fileName,
    status: 'completed',
    recordsProcessed: preview.matched.length + preview.settlementReturns.length,
    recordsSucceeded: posted + alreadyPosted + preview.settlementReturns.length,
    recordsFailed: 0,
    result: {
      nachaFileId: inserted.id,
      fileHash: preview.fileHash,
      posted,
      alreadyPosted,
      settlementReturns: preview.settlementReturns.length,
    },
  });

  return { preview, nachaFileId: inserted.id, posted, alreadyPosted };
}

async function writeFailedImport(
  opts: { supabase: SupabaseClient; organizationId: string; profileId: string; fileName: string },
  preview: NachaImportPreview,
  message: string,
) {
  await opts.supabase.from('nacha_files').insert({
    organization_id: opts.organizationId,
    file_type: 'import',
    file_name: opts.fileName.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'ACH_RETURNS.txt',
    status: 'failed',
    effective_date: preview.fileDate,
    file_content: null,
    transaction_count:
      preview.matched.length + preview.unmatched.length + preview.settlementReturns.length,
    return_count: preview.returnCount,
    error_message: message,
    created_by: opts.profileId,
    processing_notes: {
      fileHash: preview.fileHash,
      redacted: true,
      unmatched: preview.unmatched,
      settlementReturns: preview.settlementReturns,
      nocBlocked: preview.nocBlocked,
    },
  });
  await recordNachaJobRun({
    supabase: opts.supabase,
    organizationId: opts.organizationId,
    profileId: opts.profileId,
    jobType: 'nacha_import',
    jobName: opts.fileName,
    status: 'failed',
    errorMessage: message,
    recordsProcessed: preview.matched.length + preview.unmatched.length,
    recordsFailed: preview.unmatched.length + preview.nocBlocked.length,
    result: {
      unmatched: preview.unmatched,
      nocBlocked: preview.nocBlocked,
    },
  });
}

async function postReturn(
  supabase: SupabaseClient,
  organizationId: string,
  row: MatchedReturnRow,
) {
  const { error: txnError } = await supabase
    .from('billing_transactions')
    .update({
      status: 'failed',
      error_code: row.entry.code,
      error_message: row.entry.reason,
      processed_at: new Date().toISOString(),
    })
    .eq('id', row.transactionId)
    .eq('organization_id', organizationId);
  if (txnError) throw new Error(txnError.message);

  const { error: lineError } = await supabase
    .from('nacha_file_transactions')
    .update({
      entry_status: 'returned',
      return_code: row.entry.code,
      return_reason: row.entry.reason,
      addenda_info: row.entry.addendaInfo || null,
    })
    .eq('id', row.fileTransactionId);
  if (lineError) throw new Error(lineError.message);

  if (!row.billingScheduleId) return;
  const { data: existing } = await supabase
    .from('billing_failures')
    .select('id')
    .eq('billing_transaction_id', row.transactionId)
    .eq('resolved', false)
    .maybeSingle();
  if (existing) return;
  const { error: failError } = await supabase.from('billing_failures').insert({
    organization_id: organizationId,
    billing_schedule_id: row.billingScheduleId,
    billing_transaction_id: row.transactionId,
    member_id: row.memberId,
    amount: row.amount,
    failure_reason: row.entry.reason,
    failure_code: row.entry.code,
    status: 'pending',
    resolved: false,
    retry_attempt: 0,
    retry_scheduled: true,
    next_retry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  if (failError) throw new Error(failError.message);
}

async function postNoc(
  supabase: SupabaseClient,
  organizationId: string,
  profileId: string,
  row: MatchedReturnRow,
) {
  if (row.paymentProfileId) {
    const vault = await loadAchVault(supabase, organizationId, row.paymentProfileId);
    if (vault) {
      const next = applyNocCorrection(vault, row.entry.code, row.entry.correctedData);
      await persistAchVault(supabase, organizationId, row.paymentProfileId, next, profileId);
      const { error: profileError } = await supabase
        .from('payment_profiles')
        .update({
          account_last4: next.last4,
          last_four: next.last4,
          account_type: next.accountType,
        })
        .eq('id', row.paymentProfileId)
        .eq('organization_id', organizationId);
      if (profileError) throw new Error(profileError.message);
    } else if (row.entry.code === 'C05') {
      const accountType = nocAccountTypeFromCorrectedData(row.entry.correctedData);
      const { error: profileError } = await supabase
        .from('payment_profiles')
        .update({ account_type: accountType })
        .eq('id', row.paymentProfileId)
        .eq('organization_id', organizationId);
      if (profileError) throw new Error(profileError.message);
    } else {
      throw new AchVaultError(NOC_VAULT_UNAVAILABLE, 'ACH vault is empty for this NOC.');
    }
  }

  const { error: lineError } = await supabase
    .from('nacha_file_transactions')
    .update({
      entry_status: 'noc',
      return_code: row.entry.code,
      return_reason: row.entry.reason,
      addenda_info: row.entry.accountLast4 ? `last4:${row.entry.accountLast4}` : null,
    })
    .eq('id', row.fileTransactionId);
  if (lineError) throw new Error(lineError.message);
}

export { NachaReturnParseError };
