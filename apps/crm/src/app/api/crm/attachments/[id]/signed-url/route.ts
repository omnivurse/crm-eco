import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile } from '@/lib/crm/queries';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/crm/attachments/[id]/signed-url
 * Generate a signed URL for downloading an attachment
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createCrmClient();

    // Get attachment info
    const { data: attachment, error: fetchError } = await supabase
      .from('crm_attachments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify the attachment belongs to the user's org
    if (attachment.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate signed URL (5 minutes expiry)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(attachment.storage_bucket || 'crm-attachments')
      .createSignedUrl(attachment.bucket_path || attachment.file_path, 300);

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signedUrlData.signedUrl,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
