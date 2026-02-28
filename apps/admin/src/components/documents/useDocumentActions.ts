'use client';

import { useCallback } from 'react';
import { supabase, useAdminAuth } from './useAdminAuth';

async function invokeEdgeFunction(name: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export function useDocumentActions() {
  const { profile, user } = useAdminAuth();

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    if (!profile?.organization_id || !user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('doc_folders').insert({
      org_id: profile.organization_id,
      parent_id: parentId,
      name,
      created_by: user.id,
    }).select().single();
    if (error) throw error;
    await supabase.from('document_audit_log').insert({
      org_id: profile.organization_id, folder_id: data.id, user_id: user.id, action: 'upload', meta: { name },
    });
    return data;
  }, [profile, user]);

  const uploadFile = useCallback(async (file: File, folderId: string | null) => {
    const result = await invokeEdgeFunction('doc-upload', {
      folder_id: folderId, file_name: file.name, mime_type: file.type, size_bytes: file.size,
    });
    const uploadRes = await fetch(result.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!uploadRes.ok) throw new Error('File upload failed');
    return result;
  }, []);

  const uploadNewVersion = useCallback(async (file: File, documentId: string) => {
    const result = await invokeEdgeFunction('doc-upload', {
      document_id: documentId, file_name: file.name, mime_type: file.type, size_bytes: file.size,
    });
    const uploadRes = await fetch(result.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!uploadRes.ok) throw new Error('File upload failed');
    return result;
  }, []);

  const downloadFile = useCallback(async (documentId: string, versionNumber?: number) => {
    const result = await invokeEdgeFunction('doc-download', { document_id: documentId, version_number: versionNumber });
    window.open(result.download_url, '_blank');
    return result;
  }, []);

  const renameItem = useCallback(async (type: 'document' | 'folder', id: string, newName: string) => {
    if (!profile?.organization_id || !user) throw new Error('Not authenticated');
    const table = type === 'document' ? 'documents' : 'doc_folders';
    const { error } = await supabase.from(table).update({ name: newName }).eq('id', id);
    if (error) throw error;
    await supabase.from('document_audit_log').insert({
      org_id: profile.organization_id,
      ...(type === 'document' ? { document_id: id } : { folder_id: id }),
      user_id: user.id, action: 'rename', meta: { new_name: newName },
    });
  }, [profile, user]);

  const toggleFavorite = useCallback(async (type: 'document' | 'folder', id: string, isFavorite: boolean) => {
    if (!profile?.organization_id || !user) throw new Error('Not authenticated');
    if (isFavorite) {
      const query = supabase.from('document_favorites').delete();
      if (type === 'document') await query.eq('document_id', id).eq('user_id', user.id);
      else await query.eq('folder_id', id).eq('user_id', user.id);
    } else {
      await supabase.from('document_favorites').insert({
        org_id: profile.organization_id, user_id: user.id,
        ...(type === 'document' ? { document_id: id } : { folder_id: id }),
      });
    }
    await supabase.from('document_audit_log').insert({
      org_id: profile.organization_id,
      ...(type === 'document' ? { document_id: id } : { folder_id: id }),
      user_id: user.id, action: isFavorite ? 'unfavorite' : 'favorite',
    });
  }, [profile, user]);

  const trashItems = useCallback(async (docIds: string[], folderIds: string[]) => {
    return invokeEdgeFunction('doc-bulk', { action: 'trash', ids: docIds, folder_ids: folderIds });
  }, []);

  const restoreItems = useCallback(async (docIds: string[], folderIds: string[]) => {
    return invokeEdgeFunction('doc-bulk', { action: 'restore', ids: docIds, folder_ids: folderIds });
  }, []);

  const deleteItems = useCallback(async (docIds: string[], folderIds: string[]) => {
    return invokeEdgeFunction('doc-bulk', { action: 'delete', ids: docIds, folder_ids: folderIds });
  }, []);

  const moveItems = useCallback(async (docIds: string[], folderIds: string[], targetFolderId: string | null) => {
    return invokeEdgeFunction('doc-bulk', { action: 'move', ids: docIds, folder_ids: folderIds, target_folder_id: targetFolderId });
  }, []);

  const createShareLink = useCallback(async (documentId: string, expiresInHours?: number, maxDownloads?: number) => {
    if (!profile?.organization_id || !user) throw new Error('Not authenticated');
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString() : null;
    const { data, error } = await supabase.from('document_links').insert({
      org_id: profile.organization_id, document_id: documentId, token,
      expires_at: expiresAt, max_downloads: maxDownloads || null, created_by: user.id,
    }).select().single();
    if (error) throw error;
    await supabase.from('document_audit_log').insert({
      org_id: profile.organization_id, document_id: documentId, user_id: user.id,
      action: 'share', meta: { expires_in_hours: expiresInHours, max_downloads: maxDownloads },
    });
    const shareUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/doc-download?token=${token}`;
    return { ...data, share_url: shareUrl };
  }, [profile, user]);

  const getVersions = useCallback(async (documentId: string): Promise<import('./types').DocumentVersion[]> => {
    const { data, error } = await supabase.from('document_versions').select('*')
      .eq('document_id', documentId).order('version_number', { ascending: false });
    if (error) throw error;
    return (data || []) as import('./types').DocumentVersion[];
  }, []);

  return { createFolder, uploadFile, uploadNewVersion, downloadFile, renameItem, toggleFavorite, trashItems, restoreItems, deleteItems, moveItems, createShareLink, getVersions };
}
