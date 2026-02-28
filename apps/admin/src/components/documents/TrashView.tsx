'use client';

import { Folder, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@crm-eco/ui/components/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@crm-eco/ui/components/table';
import type { Document, DocFolder } from './types';
import { getFileIcon, formatFileSize, formatDateTime } from './utils';

interface TrashViewProps {
  trashedDocs: Document[];
  trashedFolders: DocFolder[];
  loading: boolean;
  onRestore: (docIds: string[], folderIds: string[]) => Promise<void>;
  onDelete: (docIds: string[], folderIds: string[]) => Promise<void>;
}

export function TrashView({ trashedDocs, trashedFolders, loading, onRestore, onDelete }: TrashViewProps) {
  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  const isEmpty = trashedDocs.length === 0 && trashedFolders.length === 0;

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
        <Trash2 className="w-12 h-12 mb-3" />
        <p className="text-lg font-medium">Trash is empty</p>
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
            <TableHead className="w-40">Deleted</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trashedFolders.map(folder => (
            <TableRow key={folder.id}>
              <TableCell>
                <div className="flex items-center gap-2 text-sm">
                  <Folder className="w-4 h-4 text-blue-400" />
                  {folder.name}
                </div>
              </TableCell>
              <TableCell className="text-sm text-gray-500">--</TableCell>
              <TableCell className="text-sm text-gray-500">
                {folder.deleted_at ? formatDateTime(folder.deleted_at) : '--'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore([], [folder.id])}
                    title="Restore"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" title="Delete permanently">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{folder.name}&rdquo; and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete([], [folder.id])}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {trashedDocs.map(doc => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="w-4 h-4 text-gray-400" />
                    {doc.name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {formatFileSize(doc.size_bytes)}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {doc.deleted_at ? formatDateTime(doc.deleted_at) : '--'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestore([doc.id], [])}
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" title="Delete permanently">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &ldquo;{doc.name}&rdquo; and all its versions. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete([doc.id], [])}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
