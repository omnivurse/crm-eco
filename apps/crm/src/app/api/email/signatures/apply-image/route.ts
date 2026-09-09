import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@crm-eco/lib/supabase/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import { requireActiveOrgCrmRoles } from '@/lib/crm/require-crm-role';
import {
  applyImageToSignature,
  buildCreatedSignatureHtml,
  parseApplySignatureImageBody,
} from '@/lib/email/apply-signature-image';
import {
  buildPublicEmailAssetUrl,
  publicAssetOriginFromRequest,
} from '@/lib/email/public-email-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SignatureRow = {
  id: string;
  name: string;
  content_html: string;
  logo_url: string | null;
  photo_url: string | null;
  profile_id: string;
  org_id: string;
};

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const parsed = parseApplySignatureImageBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const supabase = await createClient();
    const origin = publicAssetOriginFromRequest(request.nextUrl.origin);

    const { data: asset, error: assetError } = await supabase
      .from('email_assets')
      .select('id, name, alt_text, public_url, org_id')
      .eq('id', parsed.assetId)
      .eq('org_id', profile.organization_id)
      .maybeSingle();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const imageUrl =
      typeof asset.public_url === 'string' && asset.public_url.trim()
        ? asset.public_url.trim()
        : buildPublicEmailAssetUrl(origin, asset.id);
    const imageAlt = (asset.alt_text || asset.name || '').trim() || undefined;

    if (!parsed.signatureId && parsed.createIfMissing) {
      const created = buildCreatedSignatureHtml({
        slot: parsed.slot,
        imageUrl,
        imageAlt,
        fullName: profile.full_name || undefined,
        logoHeight: parsed.logoHeight,
      });
      const { data: signature, error: createError } = await supabase
        .from('email_signatures')
        .insert({
          org_id: profile.organization_id,
          organization_id: profile.organization_id,
          profile_id: profile.id,
          name: asset.name ? `Signature · ${asset.name}`.slice(0, 80) : 'My Signature',
          content_html: created.content_html,
          logo_url: created.logo_url,
          photo_url: created.photo_url,
          social_links: {},
          is_default: true,
          include_in_replies: true,
          include_in_new: true,
        })
        .select('id, name, profile_id')
        .single();

      if (createError || !signature) {
        console.error('Error creating signature from asset:', createError);
        if (createError?.code === '23505') {
          return NextResponse.json(
            { error: 'A signature with this name already exists' },
            { status: 400 },
          );
        }
        return NextResponse.json({ error: 'Failed to create signature' }, { status: 500 });
      }

      return NextResponse.json({ signature, created: true }, { status: 201 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('email_signatures')
      .select('id, name, content_html, logo_url, photo_url, profile_id, org_id')
      .eq('id', parsed.signatureId)
      .eq('org_id', profile.organization_id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
    }

    const row = existing as SignatureRow;
    const applied = applyImageToSignature({
      slot: parsed.slot,
      imageUrl,
      imageAlt,
      contentHtml: row.content_html || '',
      logoUrl: row.logo_url,
      photoUrl: row.photo_url,
      logoHeight: parsed.logoHeight,
    });

    const updatePayload = {
      content_html: applied.content_html,
      logo_url: applied.logo_url,
      photo_url: applied.photo_url,
      updated_at: new Date().toISOString(),
    };

    const isOwn = row.profile_id === profile.id;
    if (!isOwn) {
      const gate = await requireActiveOrgCrmRoles(supabase, profile.organization_id, [
        'crm_admin',
        'crm_manager',
      ]);
      if (!gate.ok) {
        return NextResponse.json(
          { error: 'You can only add images to your own signatures' },
          { status: 403 },
        );
      }

      const admin = createServiceRoleClient();
      const { data: signature, error: updateError } = await admin
        .from('email_signatures')
        .update(updatePayload)
        .eq('id', row.id)
        .eq('org_id', profile.organization_id)
        .select('id, name, profile_id')
        .single();

      if (updateError || !signature) {
        console.error('Error applying image to teammate signature:', updateError);
        return NextResponse.json({ error: 'Failed to update signature' }, { status: 500 });
      }

      return NextResponse.json({ signature, created: false });
    }

    const { data: signature, error: updateError } = await supabase
      .from('email_signatures')
      .update(updatePayload)
      .eq('id', row.id)
      .eq('profile_id', profile.id)
      .select('id, name, profile_id')
      .single();

    if (updateError || !signature) {
      console.error('Error applying image to own signature:', updateError);
      return NextResponse.json({ error: 'Failed to update signature' }, { status: 500 });
    }

    return NextResponse.json({ signature, created: false });
  } catch (error) {
    console.error('Error in POST /api/email/signatures/apply-image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
