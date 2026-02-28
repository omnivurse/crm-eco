'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useClientAuth } from '@/hooks/useClientAuth';
import type { DocFolder, Document, DocumentAuditEntry, SortField, SortDir, BreadcrumbItem } from './types';

const PAGE_SIZE = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export function useDocuments(
  currentFolderId: string | null,
  sortBy: SortField,
  sortDir: SortDir,
  searchQuery: string
) {
  const { profile } = useClientAuth();
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Documents' }]);

  const fetchData = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      // Build breadcrumb by walking up folder tree
      if (currentFolderId) {
        const crumbs: BreadcrumbItem[] = [{ id: null, name: 'Documents' }];
        let fId: string | null = currentFolderId;
        const visited = new Set<string>();
        while (fId && !visited.has(fId)) {
          visited.add(fId);
          const { data } = await supabase
            .from('doc_folders')
            .select('id, name, parent_id')
            .eq('id', fId)
            .single();
          const row = data as AnyRow | null;
          if (row) {
            crumbs.splice(1, 0, { id: row.id, name: row.name });
            fId = row.parent_id;
          } else break;
        }
        setBreadcrumbs(crumbs);
      } else {
        setBreadcrumbs([{ id: null, name: 'Documents' }]);
      }

      // Fetch folders
      let folderQuery = supabase
        .from('doc_folders')
        .select('*')
        .is('deleted_at', null);

      if (currentFolderId) {
        folderQuery = folderQuery.eq('parent_id', currentFolderId);
      } else {
        folderQuery = folderQuery.is('parent_id', null);
      }

      if (searchQuery) {
        folderQuery = folderQuery.ilike('name', `%${searchQuery}%`);
      }

      folderQuery = folderQuery.order('name', { ascending: true });
      const { data: foldersData } = await folderQuery;

      // Check favorites for folders
      const folderResults = (foldersData || []) as DocFolder[];
      if (folderResults.length > 0) {
        const { data: favFolders } = await supabase
          .from('document_favorites')
          .select('folder_id')
          .in('folder_id', folderResults.map((f: DocFolder) => f.id));
        const favIds = new Set((favFolders as AnyRow[] || []).map((f: AnyRow) => f.folder_id as string));
        folderResults.forEach((f: DocFolder) => { f.is_favorite = favIds.has(f.id); });
      }
      setFolders(folderResults);

      // Fetch documents
      let docQuery = supabase
        .from('documents')
        .select('*')
        .is('deleted_at', null);

      if (currentFolderId) {
        docQuery = docQuery.eq('folder_id', currentFolderId);
      } else {
        docQuery = docQuery.is('folder_id', null);
      }

      if (searchQuery) {
        docQuery = docQuery.ilike('name', `%${searchQuery}%`);
      }

      docQuery = docQuery
        .order(sortBy, { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const { data: docsData } = await docQuery;
      const docResults = (docsData || []) as Document[];

      // Check favorites for documents
      if (docResults.length > 0) {
        const { data: favDocs } = await supabase
          .from('document_favorites')
          .select('document_id')
          .in('document_id', docResults.map((d: Document) => d.id));
        const favIds = new Set((favDocs as AnyRow[] || []).map((f: AnyRow) => f.document_id as string));
        docResults.forEach((d: Document) => { d.is_favorite = favIds.has(d.id); });
      }

      setDocuments(docResults);
      setHasMore(docResults.length > PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.organization_id, currentFolderId, sortBy, sortDir, searchQuery, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(0);
  }, [currentFolderId, searchQuery]);

  return { folders, documents, loading, page, setPage, hasMore, breadcrumbs, refetch: fetchData };
}

export function useFolderTree() {
  const { profile } = useClientAuth();
  const [allFolders, setAllFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('doc_folders')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true });
    setAllFolders((data || []) as DocFolder[]);
    setLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  return { allFolders, loading, refetch: fetchTree };
}

export function useTrash() {
  const { profile } = useClientAuth();
  const [trashedDocs, setTrashedDocs] = useState<Document[]>([]);
  const [trashedFolders, setTrashedFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    const [docsRes, foldersRes] = await Promise.all([
      supabase.from('documents').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      supabase.from('doc_folders').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ]);

    setTrashedDocs((docsRes.data || []) as Document[]);
    setTrashedFolders((foldersRes.data || []) as DocFolder[]);
    setLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  return { trashedDocs, trashedFolders, loading, refetch: fetchTrash };
}

export function useFavorites() {
  const { profile } = useClientAuth();
  const [favDocs, setFavDocs] = useState<Document[]>([]);
  const [favFolders, setFavFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavs = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    const { data: favs } = await supabase
      .from('document_favorites')
      .select('document_id, folder_id');

    const favsArr = (favs || []) as AnyRow[];
    const docIds = favsArr.filter((f: AnyRow) => f.document_id).map((f: AnyRow) => f.document_id as string);
    const folderIds = favsArr.filter((f: AnyRow) => f.folder_id).map((f: AnyRow) => f.folder_id as string);

    const [docsRes, foldersRes] = await Promise.all([
      docIds.length > 0
        ? supabase.from('documents').select('*').in('id', docIds).is('deleted_at', null)
        : Promise.resolve({ data: [] as AnyRow[] }),
      folderIds.length > 0
        ? supabase.from('doc_folders').select('*').in('id', folderIds).is('deleted_at', null)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);

    const docs = ((docsRes.data || []) as Document[]).map((d: Document) => ({ ...d, is_favorite: true as const }));
    const folders = ((foldersRes.data || []) as DocFolder[]).map((f: DocFolder) => ({ ...f, is_favorite: true as const }));

    setFavDocs(docs);
    setFavFolders(folders);
    setLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => { fetchFavs(); }, [fetchFavs]);

  return { favDocs, favFolders, loading, refetch: fetchFavs };
}

export function useAuditLog() {
  const { profile } = useClientAuth();
  const [entries, setEntries] = useState<DocumentAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    const { data } = await supabase
      .from('document_audit_log')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    setEntries((data || []) as DocumentAuditEntry[]);
    setLoading(false);
  }, [profile?.organization_id]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  return { entries, loading, refetch: fetchLog };
}
