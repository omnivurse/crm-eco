'use client';

import { Table, TableBody, TableHead, TableHeader, TableRow } from '@crm-eco/ui/components/table';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import type { Document, DocFolder, ViewMode } from './types';
import { FileRow } from './FileRow';
import { FileCard } from './FileCard';

interface FileListProps {
  folders: DocFolder[];
  documents: Document[];
  viewMode: ViewMode;
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenDocument: (docId: string) => void;
  onDownload: (docId: string) => void;
  onRename: (id: string, type: 'document' | 'folder') => void;
  onTrash: (id: string, type: 'document' | 'folder') => void;
  onFavorite: (id: string, type: 'document' | 'folder', isFavorite: boolean) => void;
  onShare: (docId: string) => void;
  onVersions: (docId: string) => void;
  onPreview: (docId: string) => void;
  onMove: (id: string, type: 'document' | 'folder') => void;
  loading: boolean;
}

export function FileList({
  folders,
  documents,
  viewMode,
  selectedIds,
  onSelect,
  onSelectAll,
  onOpenFolder,
  onOpenDocument,
  onDownload,
  onRename,
  onTrash,
  onFavorite,
  onShare,
  onVersions,
  onPreview,
  onMove,
  loading,
}: FileListProps) {
  const allIds = [...folders.map(f => f.id), ...documents.map(d => d.id)];
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const isEmpty = folders.length === 0 && documents.length === 0 && !loading;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-400">
        Loading...
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
        <p className="text-lg font-medium mb-1">No documents</p>
        <p className="text-sm">Upload files or create a folder to get started.</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {folders.map(folder => (
            <FileCard
              key={folder.id}
              item={folder}
              type="folder"
              selected={selectedIds.has(folder.id)}
              onSelect={onSelect}
              onOpen={onOpenFolder}
              onRename={onRename}
              onTrash={onTrash}
              onFavorite={onFavorite}
              onMove={onMove}
            />
          ))}
          {documents.map(doc => (
            <FileCard
              key={doc.id}
              item={doc}
              type="document"
              selected={selectedIds.has(doc.id)}
              onSelect={onSelect}
              onOpen={() => onOpenDocument(doc.id)}
              onDownload={onDownload}
              onRename={onRename}
              onTrash={onTrash}
              onFavorite={onFavorite}
              onShare={onShare}
              onVersions={onVersions}
              onPreview={onPreview}
              onMove={onMove}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={(checked) => onSelectAll(!!checked)} />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Size</TableHead>
            <TableHead className="w-32">Modified</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map(folder => (
            <FileRow
              key={folder.id}
              item={folder}
              type="folder"
              selected={selectedIds.has(folder.id)}
              onSelect={onSelect}
              onOpen={onOpenFolder}
              onRename={onRename}
              onTrash={onTrash}
              onFavorite={onFavorite}
              onMove={onMove}
            />
          ))}
          {documents.map(doc => (
            <FileRow
              key={doc.id}
              item={doc}
              type="document"
              selected={selectedIds.has(doc.id)}
              onSelect={onSelect}
              onOpen={() => onOpenDocument(doc.id)}
              onDownload={onDownload}
              onRename={onRename}
              onTrash={onTrash}
              onFavorite={onFavorite}
              onShare={onShare}
              onVersions={onVersions}
              onPreview={onPreview}
              onMove={onMove}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
