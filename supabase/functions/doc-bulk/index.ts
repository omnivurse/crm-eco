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
    const { action, ids, folder_ids, target_folder_id } = body;

    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400);
    }

    const docIds: string[] = ids || [];
    const folderIds: string[] = folder_ids || [];
    let affected = 0;

    switch (action) {
      case 'trash': {
        const now = new Date().toISOString();

        if (docIds.length > 0) {
          const { count } = await adminClient
            .from('documents')
            .update({ deleted_at: now })
            .in('id', docIds)
            .eq('org_id', orgId)
            .is('deleted_at', null);
          affected += count || 0;
        }

        if (folderIds.length > 0) {
          const { count } = await adminClient
            .from('doc_folders')
            .update({ deleted_at: now })
            .in('id', folderIds)
            .eq('org_id', orgId)
            .is('deleted_at', null);
          affected += count || 0;
        }

        for (const id of docIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, document_id: id, user_id: user.id, action: 'trash',
          });
        }
        for (const id of folderIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, folder_id: id, user_id: user.id, action: 'trash',
          });
        }
        break;
      }

      case 'restore': {
        if (docIds.length > 0) {
          const { count } = await adminClient
            .from('documents')
            .update({ deleted_at: null })
            .in('id', docIds)
            .eq('org_id', orgId)
            .not('deleted_at', 'is', null);
          affected += count || 0;
        }

        if (folderIds.length > 0) {
          const { count } = await adminClient
            .from('doc_folders')
            .update({ deleted_at: null })
            .in('id', folderIds)
            .eq('org_id', orgId)
            .not('deleted_at', 'is', null);
          affected += count || 0;
        }

        for (const id of docIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, document_id: id, user_id: user.id, action: 'restore',
          });
        }
        for (const id of folderIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, folder_id: id, user_id: user.id, action: 'restore',
          });
        }
        break;
      }

      case 'delete': {
        if (docIds.length > 0) {
          const { data: docs } = await adminClient
            .from('documents')
            .select('id, org_id')
            .in('id', docIds)
            .eq('org_id', orgId);

          if (docs) {
            for (const doc of docs) {
              const { data: versions } = await adminClient
                .from('document_versions')
                .select('storage_path')
                .eq('document_id', doc.id);

              if (versions && versions.length > 0) {
                const paths = versions.map((v: { storage_path: string }) => v.storage_path);
                await adminClient.storage.from('org-documents').remove(paths);
              }

              await adminClient.from('document_audit_log').insert({
                org_id: orgId, document_id: doc.id, user_id: user.id, action: 'delete',
              });
            }

            const { count } = await adminClient
              .from('documents')
              .delete()
              .in('id', docIds)
              .eq('org_id', orgId);
            affected += count || 0;
          }
        }

        if (folderIds.length > 0) {
          for (const id of folderIds) {
            await adminClient.from('document_audit_log').insert({
              org_id: orgId, folder_id: id, user_id: user.id, action: 'delete',
            });
          }

          const { count } = await adminClient
            .from('doc_folders')
            .delete()
            .in('id', folderIds)
            .eq('org_id', orgId);
          affected += count || 0;
        }
        break;
      }

      case 'move': {
        if (target_folder_id === undefined) {
          return jsonResponse({ error: 'target_folder_id is required for move' }, 400);
        }

        if (target_folder_id !== null) {
          const { data: targetFolder, error: tfErr } = await adminClient
            .from('doc_folders')
            .select('id')
            .eq('id', target_folder_id)
            .eq('org_id', orgId)
            .is('deleted_at', null)
            .single();

          if (tfErr || !targetFolder) {
            return jsonResponse({ error: 'Target folder not found' }, 404);
          }
        }

        if (docIds.length > 0) {
          const { count } = await adminClient
            .from('documents')
            .update({ folder_id: target_folder_id })
            .in('id', docIds)
            .eq('org_id', orgId);
          affected += count || 0;
        }

        if (folderIds.length > 0) {
          const { count } = await adminClient
            .from('doc_folders')
            .update({ parent_id: target_folder_id })
            .in('id', folderIds)
            .eq('org_id', orgId);
          affected += count || 0;
        }

        for (const id of docIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, document_id: id, user_id: user.id, action: 'move',
            meta: { target_folder_id },
          });
        }
        for (const id of folderIds) {
          await adminClient.from('document_audit_log').insert({
            org_id: orgId, folder_id: id, user_id: user.id, action: 'move',
            meta: { target_folder_id },
          });
        }
        break;
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    return jsonResponse({ success: true, affected });
  } catch (error) {
    console.error('doc-bulk error:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
