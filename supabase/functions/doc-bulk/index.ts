import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map(s => s.trim());

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes('*') ? '*' :
    (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
    const { action, ids, folder_ids, target_folder_id } = body;

    if (!action) {
      return jsonResponse({ error: 'action is required' }, 400);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

        // Audit log
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
        // Permanently delete — remove storage files first
        if (docIds.length > 0) {
          const { data: docs } = await adminClient
            .from('documents')
            .select('id, org_id')
            .in('id', docIds)
            .eq('org_id', orgId);

          if (docs) {
            for (const doc of docs) {
              // Get all version paths
              const { data: versions } = await adminClient
                .from('document_versions')
                .select('storage_path')
                .eq('document_id', doc.id);

              if (versions && versions.length > 0) {
                const paths = versions.map((v: { storage_path: string }) => v.storage_path);
                await adminClient.storage.from('org-documents').remove(paths);
              }

              // Audit log before deletion
              await adminClient.from('document_audit_log').insert({
                org_id: orgId, document_id: doc.id, user_id: user.id, action: 'delete',
              });
            }

            // Delete document records (cascades to versions, favorites, links)
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

        // Validate target folder belongs to org (null = root)
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
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
