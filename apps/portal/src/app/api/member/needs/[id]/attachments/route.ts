import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

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
    .order('created_at', { ascending: false });

  return NextResponse.json({ attachments: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: needId } = await params;
  const ctx = await requireActiveMembership();
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'unsupported_mime' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `needs/${ctx.member.id}/${needId}/${Date.now()}_${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('member-needs')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from('need_attachments')
    .insert({
      organization_id: ctx.member.organization_id,
      need_id: needId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: ctx.profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ attachment: data });
}
