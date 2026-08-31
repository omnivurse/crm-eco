import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthProfile } from '@/lib/supabase-server';
import {
  buildPublicEmailAssetUrl,
  publicAssetOriginFromRequest,
  sanitizeEmailAssetFolder,
} from '@/lib/email/public-email-asset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List email assets
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = await createClient() as any;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('email_assets')
      .select('*', { count: 'exact' })
      .eq('org_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (folder) {
      query = query.eq('folder', folder);
    }

    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      const safeSearch = search.replace(/[,().\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safeSearch}%,file_name.ilike.%${safeSearch}%`);
    }

    const { data: assets, error, count } = await query;

    if (error) {
      console.error('Error fetching assets:', error);
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    return NextResponse.json({
      assets,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/email/assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload new asset
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = await createClient() as any;

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = sanitizeEmailAssetFolder(formData.get('folder') as string);
    const name = formData.get('name') as string;
    const altText = formData.get('alt_text') as string;
    const tags = formData.get('tags') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const bucketPath = `${profile.organization_id}/${folder}/${timestamp}_${sanitizedName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('email-assets')
      .upload(bucketPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const origin = publicAssetOriginFromRequest(request.nextUrl.origin);

    let width: number | undefined;
    let height: number | undefined;

    const { data: asset, error: dbError } = await supabase
      .from('email_assets')
      .insert({
        org_id: profile.organization_id,
        name: name || file.name.replace(/\.[^/.]+$/, ''),
        file_name: file.name,
        file_path: uploadData.path,
        bucket_path: bucketPath,
        file_size: file.size,
        mime_type: file.type,
        width,
        height,
        alt_text: altText,
        folder,
        tags: tags ? tags.split(',').map((t) => t.trim()) : [],
        is_public: true,
        public_url: null,
        created_by: profile.user_id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      await supabase.storage.from('email-assets').remove([bucketPath]);
      return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 });
    }

    const publicUrl = buildPublicEmailAssetUrl(origin, asset.id);
    if (publicUrl !== asset.public_url) {
      const { error: urlError } = await supabase
        .from('email_assets')
        .update({ public_url: publicUrl })
        .eq('id', asset.id)
        .eq('org_id', profile.organization_id);
      if (urlError) {
        console.error('Failed to persist public asset URL', { assetId: asset.id });
      }
    }

    return NextResponse.json({ ...asset, public_url: publicUrl }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/email/assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete multiple assets
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getAuthProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const supabase = await createClient() as any;

    if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No asset IDs provided' }, { status: 400 });
    }

    // Get assets to delete
    const { data: assets, error: fetchError } = await supabase
      .from('email_assets')
      .select('id, bucket_path')
      .in('id', ids)
      .eq('org_id', profile.organization_id);

    if (fetchError || !assets) {
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }

    // Delete from storage
    const bucketPaths = assets.map((a: { id: string; bucket_path: string }) => a.bucket_path).filter(Boolean);
    if (bucketPaths.length > 0) {
      await supabase.storage.from('email-assets').remove(bucketPaths);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('email_assets')
      .delete()
      .in('id', ids)
      .eq('org_id', profile.organization_id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete assets' }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error in DELETE /api/email/assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
