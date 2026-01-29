'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Search,
  Upload,
  Trash2,
  Check,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
  Copy,
  CheckCircle2,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';

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

interface AssetLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: EmailAsset) => void;
  onUploadClick?: () => void;
}

const FOLDERS = [
  { value: 'all', label: 'All Assets' },
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

export function AssetLibrary({
  open,
  onOpenChange,
  onSelect,
  onUploadClick,
}: AssetLibraryProps) {
  const [assets, setAssets] = useState<EmailAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<EmailAsset | null>(null);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (folder !== 'all') params.append('folder', folder);
      if (search) params.append('search', search);
      params.append('limit', '50');

      const response = await fetch(`/api/email/assets?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      const data = await response.json();
      setAssets(data.assets || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useEffect(() => {
    if (open) {
      fetchAssets();
    }
  }, [open, fetchAssets]);

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    setDeleting(assetId);
    try {
      const response = await fetch('/api/email/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [assetId] }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete asset');
      }

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
      }
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = () => {
    if (selectedAsset) {
      onSelect(selectedAsset);
      onOpenChange(false);
      setSelectedAsset(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Asset Library</DialogTitle>
          <DialogDescription>
            Select an image from your library or upload a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Filters Bar */}
        <div className="flex items-center gap-3 py-2">
          <div className="relative flex-1">
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
            type="button"
            variant="outline"
            size="icon"
            onClick={fetchAssets}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
          {onUploadClick && (
            <Button type="button" onClick={onUploadClick} className="gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>

        {/* Assets Grid */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading && assets.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <p className="text-sm">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchAssets}
              >
                Try Again
              </Button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No assets found</p>
              <p className="text-xs mt-1">Upload some images to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 p-1">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={cn(
                    'group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                    selectedAsset?.id === asset.id
                      ? 'border-teal-500 ring-2 ring-teal-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-teal-500/50'
                  )}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.alt_text || asset.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Selection Indicator */}
                  {selectedAsset?.id === asset.id && (
                    <div className="absolute top-2 left-2 p-1 rounded-full bg-teal-500 text-white">
                      <Check className="w-3 h-3" />
                    </div>
                  )}

                  {/* Actions Menu */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3 h-3" />
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
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy URL
                            </>
                          )}
                        </DropdownMenuItem>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-xs text-white truncate">{asset.name}</p>
                    <p className="text-xs text-white/70">{formatFileSize(asset.file_size)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-500">
            {total} asset{total !== 1 ? 's' : ''} total
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleInsert} disabled={!selectedAsset}>
              Insert Selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssetLibrary;
