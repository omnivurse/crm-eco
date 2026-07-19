'use client';

import { ArrowsDownUp, FolderSimple, List, MagnifyingGlass, SquaresFour, Trash, UploadSimple } from '@phosphor-icons/react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import type { ViewMode, SortField, SortDir } from './types';

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortField;
  sortDir: SortDir;
  onSortChange: (field: SortField, dir: SortDir) => void;
  selectedCount: number;
  onUpload: () => void;
  onTrash: () => void;
  onMove: () => void;
}

export function FileToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  sortDir,
  onSortChange,
  selectedCount,
  onUpload,
  onTrash,
  onMove,
}: FileToolbarProps) {
  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'updated_at', label: 'Modified' },
    { field: 'created_at', label: 'Created' },
    { field: 'size_bytes', label: 'Size' },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
      <div className="relative flex-1 max-w-sm">
        <MagnifyingGlass weight="light" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="MagnifyingGlass documents..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowsDownUp weight="light" className="w-3.5 h-3.5" />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sortOptions.map(opt => (
            <DropdownMenuItem
              key={opt.field}
              onClick={() =>
                onSortChange(
                  opt.field,
                  sortBy === opt.field && sortDir === 'asc' ? 'desc' : 'asc'
                )
              }
            >
              {opt.label} {sortBy === opt.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center border rounded-md">
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-1.5 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
        >
          <List weight="light" className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
        >
          <SquaresFour weight="light" className="w-4 h-4" />
        </button>
      </div>

      {selectedCount > 0 && (
        <>
          <Button variant="outline" size="sm" onClick={onMove} className="gap-1.5">
            <FolderSimple weight="light" className="w-3.5 h-3.5" />
            Move ({selectedCount})
          </Button>
          <Button variant="outline" size="sm" onClick={onTrash} className="gap-1.5 text-red-600 hover:text-red-700">
            <Trash weight="light" className="w-3.5 h-3.5" />
            Trash ({selectedCount})
          </Button>
        </>
      )}

      <Button size="sm" onClick={onUpload} className="gap-1.5 ml-auto">
        <UploadSimple weight="light" className="w-3.5 h-3.5" />
        UploadSimple
      </Button>
    </div>
  );
}
