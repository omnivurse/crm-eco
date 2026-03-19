'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Checkbox } from '@crm-eco/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@crm-eco/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@crm-eco/ui/components/dropdown-menu';
import { Bookmark, Star, Trash2, Plus, Loader2 } from 'lucide-react';
import { createClient } from '@crm-eco/lib/supabase/client';
import { toast } from 'sonner';

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  is_default: boolean;
  created_at: string;
}

interface SavedViewsMenuProps {
  orgId: string;
  currentFilters: { search?: string; advisor?: string; status?: string; market_type?: string };
}

export function SavedViewsMenu({ orgId, currentFilters }: SavedViewsMenuProps) {
  const router = useRouter();
  const supabase = createClient();

  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchViews = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_views')
      .select('id, name, filters, is_default, created_at')
      .eq('organization_id', orgId)
      .eq('page_key', 'members')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) {
      console.error('Failed to fetch saved views:', error);
    } else {
      setViews(data ?? []);
    }
    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const applyView = (view: SavedView) => {
    const params = new URLSearchParams();
    const filters = view.filters;
    if (filters.search) params.set('search', filters.search);
    if (filters.advisor) params.set('advisor', filters.advisor);
    if (filters.status) params.set('status', filters.status);
    router.push(`/members?${params.toString()}`);
    setDropdownOpen(false);
    toast.success(`Applied view "${view.name}"`);
  };

  const saveView = async () => {
    const trimmedName = viewName.trim();
    if (!trimmedName) {
      toast.error('Please enter a view name');
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        toast.error('You must be logged in to save views');
        return;
      }

      // If setting as default, clear existing default first
      if (isDefault) {
        await supabase
          .from('saved_views')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('organization_id', orgId)
          .eq('user_id', userData.user.id)
          .eq('page_key', 'members')
          .eq('is_default', true);
      }

      // Build clean filters object (omit empty values)
      const filters: Record<string, string> = {};
      if (currentFilters.search) filters.search = currentFilters.search;
      if (currentFilters.advisor) filters.advisor = currentFilters.advisor;
      if (currentFilters.status) filters.status = currentFilters.status;
      if (currentFilters.market_type) filters.market_type = currentFilters.market_type;

      const { error } = await supabase.from('saved_views').insert({
        organization_id: orgId,
        user_id: userData.user.id,
        name: trimmedName,
        filters,
        page_key: 'members',
        is_default: isDefault,
      });

      if (error) {
        toast.error('Failed to save view');
        console.error('Save view error:', error);
        return;
      }

      toast.success(`View "${trimmedName}" saved`);
      setDialogOpen(false);
      setViewName('');
      setIsDefault(false);
      await fetchViews();
    } catch (err) {
      console.error('Unexpected error saving view:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const deleteView = async (e: React.MouseEvent, viewId: string, viewName: string) => {
    e.stopPropagation();
    setDeleting(viewId);

    try {
      const { error } = await supabase
        .from('saved_views')
        .delete()
        .eq('id', viewId);

      if (error) {
        toast.error('Failed to delete view');
        console.error('Delete view error:', error);
        return;
      }

      toast.success(`View "${viewName}" deleted`);
      setViews((prev) => prev.filter((v) => v.id !== viewId));
    } catch (err) {
      console.error('Unexpected error deleting view:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setDeleting(null);
    }
  };

  const hasActiveFilters =
    !!currentFilters.search || !!currentFilters.advisor || !!currentFilters.status || !!currentFilters.market_type;

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Bookmark className="w-4 h-4" />
            <span className="hidden sm:inline">Saved Views</span>
            {views.length > 0 && (
              <span className="ml-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {views.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Loading views...</span>
            </div>
          ) : views.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-slate-500">
              No saved views yet
            </div>
          ) : (
            <>
              <DropdownMenuLabel>Your Views</DropdownMenuLabel>
              {views.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onSelect={() => applyView(view)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {view.is_default && (
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{view.name}</span>
                  </div>
                  <button
                    onClick={(e) => deleteView(e, view.id, view.name)}
                    disabled={deleting === view.id}
                    className="shrink-0 rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    aria-label={`Delete view "${view.name}"`}
                  >
                    {deleting === view.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={!hasActiveFilters}
            onSelect={(e) => {
              e.preventDefault();
              setDropdownOpen(false);
              setDialogOpen(true);
            }}
            className="gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Save Current View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="save-view-description">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription id="save-view-description">
              Save your current filter settings as a reusable view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </label>
              <Input
                id="view-name"
                placeholder="e.g. Active Members by John"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && viewName.trim()) {
                    saveView();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <label htmlFor="is-default" className="text-sm cursor-pointer select-none">
                Set as default view
              </label>
            </div>

            <div className="rounded-md bg-slate-50 p-3 space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Filters to save
              </p>
              {currentFilters.search && (
                <p className="text-sm text-slate-700">
                  Search: <span className="font-medium">&quot;{currentFilters.search}&quot;</span>
                </p>
              )}
              {currentFilters.advisor && (
                <p className="text-sm text-slate-700">
                  Advisor: <span className="font-medium">{currentFilters.advisor}</span>
                </p>
              )}
              {currentFilters.status && (
                <p className="text-sm text-slate-700">
                  Status:{' '}
                  <span className="font-medium">
                    {currentFilters.status.charAt(0).toUpperCase() +
                      currentFilters.status.slice(1)}
                  </span>
                </p>
              )}
              {!hasActiveFilters && (
                <p className="text-sm text-slate-400 italic">No active filters</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveView} disabled={saving || !viewName.trim()}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save View'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
