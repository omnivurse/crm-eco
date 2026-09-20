import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { FINANCIAL_TENANT_ROLES, requireAdminRole } from '@/lib/auth';
import {
  ALREADY_POSTED,
  NOC_VAULT_UNAVAILABLE,
  NachaReturnParseError,
  UNMATCHED_TRACES,
  persistNachaImport,
} from '@/lib/nacha-import';

export const dynamic = 'force-dynamic';

function jsonError(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function publicPreview(preview: Awaited<ReturnType<typeof persistNachaImport>>['preview']) {
  return {
    fileDate: preview.fileDate,
    returnCount: preview.returnCount,
    nocCount: preview.nocCount,
    matched: preview.matched.map((row) => ({
      kind: row.entry.kind,
      code: row.entry.code,
      reason: row.entry.reason,
      amountCents: row.entry.amountCents,
      accountLast4: row.entry.accountLast4,
      transactionId: row.transactionId,
      alreadyPosted: row.alreadyPosted,
    })),
    unmatched: preview.unmatched,
    nocBlocked: preview.nocBlocked,
  };
}

export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const supabase = createServiceRoleClient();
  const { data, error: listError } = await supabase
    .from('nacha_files')
    .select('id, file_name, status, transaction_count, return_count, created_at, error_message')
    .eq('organization_id', profile.organization_id)
    .eq('file_type', 'import')
    .order('created_at', { ascending: false })
    .limit(50);
  if (listError) return jsonError(500, { error: listError.message });
  return NextResponse.json({ files: data ?? [] });
}

export async function POST(request: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const { profile, error } = await requireAdminRole(userClient, FINANCIAL_TENANT_ROLES);
  if (error || !profile) return error;

  const body = (await request.json().catch(() => null)) as {
    fileName?: unknown;
    contents?: unknown;
    preview?: unknown;
  } | null;
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const contents = typeof body?.contents === 'string' ? body.contents : '';
  const preview = body?.preview === true;

  if (!contents.trim()) {
    return jsonError(400, { error: 'Return file contents are required' });
  }

  const supabase = createServiceRoleClient();
  try {
    const result = await persistNachaImport({
      supabase,
      organizationId: profile.organization_id,
      profileId: profile.id,
      fileName,
      contents,
      preview,
    });
    return NextResponse.json({
      preview: publicPreview(result.preview),
      nachaFileId: result.nachaFileId ?? null,
      posted: result.posted,
      alreadyPosted: result.alreadyPosted,
    });
  } catch (err) {
    if (err instanceof NachaReturnParseError) {
      return jsonError(400, { error: err.message, code: err.code });
    }
    const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
    if (code === UNMATCHED_TRACES) {
      return jsonError(409, {
        error: err instanceof Error ? err.message : 'Unmatched traces',
        code,
        unmatched: 'unmatched' in (err as object) ? (err as { unmatched: unknown }).unmatched : [],
      });
    }
    if (code === ALREADY_POSTED || code === NOC_VAULT_UNAVAILABLE) {
      return jsonError(409, {
        error: err instanceof Error ? err.message : 'Return file could not be posted',
        code,
      });
    }
    throw err;
  }
}
