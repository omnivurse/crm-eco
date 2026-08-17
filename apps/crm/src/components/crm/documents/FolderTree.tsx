'use client';

import { FolderRoot } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import type { DocFolder } from './types';
import { FolderTreeItem } from './FolderTreeItem';

interface FolderTreeProps {
  folders: DocFolder[];
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onNewFolder: () => void;
}

export function FolderTree({ folders, currentFolderId, onSelectFolder, onNewFolder }: FolderTreeProps) {
  const rootFolders = folders.filter(f => f.parent_id === null);

  return (
    <div className="w-56 border-r border-gray-200 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <Button variant="outline" size="sm" className="w-full" onClick={onNewFolder}>
          New Folder
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 transition-colors mb-1 ${
            currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-700'
          }`}
        >
          <FolderRoot className="w-4 h-4 shrink-0" />
          <span>All Documents</span>
        </button>
        {rootFolders.map(folder => (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            allFolders={folders}
            currentFolderId={currentFolderId}
            onSelect={onSelectFolder}
          />
        ))}
      </div>
    </div>
  );
}
