'use client';

import { Folder, Star } from '@phosphor-icons/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui/components/table';
import type { Document, DocFolder } from './types';
import { getFileIcon, formatFileSize, formatDate } from './utils';

interface FavoritesViewProps {
  favDocs: Document[];
  favFolders: DocFolder[];
  loading: boolean;
  onOpenFolder: (folderId: string) => void;
  onDownload: (docId: string) => void;
  onUnfavorite: (id: string, type: 'document' | 'folder') => void;
}

export function FavoritesView({ favDocs, favFolders, loading, onOpenFolder, onDownload, onUnfavorite }: FavoritesViewProps) {
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (favDocs.length === 0 && favFolders.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
        <Star weight="light" className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">No favorites</p>
        <p className="text-sm">Star documents and folders to access them quickly.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Size</TableHead>
            <TableHead className="w-32">Modified</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {favFolders.map(folder => (
            <TableRow key={folder.id} className="cursor-pointer hover:bg-gray-50">
              <TableCell>
                <button onClick={() => onOpenFolder(folder.id)} className="flex items-center gap-2 text-sm hover:text-blue-600">
                  <Folder weight="light" className="w-4 h-4 text-blue-400" />
                  {folder.name}
                </button>
              </TableCell>
              <TableCell className="text-sm text-gray-500">--</TableCell>
              <TableCell className="text-sm text-gray-500">{formatDate(folder.updated_at)}</TableCell>
              <TableCell>
                <button
                  onClick={() => onUnfavorite(folder.id, 'folder')}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Remove from favorites"
                >
                  <Star weight="light" className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                </button>
              </TableCell>
            </TableRow>
          ))}
          {favDocs.map(doc => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <TableRow key={doc.id} className="cursor-pointer hover:bg-gray-50">
                <TableCell>
                  <button onClick={() => onDownload(doc.id)} className="flex items-center gap-2 text-sm hover:text-blue-600">
                    <Icon weight="light" className="w-4 h-4 text-gray-400" />
                    {doc.name}
                  </button>
                </TableCell>
                <TableCell className="text-sm text-gray-500">{formatFileSize(doc.size_bytes)}</TableCell>
                <TableCell className="text-sm text-gray-500">{formatDate(doc.updated_at)}</TableCell>
                <TableCell>
                  <button
                    onClick={() => onUnfavorite(doc.id, 'document')}
                    className="p-1 hover:bg-gray-100 rounded"
                    title="Remove from favorites"
                  >
                    <Star weight="light" className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
