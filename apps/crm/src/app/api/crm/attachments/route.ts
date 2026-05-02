import { NextRequest, NextResponse } from 'next/server';
import { createCrmClient, getCurrentProfile, getAttachmentsForRecord } from '@/lib/crm/queries';
import { createAttachment, deleteAttachment } from '@/lib/crm/mutations';

/** Matches AttachmentsSectionClient / AttachmentsPanel copy (imports may use larger files via same bucket) */
const MAX_RECORD_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * GET /api/crm/attachments
 * Get attachments for a specific record
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      );
    }

    const attachments = await getAttachmentsForRecord(recordId);
    return NextResponse.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/attachments
 * Upload a new attachment
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager', 'crm_agent'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const recordId = formData.get('recordId') as string | null;
    const description = formData.get('description') as string | null;

    if (!file || !recordId) {
      return NextResponse.json(
        { error: 'file and recordId are required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_RECORD_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_RECORD_ATTACHMENT_BYTES / (1024 * 1024)}MB)` },
        { status: 413 }
      );
    }

    const supabase = await createCrmClient();

    const { data: recordRow, error: recordError } = await supabase
      .from('crm_records')
      .select('id, org_id')
      .eq('id', recordId)
      .single();

    if (recordError || !recordRow || recordRow.org_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Generate a unique file path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const bucketPath = `${profile.organization_id}/${recordId}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('crm-attachments')
      .upload(bucketPath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      const cause =
        typeof uploadError.message === 'string' ? uploadError.message.toLowerCase() : '';
      if (cause.includes('already exists')) {
        return NextResponse.json(
          { error: 'A file conflicted during upload — try again' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Create attachment record
    const attachment = await createAttachment({
      org_id: profile.organization_id,
      record_id: recordId,
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      mime_type: file.type,
      bucket_path: bucketPath,
      storage_bucket: 'crm-attachments',
      description: description || undefined,
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crm/attachments
 * Delete an attachment
 */
export async function DELETE(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await deleteAttachment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
