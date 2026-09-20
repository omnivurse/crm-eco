import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { loadAchVaultPresence, NachaConfigError, NachaGenerateError } from '@crm-eco/lib/billing';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';
import {
  MEMBER_BANK_DETAILS_UNAVAILABLE,
  buildResolvedEntries,
  countExportsToday,
  generateFromResolved,
  loadAchOriginator,
  loadPendingAchTransactions,
  nextFileIdModifier,
  persistNachaExport,
  recordNachaJobRun,
} from '@/lib/nacha-export';

export const dynamic = 'force-dynamic';

function jsonError(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const supabase = createServiceRoleClient();
  const txns = await loadPendingAchTransactions(supabase, profile.organization_id);
  const vaultReady = await loadAchVaultPresence(
    supabase,
    profile.organization_id,
    txns.map((txn) => txn.payment_profile_id).filter((id): id is string => Boolean(id)),
  );
  let originatorComplete = false;
  let missing: string[] = [];
  try {
    await loadAchOriginator(supabase, profile.organization_id);
    originatorComplete = true;
  } catch (err) {
    if (err instanceof NachaConfigError) missing = err.missing;
    else throw err;
  }

  return NextResponse.json({
    originatorComplete,
    missing,
    transactions: txns.map((txn) => ({
      id: txn.id,
      memberId: txn.member_id,
      amount: txn.amount,
      transactionType: txn.transaction_type,
      accountLast4: txn.account_last4,
      accountType: txn.account_type,
      vaultReady: Boolean(txn.payment_profile_id && vaultReady.has(txn.payment_profile_id)),
      member: {
        firstName: txn.member_first_name,
        lastName: txn.member_last_name,
        email: txn.member_email,
      },
    })),
  });
}

export async function POST(request: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as {
    transactionIds?: unknown;
    effectiveDate?: unknown;
    preview?: unknown;
  } | null;

  const transactionIds = Array.isArray(body?.transactionIds)
    ? body.transactionIds.filter((id): id is string => typeof id === 'string')
    : [];
  const effectiveDate = typeof body?.effectiveDate === 'string' ? body.effectiveDate : '';
  const preview = body?.preview === true;

  if (!transactionIds.length) {
    return jsonError(400, { error: 'Select at least one pending ACH transaction' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return jsonError(400, { error: 'effectiveDate must be YYYY-MM-DD' });
  }

  const supabase = createServiceRoleClient();

  let originator;
  try {
    originator = await loadAchOriginator(supabase, profile.organization_id);
  } catch (err) {
    if (err instanceof NachaConfigError) {
      if (!preview) {
        await recordNachaJobRun({
          supabase,
          organizationId: profile.organization_id,
          profileId: profile.id,
          jobType: 'nacha_export',
          jobName: 'NACHA export',
          status: 'failed',
          errorMessage: err.message,
          recordsFailed: transactionIds.length,
          result: { code: 'ORIGINATOR_INCOMPLETE', missing: err.missing },
        });
      }
      return jsonError(409, {
        error: err.message,
        code: 'ORIGINATOR_INCOMPLETE',
        missing: err.missing,
      });
    }
    throw err;
  }

  const txns = await loadPendingAchTransactions(supabase, profile.organization_id, transactionIds);
  if (txns.length !== transactionIds.length) {
    return jsonError(400, {
      error: 'One or more transactions are not pending bank-account charge/refund rows for this organization',
    });
  }

  const { entries, unavailable } = await buildResolvedEntries(
    supabase,
    profile.organization_id,
    txns,
  );
  if (unavailable.length) {
    if (!preview) {
      await recordNachaJobRun({
        supabase,
        organizationId: profile.organization_id,
        profileId: profile.id,
        jobType: 'nacha_export',
        jobName: 'NACHA export',
        status: 'failed',
        errorMessage:
          'Member routing and account numbers are not in the ACH vault for one or more selected rows.',
        recordsProcessed: txns.length,
        recordsFailed: unavailable.length,
        result: { code: MEMBER_BANK_DETAILS_UNAVAILABLE, unavailable },
      });
    }
    return jsonError(409, {
      error:
        'Member routing and account numbers are not in the ACH vault. Do not invent last4 as the account number, and do not send a file to the bank until every selected row hydrates.',
      code: MEMBER_BANK_DETAILS_UNAVAILABLE,
      unavailable,
    });
  }

  try {
    const fileIdModifier = nextFileIdModifier(
      await countExportsToday(supabase, profile.organization_id),
    );
    const file = generateFromResolved({
      originator,
      entries,
      effectiveDate,
      fileIdModifier,
    });

    if (preview) {
      return NextResponse.json({
        fileName: file.fileName,
        debitCents: file.debitCents,
        creditCents: file.creditCents,
        transactionCount: file.traces.length,
        traces: file.traces.map((trace) => ({
          transactionId: trace.transactionId,
          accountLast4: trace.accountLast4,
          amountCents: trace.amountCents,
          transactionCode: trace.transactionCode,
        })),
      });
    }

    const fileId = await persistNachaExport({
      supabase,
      organizationId: profile.organization_id,
      profileId: profile.id,
      originator,
      effectiveDate,
      txns,
      file,
    });

    return new NextResponse(file.contents, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=us-ascii',
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'X-Nacha-File-Id': fileId,
        'X-Nacha-File-Name': file.fileName,
      },
    });
  } catch (err) {
    if (err instanceof NachaGenerateError) {
      if (!preview) {
        await recordNachaJobRun({
          supabase,
          organizationId: profile.organization_id,
          profileId: profile.id,
          jobType: 'nacha_export',
          jobName: 'NACHA export',
          status: 'failed',
          errorMessage: err.message,
          recordsFailed: transactionIds.length,
          result: { code: 'NACHA_GENERATE_ERROR' },
        });
      }
      return jsonError(400, { error: err.message });
    }
    throw err;
  }
}
