'use client';

import { CaretDown, CaretRight, Folder, FolderOpen, Star } from '@phosphor-icons/react';
import { useState } from 'react';
import type { DocFolder } from './types';

interface FolderTreeItemProps {
  folder: DocFolder;
  allFolders: DocFolder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  depth?: number;
}

export function FolderTreeItem({ folder, allFolders, currentFolderId, onSelect, depth = 0 }: FolderTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const children = allFolders.filter(f => f.parent_id === folder.id);
  const isActive = currentFolderId === folder.id;
  const hasChildren = children.length > 0;

  return (
    <div>
      <button
        onClick={() => onSelect(folder.id)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {expanded ? <CaretDown weight="light" className="w-3.5 h-3.5" /> : <CaretRight weight="light" className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4.5" />
        )}
        {isActive ? (
          <FolderOpen weight="light" className="w-4 h-4 text-blue-600 shrink-0" />
        ) : (
          <Folder weight="light" className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        {folder.is_favorite && <Star weight="light" className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
      </button>
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
