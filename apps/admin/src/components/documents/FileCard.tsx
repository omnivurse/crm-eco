'use client';

import { ClockCounterClockwise, DotsThree, DownloadSimple, Eye, Folder, FolderSimple, PencilSimple, ShareNetwork, Star, Trash } from '@phosphor-icons/react';
import { Checkbox } from '@crm-eco/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { Document, DocFolder } from './types';
import { FileIcon, formatFileSize, formatDate, isPreviewable } from './utils';

interface FileCardProps {
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

export function FileCard({
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
}: FileCardProps) {
  const isDoc = type === 'document';
  const doc = isDoc ? (item as Document) : null;

  return (
    <div
      className={`group relative border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer ${
        selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="absolute top-2 left-2">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(item.id, !!checked)}
          className="opacity-0 group-hover:opacity-100 transition-opacity data-[state=checked]:opacity-100"
        />
      </div>
      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
              <DotsThree weight="light" className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isDoc && onPreview && isPreviewable(doc!.mime_type) && (
              <DropdownMenuItem onClick={() => onPreview(item.id)}>
                <Eye weight="light" className="w-4 h-4 mr-2" /> Preview
              </DropdownMenuItem>
            )}
            {isDoc && onDownload && (
              <DropdownMenuItem onClick={() => onDownload(item.id)}>
                <DownloadSimple weight="light" className="w-4 h-4 mr-2" /> DownloadSimple
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRename(item.id, type)}>
              <PencilSimple weight="light" className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(item.id, type)}>
              <FolderSimple weight="light" className="w-4 h-4 mr-2" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFavorite(item.id, type, !!item.is_favorite)}>
              <Star weight="light" className="w-4 h-4 mr-2" /> {item.is_favorite ? 'Unfavorite' : 'Favorite'}
            </DropdownMenuItem>
            {isDoc && onShare && (
              <DropdownMenuItem onClick={() => onShare(item.id)}>
                <ShareNetwork weight="light" className="w-4 h-4 mr-2" /> Share Link
              </DropdownMenuItem>
            )}
            {isDoc && onVersions && (
              <DropdownMenuItem onClick={() => onVersions(item.id)}>
                <ClockCounterClockwise weight="light" className="w-4 h-4 mr-2" /> Versions
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTrash(item.id, type)} className="text-red-600">
              <Trash weight="light" className="w-4 h-4 mr-2" /> Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div onClick={() => onOpen(item.id)} className="flex flex-col items-center pt-4 pb-2">
        {isDoc ? (
          <FileIcon mimeType={doc!.mime_type} className="w-10 h-10 mb-2 text-gray-400" />
        ) : (
          <Folder weight="light" className="w-10 h-10 mb-2 text-blue-400" />
        )}
        <span className="text-sm font-medium text-center truncate w-full">{item.name}</span>
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          {isDoc && <span>{formatFileSize(doc!.size_bytes)}</span>}
          {isDoc && <span>·</span>}
          <span>{formatDate(item.updated_at)}</span>
          {item.is_favorite && <Star weight="light" className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
    </div>
  );
}
