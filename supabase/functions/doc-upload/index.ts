import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Validate user JWT via Supabase Auth API and return user object */
async function validateUser(authHeader: string): Promise<{ id: string } | null> {
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const user = await validateUser(authHeader);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await adminClient
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

      const { data: uploadData, error: uploadErr } = await adminClient.storage
        .from('org-documents')
        .createSignedUploadUrl(storagePath);

      if (uploadErr) {
        return jsonResponse({ error: 'Failed to create upload URL: ' + uploadErr.message }, 500);
      }

      await adminClient.from('document_versions').insert({
        document_id,
        version_number: newVersion,
        storage_path: storagePath,
        size_bytes: size_bytes || 0,
        uploaded_by: user.id,
      });

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

    await adminClient.from('document_versions').insert({
      document_id: newDocId,
      version_number: 1,
      storage_path: storagePath,
      size_bytes: size_bytes || 0,
      uploaded_by: user.id,
    });

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
    console.error('doc-upload error:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
