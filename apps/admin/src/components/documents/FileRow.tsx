'use client';

import { Folder, Star, MoreHorizontal, Download, Pencil, Trash2, Share2, History, Eye, FolderInput } from 'lucide-react';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { TableCell, TableRow } from '@crm-eco/ui/components/table';
import type { Document, DocFolder } from './types';
import { getFileIcon, formatFileSize, formatDate, isPreviewable } from './utils';

interface FileRowProps {
  item: Document | DocFolder;
  type: 'document' | 'folder';
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onOpen: (id: string) => void;
  onDownload?: (id: string) => void;
  onRename: (id: string, type: 'document' | 'folder') => void;
  onTrash: (id: string, type: 'document' | 'folder') => void;
  onFavorite: (id: string, type: 'document' | 'folder', isFavorite: boolean) => void;
  onShare?: (id: string) => void;
  onVersions?: (id: string) => void;
  onPreview?: (id: string) => void;
  onMove: (id: string, type: 'document' | 'folder') => void;
}

export function FileRow({
  item,
  type,
  selected,
  onSelect,
  onOpen,
  onDownload,
  onRename,
  onTrash,
  onFavorite,
  onShare,
  onVersions,
  onPreview,
  onMove,
}: FileRowProps) {
  const isDoc = type === 'document';
  const doc = isDoc ? (item as Document) : null;
  const Icon = isDoc ? getFileIcon(doc!.mime_type) : Folder;

  return (
    <TableRow className="group hover:bg-gray-50">
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(item.id, !!checked)}
        />
      </TableCell>
      <TableCell>
        <button
          onClick={() => onOpen(item.id)}
          className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
        >
          <Icon className={`w-4 h-4 shrink-0 ${isDoc ? 'text-gray-400' : 'text-blue-400'}`} />
          <span className="truncate">{item.name}</span>
          {item.is_favorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
        </button>
      </TableCell>
      <TableCell className="text-sm text-gray-500 w-24">
        {isDoc ? formatFileSize(doc!.size_bytes) : '--'}
      </TableCell>
      <TableCell className="text-sm text-gray-500 w-32">
        {formatDate(item.updated_at)}
      </TableCell>
      <TableCell className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isDoc && onPreview && isPreviewable(doc!.mime_type) && (
              <DropdownMenuItem onClick={() => onPreview(item.id)}>
                <Eye className="w-4 h-4 mr-2" /> Preview
              </DropdownMenuItem>
            )}
            {isDoc && onDownload && (
              <DropdownMenuItem onClick={() => onDownload(item.id)}>
                <Download className="w-4 h-4 mr-2" /> Download
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRename(item.id, type)}>
              <Pencil className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(item.id, type)}>
              <FolderInput className="w-4 h-4 mr-2" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFavorite(item.id, type, !!item.is_favorite)}>
              <Star className="w-4 h-4 mr-2" /> {item.is_favorite ? 'Unfavorite' : 'Favorite'}
            </DropdownMenuItem>
            {isDoc && onShare && (
              <DropdownMenuItem onClick={() => onShare(item.id)}>
                <Share2 className="w-4 h-4 mr-2" /> Share Link
              </DropdownMenuItem>
            )}
            {isDoc && onVersions && (
              <DropdownMenuItem onClick={() => onVersions(item.id)}>
                <History className="w-4 h-4 mr-2" /> Version History
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTrash(item.id, type)} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" /> Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
