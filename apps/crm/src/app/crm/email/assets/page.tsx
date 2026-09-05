'use client';

import { toast } from 'sonner';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Input } from '@crm-eco/ui/components/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Upload,
  Search,
  FolderOpen,
  Image as ImageIcon,
  Trash2,
  Copy,
  MoreVertical,
  RefreshCw,
  Loader2,
  Check,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { ImageUploader } from '@/components/email/ImageUploader';
import { useClientAuth } from '@/hooks/useClientAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedSearch';
import {
  canDeleteEmailAssets,
  canUploadEmailAssets,
} from '@/lib/email/asset-permissions';
import { toastCopy } from '@/lib/crm/toast-copy';

interface EmailAsset {
  id: string;
  name: string;
  file_name: string;
  file_path: string;
  bucket_path: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  alt_text?: string;
  folder: string;
  tags: string[];
  is_public: boolean;
  public_url: string;
  created_at: string;
}

const FOLDERS = [
  { value: 'all', label: 'All Folders' },
  { value: 'general', label: 'General' },
  { value: 'email-images', label: 'Email Images' },
  { value: 'logos', label: 'Logos' },
  { value: 'products', label: 'Products' },
  { value: 'banners', label: 'Banners' },
  { value: 'icons', label: 'Icons' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AssetLibraryPage() {
  const [assets, setAssets] = useState<EmailAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { profile, loading: authLoading } = useClientAuth();
  const canUpload = canUploadEmailAssets(profile?.crm_role);
  const canDelete = canDeleteEmailAssets(profile?.crm_role);

  // Typing used to refire the request on every keystroke: `search` was a
  // dependency of the fetch callback, which was itself the effect's only
  // dependency.
  const debouncedSearch = useDebouncedValue(search, 300);

  // Cancels the in-flight request so a slow earlier response cannot land
  // after a newer one and show the wrong results.
  const inFlight = useRef<AbortController | null>(null);

  const fetchAssets = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (folder !== 'all') params.append('folder', folder);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('limit', '100');

      const response = await fetch(`/api/email/assets?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load assets');
      }

      const data = await response.json();
      setAssets(data.assets || []);
      setTotal(data.total || 0);
    } catch (err) {
      // An aborted request was replaced by a newer one; it is not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, [folder, debouncedSearch]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Drop any pending request when leaving the page.
  useEffect(() => () => inFlight.current?.abort(), []);

  const allSelected = assets.length > 0 && selectedAssets.size === assets.length;
  const isFiltered = useMemo(
    () => folder !== 'all' || debouncedSearch.trim().length > 0,
    [folder, debouncedSearch],
  );

  const clearFilters = () => {
    setSearch('');
    setFolder('all');
  };

  const handleDelete = async (assetId: string) => {
    if (!(await confirmDialog({ title: 'Delete this asset?', confirmLabel: 'Delete', destructive: true }))) return;

    setDeleting(assetId);
    try {
      const response = await fetch('/api/email/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [assetId] }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete asset');
      }

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setSelectedAssets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(assetId);
        return newSet;
      });
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success(toastCopy.deleted('asset'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : toastCopy.failed('delete that asset'),
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAssets.size === 0) return;
    if (!(await confirmDialog({ title: `Delete ${selectedAssets.size} assets?`, confirmLabel: 'Delete', destructive: true }))) return;

    try {
      const response = await fetch('/api/email/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedAssets) }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete assets');
      }

      const removed = selectedAssets.size;
      setAssets((prev) => prev.filter((a) => !selectedAssets.has(a.id)));
      setTotal((prev) => Math.max(0, prev - removed));
      setSelectedAssets(new Set());
      toast.success(toastCopy.counted('asset', removed, 'Deleted'));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : toastCopy.failed('delete those assets'),
      );
    }
  };

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      // Unavailable outside a secure context, and can still be refused by
      // permissions policy — either way the click must not fail silently.
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(toastCopy.failed('copy that link', undefined, 'Copy it from the address bar after opening the image'));
    }
  };

  const toggleSelect = (assetId: string) => {
    setSelectedAssets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(assetId)) {
        newSet.delete(assetId);
      } else {
        newSet.add(assetId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (allSelected) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  const handleUploadComplete = (_url?: string, _alt?: string) => {
    setShowUploader(false);
    fetchAssets();
  };

  return (
    <div className="w-full py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Asset Library
          </h1>
          <p className="text-sm text-slate-500">
            Manage images and files for your email campaigns
          </p>
        </div>
        {!authLoading && !canUpload ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock className="w-4 h-4" />
            View only — ask an admin for upload access
          </div>
        ) : (
          <Button
            onClick={() => setShowUploader(true)}
            className="gap-2"
            disabled={authLoading}
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets..."
                className="pl-9"
              />
            </div>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger className="w-40">
                <FolderOpen className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                {FOLDERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchAssets}
              disabled={loading}
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            {selectedAssets.size > 0 && canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedAssets.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-4">
          {/* The API caps a page at 100, so say so rather than implying the
              grid holds everything. */}
          <span>
            {assets.length < total
              ? `Showing ${assets.length} of ${total} assets`
              : `${total} total ${total === 1 ? 'asset' : 'assets'}`}
          </span>
          {selectedAssets.size > 0 && (
            <span className="text-teal-600">{selectedAssets.size} selected</span>
          )}
        </div>
        {assets.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="text-xs"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading && assets.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchAssets}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            {isFiltered ? (
              <>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No matching assets
                </h3>
                <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">
                  Nothing matches {debouncedSearch ? `“${debouncedSearch}”` : 'this folder'}.
                  Try a different search or folder.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No Assets Yet
                </h3>
                <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">
                  Upload images to use in your email campaigns. Supported formats:
                  JPEG, PNG, GIF, WebP.
                </p>
                {canUpload ? (
                  <Button onClick={() => setShowUploader(true)} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Your First Image
                  </Button>
                ) : (
                  <p className="text-xs text-slate-400">
                    You do not have permission to upload assets.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className={cn(
                'group overflow-hidden cursor-pointer transition-all hover:shadow-lg',
                selectedAssets.has(asset.id) && 'ring-2 ring-teal-500'
              )}
              onClick={() => toggleSelect(asset.id)}
            >
              <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                <img
                  src={asset.public_url}
                  alt={asset.alt_text || asset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Selection Indicator */}
                <div
                  className={cn(
                    'absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                    selectedAssets.has(asset.id)
                      ? 'bg-teal-500 border-teal-500 text-white'
                      : 'border-white/80 bg-black/20 opacity-0 group-hover:opacity-100'
                  )}
                >
                  {selectedAssets.has(asset.id) && <Check className="w-4 h-4" />}
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(asset.public_url, asset.id);
                        }}
                      >
                        {copiedId === asset.id ? (
                          <Check className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        {copiedId === asset.id ? 'Copied!' : 'Copy URL'}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onClick={(e) => e.stopPropagation()}>
                        <a href={asset.public_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in New Tab
                        </a>
                      </DropdownMenuItem>
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(asset.id);
                          }}
                          className="text-red-600"
                          disabled={deleting === asset.id}
                        >
                          {deleting === asset.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {asset.name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{formatFileSize(asset.file_size)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {asset.folder}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Uploader Modal */}
      <ImageUploader
        open={showUploader}
        onOpenChange={setShowUploader}
        onImageInsert={handleUploadComplete}
      />
    </div>
  );
}
