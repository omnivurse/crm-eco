'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { cn } from '@crm-eco/ui/lib/utils';
import { ChevronDown, Star, Lock, Globe, Plus, Check, Pencil } from 'lucide-react';
import type { CrmView } from '@/lib/crm/types';

interface ViewsDropdownProps {
  views: CrmView[];
  activeViewId?: string;
  moduleKey: string;
  onCreateView?: () => void;
  onEditView?: (viewId: string) => void;
  className?: string;
}

export function ViewsDropdown({
  views,
  activeViewId,
  moduleKey,
  onCreateView,
  onEditView,
  className,
}: ViewsDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeView = views.find(v => v.id === activeViewId) || views.find(v => v.is_default);

  const handleViewChange = (viewId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', viewId);
    params.delete('page');
    router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
    setOpen(false);
  };

  // Group views: default first, then shared, then personal
  const sortedViews = [...views].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    if (a.is_shared && !b.is_shared) return -1;
    if (!a.is_shared && b.is_shared) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 px-3 gap-2 border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50',
            'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
            'hover:bg-slate-50 dark:hover:bg-white/5',
            className
          )}
        >
          {activeView?.is_default && <Star className="w-3.5 h-3.5 text-amber-500" />}
          {activeView?.is_shared ? (
            <Globe className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="max-w-[150px] truncate">
            {activeView?.name || 'All Records'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Views
        </div>
        
        {sortedViews.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-slate-500">
            No saved views
          </div>
        ) : (
          sortedViews.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => handleViewChange(view.id)}
              className={cn(
                'flex items-center justify-between gap-2 py-2 cursor-pointer',
                'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5',
                activeView?.id === view.id && 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {view.is_default ? (
                  <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : view.is_shared ? (
                  <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}
                <span className="truncate">{view.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {activeView?.id === view.id && (
                  <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                )}
                {onEditView && !view.is_default && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditView(view.id);
                    }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator className="bg-slate-200 dark:bg-white/10" />
        
        <DropdownMenuItem
          onClick={() => {
            onCreateView?.();
            setOpen(false);
          }}
          className="flex items-center gap-2 py-2 cursor-pointer text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
