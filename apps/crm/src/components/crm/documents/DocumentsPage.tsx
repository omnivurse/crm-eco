'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronRight, FileText, Star, Trash2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useClientAuth } from '@/hooks/useClientAuth';
import { supabase } from '@/lib/supabase-client';
import type { ViewMode, SortField, SortDir, ActiveTab } from './types';
import { useDocuments, useFolderTree, useTrash, useFavorites, useAuditLog } from './useDocuments';
import { useDocumentActions } from './useDocumentActions';
import { FolderTree } from './FolderTree';
import { FileToolbar } from './FileToolbar';
import { FileList } from './FileList';
import { UploadDialog } from './UploadDialog';
import { NewFolderDialog } from './NewFolderDialog';
import { RenameDialog } from './RenameDialog';
import { MoveDialog } from './MoveDialog';
import { ShareLinkDialog } from './ShareLinkDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { FilePreviewDialog } from './FilePreviewDialog';
import { TrashView } from './TrashView';
import { FavoritesView } from './FavoritesView';
import { AuditLogView } from './AuditLogView';

export function DocumentsPage() {
  const { loading: authLoading } = useClientAuth();

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('files');

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: 'document' | 'folder' } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargets, setMoveTargets] = useState<{ docIds: string[]; folderIds: string[] }>({ docIds: [], folderIds: [] });
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsTarget, setVersionsTarget] = useState<{ id: string; name: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{ id: string; name: string; mimeType: string | null } | null>(null);

  // Data hooks
  const { folders, documents, loading, breadcrumbs, refetch } = useDocuments(currentFolderId, sortBy, sortDir, searchQuery);
  const { allFolders, refetch: refetchTree } = useFolderTree();
  const { trashedDocs, trashedFolders, loading: trashLoading, refetch: refetchTrash } = useTrash();
  const { favDocs, favFolders, loading: favsLoading, refetch: refetchFavs } = useFavorites();
  const { entries: auditEntries, loading: auditLoading, refetch: refetchAudit } = useAuditLog();

  // Actions
  const actions = useDocumentActions();

  const refreshAll = useCallback(() => {
    refetch();
    refetchTree();
    refetchTrash();
    refetchFavs();
    refetchAudit();
  }, [refetch, refetchTree, refetchTrash, refetchFavs, refetchAudit]);

  // Selection helpers
  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = [...folders.map(f => f.id), ...documents.map(d => d.id)];
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  }, [folders, documents]);

  // Navigation
  const handleOpenFolder = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setActiveTab('files');
  }, []);

  // File actions
  const handleUpload = useCallback(async (file: File) => {
    await actions.uploadFile(file, currentFolderId);
    toast.success(`Uploaded ${file.name}`);
    refreshAll();
  }, [actions, currentFolderId, refreshAll]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await actions.createFolder(name, currentFolderId);
    toast.success(`Created folder "${name}"`);
    refreshAll();
  }, [actions, currentFolderId, refreshAll]);

  const handleDownload = useCallback(async (docId: string) => {
    await actions.downloadFile(docId);
  }, [actions]);

  const handleRename = useCallback((id: string, type: 'document' | 'folder') => {
    const item = type === 'document'
      ? documents.find(d => d.id === id)
      : folders.find(f => f.id === id);
    if (item) {
      setRenameTarget({ id, name: item.name, type });
      setRenameOpen(true);
    }
  }, [documents, folders]);

  const handleDoRename = useCallback(async (newName: string) => {
    if (!renameTarget) return;
    await actions.renameItem(renameTarget.type, renameTarget.id, newName);
    toast.success('Renamed successfully');
    refreshAll();
  }, [renameTarget, actions, refreshAll]);

  const handleTrashSingle = useCallback(async (id: string, type: 'document' | 'folder') => {
    if (type === 'document') {
      await actions.trashItems([id], []);
    } else {
      await actions.trashItems([], [id]);
    }
    toast.success('Moved to trash');
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    refreshAll();
  }, [actions, refreshAll]);

  const handleTrashSelected = useCallback(async () => {
    const docIds = documents.filter(d => selectedIds.has(d.id)).map(d => d.id);
    const folderIds = folders.filter(f => selectedIds.has(f.id)).map(f => f.id);
    await actions.trashItems(docIds, folderIds);
    toast.success(`Moved ${docIds.length + folderIds.length} items to trash`);
    setSelectedIds(new Set());
    refreshAll();
  }, [selectedIds, documents, folders, actions, refreshAll]);

  const handleFavorite = useCallback(async (id: string, type: 'document' | 'folder', isFavorite: boolean) => {
    await actions.toggleFavorite(type, id, isFavorite);
    toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    refreshAll();
  }, [actions, refreshAll]);

  const handleMoveSingle = useCallback((id: string, type: 'document' | 'folder') => {
    setMoveTargets({
      docIds: type === 'document' ? [id] : [],
      folderIds: type === 'folder' ? [id] : [],
    });
    setMoveOpen(true);
  }, []);

  const handleMoveSelected = useCallback(() => {
    const docIds = documents.filter(d => selectedIds.has(d.id)).map(d => d.id);
    const folderIds = folders.filter(f => selectedIds.has(f.id)).map(f => f.id);
    setMoveTargets({ docIds, folderIds });
    setMoveOpen(true);
  }, [selectedIds, documents, folders]);

  const handleDoMove = useCallback(async (targetFolderId: string | null) => {
    await actions.moveItems(moveTargets.docIds, moveTargets.folderIds, targetFolderId);
    toast.success('Moved successfully');
    setSelectedIds(new Set());
    refreshAll();
  }, [moveTargets, actions, refreshAll]);

  const handleShare = useCallback((docId: string) => {
    setShareDocId(docId);
    setShareOpen(true);
  }, []);

  const handleCreateShareLink = useCallback(async (expiresInHours?: number, maxDownloads?: number) => {
    if (!shareDocId) throw new Error('No document selected');
    return actions.createShareLink(shareDocId, expiresInHours, maxDownloads);
  }, [shareDocId, actions]);

  const handleVersions = useCallback((docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setVersionsTarget({ id: docId, name: doc.name });
      setVersionsOpen(true);
    }
  }, [documents]);

  const handleUploadNewVersion = useCallback(async (file: File, docId: string) => {
    await actions.uploadNewVersion(file, docId);
    toast.success('New version uploaded');
    refreshAll();
  }, [actions, refreshAll]);

  const handlePreview = useCallback((docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      setPreviewTarget({ id: docId, name: doc.name, mimeType: doc.mime_type });
      setPreviewOpen(true);
    }
  }, [documents]);

  const getPreviewUrl = useCallback(async () => {
    if (!previewTarget) return '';
    const doc = documents.find(d => d.id === previewTarget.id);
    if (!doc) return '';
    const { data } = await supabase.storage.from('org-documents').createSignedUrl(doc.storage_path, 300);
    return data?.signedUrl || '';
  }, [previewTarget, documents]);

  const handleRestore = useCallback(async (docIds: string[], folderIds: string[]) => {
    await actions.restoreItems(docIds, folderIds);
    toast.success('Restored');
    refreshAll();
  }, [actions, refreshAll]);

  const handlePermanentDelete = useCallback(async (docIds: string[], folderIds: string[]) => {
    await actions.deleteItems(docIds, folderIds);
    toast.success('Permanently deleted');
    refreshAll();
  }, [actions, refreshAll]);

  const handleUnfavorite = useCallback(async (id: string, type: 'document' | 'folder') => {
    await actions.toggleFavorite(type, id, true);
    toast.success('Removed from favorites');
    refreshAll();
  }, [actions, refreshAll]);

  const excludeIds = useMemo(() => [...moveTargets.docIds, ...moveTargets.folderIds], [moveTargets]);

  const tabs = [
    { key: 'files' as const, label: 'Files', icon: FileText },
    { key: 'favorites' as const, label: 'Favorites', icon: Star },
    { key: 'trash' as const, label: 'Trash', icon: Trash2 },
    { key: 'audit' as const, label: 'Activity', icon: ClipboardList },
  ];

  if (authLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold">Documents</h1>
          {activeTab === 'files' && (
            <nav className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`hover:text-primary ${i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}`}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </nav>
          )}
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <FolderTree
            folders={allFolders}
            currentFolderId={currentFolderId}
            onSelectFolder={(id) => { setCurrentFolderId(id); setSelectedIds(new Set()); }}
            onNewFolder={() => setNewFolderOpen(true)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'files' && (
            <>
              <FileToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={(field, dir) => { setSortBy(field); setSortDir(dir); }}
                selectedCount={selectedIds.size}
                onUpload={() => setUploadOpen(true)}
                onTrash={handleTrashSelected}
                onMove={handleMoveSelected}
              />
              <FileList
                folders={folders}
                documents={documents}
                viewMode={viewMode}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onOpenFolder={handleOpenFolder}
                onOpenDocument={handleDownload}
                onDownload={handleDownload}
                onRename={handleRename}
                onTrash={handleTrashSingle}
                onFavorite={handleFavorite}
                onShare={handleShare}
                onVersions={handleVersions}
                onPreview={handlePreview}
                onMove={handleMoveSingle}
                loading={loading}
              />
            </>
          )}

          {activeTab === 'favorites' && (
            <FavoritesView
              favDocs={favDocs}
              favFolders={favFolders}
              loading={favsLoading}
              onOpenFolder={handleOpenFolder}
              onDownload={handleDownload}
              onUnfavorite={handleUnfavorite}
            />
          )}

          {activeTab === 'trash' && (
            <TrashView
              trashedDocs={trashedDocs}
              trashedFolders={trashedFolders}
              loading={trashLoading}
              onRestore={handleRestore}
              onDelete={handlePermanentDelete}
            />
          )}

          {activeTab === 'audit' && (
            <AuditLogView entries={auditEntries} loading={auditLoading} />
          )}
        </div>
      </div>

      {/* Dialogs */}
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUpload={handleUpload} />
      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} onCreate={handleCreateFolder} />
      {renameTarget && (
        <RenameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          currentName={renameTarget.name}
          onRename={handleDoRename}
        />
      )}
      <MoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        allFolders={allFolders}
        excludeIds={excludeIds}
        onMove={handleDoMove}
      />
      <ShareLinkDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onCreateLink={handleCreateShareLink}
      />
      <VersionHistoryDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        documentId={versionsTarget?.id || null}
        documentName={versionsTarget?.name || ''}
        getVersions={actions.getVersions}
        onDownloadVersion={handleDownload}
        onUploadNewVersion={handleUploadNewVersion}
      />
      {previewTarget && (
        <FilePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          documentName={previewTarget.name}
          mimeType={previewTarget.mimeType}
          getPreviewUrl={getPreviewUrl}
          onDownload={() => handleDownload(previewTarget.id)}
        />
      )}
    </div>
  );
}
