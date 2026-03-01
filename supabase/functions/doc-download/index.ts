import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // Public share link download (GET with ?token=)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');

      if (!token) {
        return jsonResponse({ error: 'Token is required' }, 400);
      }

      const { data: link, error: linkErr } = await adminClient
        .from('document_links')
        .select('id, document_id, expires_at, max_downloads, download_count, org_id')
        .eq('token', token)
        .single();

      if (linkErr || !link) {
        return jsonResponse({ error: 'Invalid or expired link' }, 404);
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return jsonResponse({ error: 'Link has expired' }, 410);
      }

      if (link.max_downloads && link.download_count >= link.max_downloads) {
        return jsonResponse({ error: 'Download limit reached' }, 410);
      }

      const { data: doc, error: docErr } = await adminClient
        .from('documents')
        .select('name, storage_path, mime_type')
        .eq('id', link.document_id)
        .is('deleted_at', null)
        .single();

      if (docErr || !doc) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }

      const { data: signedData, error: signErr } = await adminClient.storage
        .from('org-documents')
        .createSignedUrl(doc.storage_path, 300);

      if (signErr) {
        return jsonResponse({ error: 'Failed to generate download URL' }, 500);
      }

      // Increment download count
      await adminClient
        .from('document_links')
        .update({ download_count: link.download_count + 1 })
        .eq('id', link.id);

      return jsonResponse({
        success: true,
        download_url: signedData.signedUrl,
        file_name: doc.name,
        mime_type: doc.mime_type,
      });
    }

    // Authenticated download (POST)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const user = await validateUser(authHeader);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return jsonResponse({ error: 'No organization found' }, 403);
    }

    const body = await req.json();
    const { document_id, version_number } = body;

    if (!document_id) {
      return jsonResponse({ error: 'document_id is required' }, 400);
    }

    const { data: doc, error: docErr } = await adminClient
      .from('documents')
      .select('id, name, storage_path, mime_type, current_version, org_id')
      .eq('id', document_id)
      .eq('org_id', profile.organization_id)
      .single();

    if (docErr || !doc) {
      return jsonResponse({ error: 'Document not found' }, 404);
    }

    let storagePath = doc.storage_path;
    const fileName = doc.name;

    if (version_number && version_number !== doc.current_version) {
      const { data: version, error: verErr } = await adminClient
        .from('document_versions')
        .select('storage_path')
        .eq('document_id', document_id)
        .eq('version_number', version_number)
        .single();

      if (verErr || !version) {
        return jsonResponse({ error: 'Version not found' }, 404);
      }

      storagePath = version.storage_path;
    }

    const { data: signedData, error: signErr } = await adminClient.storage
      .from('org-documents')
      .createSignedUrl(storagePath, 300);

    if (signErr) {
      return jsonResponse({ error: 'Failed to generate download URL' }, 500);
    }

    await adminClient.from('document_audit_log').insert({
      org_id: profile.organization_id,
      document_id,
      user_id: user.id,
      action: 'download',
      meta: { version: version_number || doc.current_version },
    });

    return jsonResponse({
      success: true,
      download_url: signedData.signedUrl,
      file_name: fileName,
      mime_type: doc.mime_type,
    });
  } catch (error) {
    console.error('doc-download error:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
