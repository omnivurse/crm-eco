'use client';

import { useState } from 'react';
import { Folder, FolderRoot } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@crm-eco/ui/components/dialog';
import { Button } from '@crm-eco/ui/components/button';
import type { DocFolder } from './types';

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allFolders: DocFolder[];
  excludeIds: string[];
  onMove: (targetFolderId: string | null) => Promise<void>;
}

export function MoveDialog({ open, onOpenChange, allFolders, excludeIds, onMove }: MoveDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const availableFolders = allFolders.filter(f => !excludeIds.includes(f.id));

  const handleMove = async () => {
    setLoading(true);
    try {
      await onMove(selected);
      onOpenChange(false);
    } catch {
      // handled by parent
    } finally {
      setLoading(false);
    }
  };

  const renderFolder = (folder: DocFolder, depth: number): React.ReactNode => {
    const children = availableFolders.filter(f => f.parent_id === folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => setSelected(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors ${
            selected === folder.id ? 'bg-blue-50 text-blue-700' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <Folder className="w-4 h-4 shrink-0" />
          {folder.name}
        </button>
        {children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  const rootFolders = availableFolders.filter(f => f.parent_id === null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto border rounded-md p-1">
          <button
            onClick={() => setSelected(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors ${
              selected === null ? 'bg-blue-50 text-blue-700' : ''
            }`}
          >
            <FolderRoot className="w-4 h-4 shrink-0" />
            Root (No Folder)
          </button>
          {rootFolders.map(f => renderFolder(f, 1))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove} disabled={loading}>
            {loading ? 'Moving...' : 'Move Here'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
