import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return jsonResponse({ error: 'No organization found' }, 403);
    }

    const orgId = profile.organization_id;
    const body = await req.json();
    const { folder_id, file_name, mime_type, size_bytes, document_id } = body;

    if (!file_name) {
      return jsonResponse({ error: 'file_name is required' }, 400);
    }

    // Use service-role client for storage operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // New version of existing document
    if (document_id) {
      const { data: doc, error: docErr } = await adminClient
        .from('documents')
        .select('id, current_version, org_id')
        .eq('id', document_id)
        .eq('org_id', orgId)
        .single();

      if (docErr || !doc) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }

      const newVersion = doc.current_version + 1;
      const storagePath = `${orgId}/${document_id}/${newVersion}/${file_name}`;

      // Create signed upload URL
      const { data: uploadData, error: uploadErr } = await adminClient.storage
        .from('org-documents')
        .createSignedUploadUrl(storagePath);

      if (uploadErr) {
        return jsonResponse({ error: 'Failed to create upload URL: ' + uploadErr.message }, 500);
      }

      // Insert version record
      await adminClient.from('document_versions').insert({
        document_id,
        version_number: newVersion,
        storage_path: storagePath,
        size_bytes: size_bytes || 0,
        uploaded_by: user.id,
      });

      // Update document
      await adminClient
        .from('documents')
        .update({
          current_version: newVersion,
          storage_path: storagePath,
          size_bytes: size_bytes || 0,
          mime_type: mime_type || null,
          name: file_name,
        })
        .eq('id', document_id);

      // Audit log
      await adminClient.from('document_audit_log').insert({
        org_id: orgId,
        document_id,
        user_id: user.id,
        action: 'new_version',
        meta: { version: newVersion, file_name },
      });

      return jsonResponse({
        success: true,
        upload_url: uploadData.signedUrl,
        upload_token: uploadData.token,
        upload_path: uploadData.path,
        document_id,
        version: newVersion,
      });
    }

    // New document upload
    const newDocId = crypto.randomUUID();
    const storagePath = `${orgId}/${newDocId}/1/${file_name}`;

    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('org-documents')
      .createSignedUploadUrl(storagePath);

    if (uploadErr) {
      return jsonResponse({ error: 'Failed to create upload URL: ' + uploadErr.message }, 500);
    }

    // Insert document record
    await adminClient.from('documents').insert({
      id: newDocId,
      org_id: orgId,
      folder_id: folder_id || null,
      name: file_name,
      storage_path: storagePath,
      mime_type: mime_type || null,
      size_bytes: size_bytes || 0,
      current_version: 1,
      uploaded_by: user.id,
    });

    // Insert version 1
    await adminClient.from('document_versions').insert({
      document_id: newDocId,
      version_number: 1,
      storage_path: storagePath,
      size_bytes: size_bytes || 0,
      uploaded_by: user.id,
    });

    // Audit log
    await adminClient.from('document_audit_log').insert({
      org_id: orgId,
      document_id: newDocId,
      folder_id: folder_id || null,
      user_id: user.id,
      action: 'upload',
      meta: { file_name, mime_type, size_bytes },
    });

    return jsonResponse({
      success: true,
      upload_url: uploadData.signedUrl,
      upload_token: uploadData.token,
      upload_path: uploadData.path,
      document_id: newDocId,
      version: 1,
    });
  } catch (error) {
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
