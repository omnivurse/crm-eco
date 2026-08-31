import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import {
  canServePublicEmailAsset,
  isValidPublicAssetId,
} from '@/lib/email/public-email-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidPublicAssetId(id)) {
    return notFound();
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: asset, error } = await supabase
      .from('email_assets')
      .select('id, org_id, is_public, mime_type, bucket_path, file_path')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[public-assets] lookup failed', { assetId: id });
      return notFound();
    }

    const allowed = canServePublicEmailAsset(asset);
    if (!allowed.ok) {
      return notFound();
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from('email-assets')
      .download(allowed.path);

    if (downloadError || !file) {
      console.error('[public-assets] download failed', { assetId: id });
      return notFound();
    }

    console.info('[public-assets] served', {
      assetId: id,
      orgId: asset?.org_id ?? null,
    });

    const body = Buffer.from(await file.arrayBuffer());
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': allowed.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(body.byteLength),
      },
    });
  } catch (error) {
    console.error('[public-assets] unexpected error', {
      assetId: id,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
