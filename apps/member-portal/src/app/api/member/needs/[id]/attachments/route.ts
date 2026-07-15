import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';
import { memberRateLimit } from '@/lib/api/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);
// Extension → canonical MIME fallback for browsers/OSes that send an empty
// file.type (common for HEIC and some PDFs). An upload is accepted only if its
// declared type OR its extension resolves to an allowed type.
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** Resolve the effective, allowed content type, or null if the file is rejected. */
function resolveContentType(file: File): string | null {
  const declared = (file.type || '').toLowerCase().trim();
  if (declared) return ALLOWED_MIME.has(declared) ? declared : null;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? null;
}

// Statuses where the member can no longer remove supporting documents (the need
// is settled/closed). Mirrors INVOICE_LOCKED_STATUSES on the need detail page.
const DOCUMENT_LOCKED_STATUSES = new Set(['closed', 'paid', 'denied', 'cancelled']);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();
  const supabase = await createServerSupabaseClient();

  // Verify ownership
  const { data: need } = await supabase
    .from('needs')
    .select('id')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data } = await supabase
    .from('need_attachments')
    .select('*')
    .eq('need_id', needId)
    .is('deleted_at' as never, null)
    .order('created_at', { ascending: false });

  const attachments = await Promise.all(
    (data ?? []).map(async (row) => {
      let download_url: string | null = null;
      if (row.storage_path) {
        const { data: signed } = await supabase.storage
          .from('member-needs')
          .createSignedUrl(row.storage_path, 3600);
        download_url = signed?.signedUrl ?? null;
      }
      return { ...row, download_url };
    }),
  );

  return NextResponse.json({ attachments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();

  const limited = memberRateLimit(ctx.member.id, 'need-attachments:upload', { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const supabase = await createServerSupabaseClient();

  const { data: need } = await supabase
    .from('needs')
    .select('id, organization_id')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }
  // Reject by declared type OR extension — an empty file.type no longer bypasses.
  const contentType = resolveContentType(file);
  if (!contentType) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  // Collision-safe: a random uuid prefix guarantees a unique object key even if
  // two uploads land in the same millisecond, so upsert:false never spuriously errors.
  const path = `needs/${ctx.member.id}/${needId}/${randomUUID()}_${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('member-needs')
    .upload(path, buffer, { contentType, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from('need_attachments')
    .insert({
      organization_id: ctx.member.organization_id,
      need_id: needId,
      storage_path: path,
      file_name: file.name,
      mime_type: contentType,
      size_bytes: file.size,
      uploaded_by: ctx.profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('need_events').insert({
    need_id: needId,
    organization_id: ctx.member.organization_id,
    event_type: 'document_uploaded',
    description: `Member uploaded ${file.name}`,
    created_by_profile_id: ctx.profile.id,
  });

  return NextResponse.json({ attachment: data }, { headers: limited.headers });
}

/**
 * DELETE /api/member/needs/[id]/attachments?attachment_id=…
 * Soft-delete (remove) a document the member uploaded. Reversible via PATCH.
 * The storage blob is kept until purge. Members could not remove documents at
 * all before this handler existed.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();

  const limited = memberRateLimit(ctx.member.id, 'need-attachments:remove', { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const supabase = await createServerSupabaseClient();

  const attachmentId = new URL(request.url).searchParams.get('attachment_id');
  if (!attachmentId) {
    return NextResponse.json({ error: 'missing_attachment_id' }, { status: 400 });
  }

  // Verify the need (and thus its attachments) belongs to this member.
  const { data: need } = await supabase
    .from('needs')
    .select('id, status')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Enforce the same status lock the UI shows — documents can't be removed once
  // the request is settled/closed (server-side, not just client-side).
  if (DOCUMENT_LOCKED_STATUSES.has((need as { status?: string }).status ?? '')) {
    return NextResponse.json({ error: 'need_locked' }, { status: 409 });
  }

  const { data: updated, error } = await (supabase as any)
    .from('need_attachments')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: ctx.profile.id,
      deleted_origin: 'member',
    })
    .eq('id', attachmentId)
    .eq('need_id', needId)
    .is('deleted_at', null)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || (updated as unknown[]).length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await supabase.from('need_events').insert({
    need_id: needId,
    organization_id: ctx.member.organization_id,
    event_type: 'document_removed',
    description: 'Member removed a supporting document',
    created_by_profile_id: ctx.profile.id,
  });

  return NextResponse.json({ removed: true });
}

/**
 * PATCH /api/member/needs/[id]/attachments?attachment_id=…
 * Restore a soft-deleted document (the Undo action).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();

  const limited = memberRateLimit(ctx.member.id, 'need-attachments:restore', { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return limited.response!;

  const supabase = await createServerSupabaseClient();

  const attachmentId = new URL(request.url).searchParams.get('attachment_id');
  if (!attachmentId) {
    return NextResponse.json({ error: 'missing_attachment_id' }, { status: 400 });
  }

  const { data: need } = await supabase
    .from('needs')
    .select('id')
    .eq('id', needId)
    .eq('member_id', ctx.member.id)
    .eq('organization_id', ctx.member.organization_id)
    .maybeSingle();
  if (!need) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: updated, error } = await (supabase as any)
    .from('need_attachments')
    .update({ deleted_at: null, deleted_by: null, deleted_origin: null })
    .eq('id', attachmentId)
    .eq('need_id', needId)
    .not('deleted_at', 'is', null)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || (updated as unknown[]).length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await supabase.from('need_events').insert({
    need_id: needId,
    organization_id: ctx.member.organization_id,
    event_type: 'document_restored',
    description: 'Member restored a supporting document',
    created_by_profile_id: ctx.profile.id,
  });

  return NextResponse.json({ restored: true });
}
