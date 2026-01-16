'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@crm-eco/ui/components/dropdown-menu';
import { Plus, ChevronDown, Star, Lock, Globe } from 'lucide-react';

interface CrmView {
  id: string;
  name: string;
  is_default: boolean;
  is_shared: boolean;
  created_by?: string;
}

interface ViewsBarProps {
  views: CrmView[];
  activeViewId?: string;
  moduleKey: string;
  onCreateView?: () => void;
}

export function ViewsBar({ views, activeViewId, moduleKey, onCreateView }: ViewsBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = (viewId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', viewId);
    params.delete('page'); // Reset pagination when changing views
    router.push(`/crm/modules/${moduleKey}?${params.toString()}`);
  };

  // Show first 5 views, rest in dropdown
  const visibleViews = views.slice(0, 5);
  const overflowViews = views.slice(5);
  const activeView = views.find(v => v.id === activeViewId) || views.find(v => v.is_default);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {/* View Pills */}
      {visibleViews.map((view) => (
        <button
          key={view.id}
          onClick={() => handleViewChange(view.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
            'border',
            activeView?.id === view.id
              ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30'
              : 'bg-white dark:bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
          )}
        >
          {view.is_default && <Star className="w-3 h-3" />}
          {view.is_shared ? <Globe className="w-3 h-3 opacity-50" /> : <Lock className="w-3 h-3 opacity-50" />}
          {view.name}
        </button>
      ))}

      {/* Overflow Dropdown */}
      {overflowViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 rounded-full text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              +{overflowViews.length} more
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
          >
            {overflowViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => handleViewChange(view.id)}
                className={cn(
                  'flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300',
                  activeView?.id === view.id && 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300'
                )}
              >
                {view.is_shared ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {view.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

      {/* Create View Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onCreateView}
        className="h-8 px-2.5 rounded-full text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/10"
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Create View
      </Button>
    </div>
  );
}
