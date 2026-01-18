import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List email assets
export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

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
      query = query.or(`name.ilike.%${search}%,file_name.ilike.%${search}%`);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org and check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role || '')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'general';
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

    // Get public URL
    const { data: urlData } = supabase.storage.from('email-assets').getPublicUrl(bucketPath);

    // Get image dimensions if possible
    let width: number | undefined;
    let height: number | undefined;

    // Create database record
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
        public_url: urlData.publicUrl,
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from('email-assets').remove([bucketPath]);
      return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 });
    }

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/email/assets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete multiple assets
export async function DELETE(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's org and check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, crm_role')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

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
