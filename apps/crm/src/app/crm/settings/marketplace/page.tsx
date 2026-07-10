'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Star,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ArrowLeft,
  Grid3X3,
  List,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';
import Link from 'next/link';

/* ---------- types ---------- */

interface Extension {
  id: string;
  name: string;
  key: string;
  slug: string;
  description: string | null;
  category: string;
  extension_type: string;
  icon: string | null;
  icon_url: string | null;
  color: string | null;
  version: string;
  provider_name: string | null;
  pricing: string | null;
  is_free: boolean;
  is_featured: boolean;
  rating_avg: number | null;
  rating_count: number;
  install_count: number;
  status: string;
  installed: boolean;
  install_status: string | null;
}

interface ExtensionInstall {
  id: string;
  extension_id: string;
  status: string;
  installed_at: string;
  enabled_at: string | null;
  disabled_at: string | null;
  extension: {
    name: string;
    key: string;
    slug: string;
    description: string | null;
    category: string;
    extension_type: string;
    icon: string | null;
    icon_url: string | null;
    color: string | null;
    version: string;
    provider_name: string | null;
    is_free: boolean;
  };
}

/* ---------- constants ---------- */

const EXTENSION_CATEGORIES = [
  'communication', 'analytics', 'automation', 'data',
  'finance', 'compliance', 'productivity', 'utility', 'custom',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Communication',
  analytics: 'Analytics',
  automation: 'Automation',
  data: 'Data',
  finance: 'Finance',
  compliance: 'Compliance',
  productivity: 'Productivity',
  utility: 'Utility',
  custom: 'Custom',
};

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  analytics: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  automation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  data: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  finance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  compliance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  productivity: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  utility: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  custom: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

/* ---------- component ---------- */

export default function MarketplacePage() {
  const [activeView, setActiveView] = useState<'browse' | 'installed'>('browse');

  // Browse state
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [extensionsLoading, setExtensionsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [installingId, setInstallingId] = useState<string | null>(null);

  // Installed state
  const [installs, setInstalls] = useState<ExtensionInstall[]>([]);
  const [installsLoading, setInstallsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);

  /* ---------- fetch extensions ---------- */

  const fetchExtensions = useCallback(async () => {
    try {
      setExtensionsLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/crm/extensions?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExtensions(json.extensions || []);
    } catch {
      toast.error('Failed to load extensions');
    } finally {
      setExtensionsLoading(false);
    }
  }, [categoryFilter, searchQuery]);

  /* ---------- fetch installs ---------- */

  const fetchInstalls = useCallback(async () => {
    try {
      setInstallsLoading(true);
      const res = await fetch('/api/crm/extensions/installs');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setInstalls(json.installs || []);
    } catch {
      toast.error('Failed to load installed extensions');
    } finally {
      setInstallsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  useEffect(() => {
    fetchInstalls();
  }, [fetchInstalls]);

  /* ---------- install extension ---------- */

  async function installExtension(ext: Extension) {
    try {
      setInstallingId(ext.id);
      const res = await fetch('/api/crm/extensions/installs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extension_id: ext.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to install extension');
        return;
      }
      toast.success(`${ext.name} installed successfully`);
      setExtensions((prev) =>
        prev.map((e) => (e.id === ext.id ? { ...e, installed: true, install_status: 'active' } : e))
      );
      fetchInstalls();
    } catch {
      toast.error('Failed to install extension');
    } finally {
      setInstallingId(null);
    }
  }

  /* ---------- toggle install ---------- */

  async function toggleInstall(install: ExtensionInstall) {
    const newStatus = install.status === 'active' ? 'disabled' : 'active';
    try {
      setTogglingId(install.id);
      const res = await fetch('/api/crm/extensions/installs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: install.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setInstalls((prev) =>
        prev.map((i) => (i.id === install.id ? { ...i, status: newStatus } : i))
      );
      toast.success(`${install.extension.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update extension');
    } finally {
      setTogglingId(null);
    }
  }

  /* ---------- uninstall ---------- */

  async function uninstallExtension(install: ExtensionInstall) {
    if (!(await confirmDialog({ title: `Uninstall ${install.extension.name}?`, description: 'This cannot be undone.', confirmLabel: 'Uninstall', destructive: true }))) return;
    try {
      setUninstallingId(install.id);
      const res = await fetch(`/api/crm/extensions/installs?extension_id=${install.extension_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setInstalls((prev) => prev.filter((i) => i.id !== install.id));
      setExtensions((prev) =>
        prev.map((e) => (e.id === install.extension_id ? { ...e, installed: false, install_status: null } : e))
      );
      toast.success(`${install.extension.name} uninstalled`);
    } catch {
      toast.error('Failed to uninstall extension');
    } finally {
      setUninstallingId(null);
    }
  }

  /* ---------- render stars ---------- */

  function renderRating(rating: number | null) {
    if (rating === null || rating === undefined) return <span className="text-xs text-slate-400">No ratings</span>;
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        <span className="text-slate-700 dark:text-slate-300 font-medium">{rating.toFixed(1)}</span>
      </span>
    );
  }

  /* ---------- render ---------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <Puzzle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketplace</h1>
            <p className="text-slate-600 dark:text-slate-400">Browse, install, and manage extensions and integrations</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveView('browse')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'browse'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Grid3X3 className="w-4 h-4" /> Browse
        </button>
        <button
          onClick={() => setActiveView('installed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'installed'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <List className="w-4 h-4" /> Installed
          {installs.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
              {installs.length}
            </span>
          )}
        </button>
      </div>

      {/* ========== BROWSE VIEW ========== */}
      {activeView === 'browse' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search extensions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXTENSION_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { setExtensionsLoading(true); fetchExtensions(); }} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          {/* Extension Grid */}
          {extensionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : extensions.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No extensions found</p>
              <Button onClick={() => { setExtensionsLoading(true); fetchExtensions(); }} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {extensions.map((ext) => (
                <Card key={ext.id} className="glass-card border-slate-200 dark:border-white/10 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{ backgroundColor: ext.color || '#6366f1' }}
                        >
                          {ext.icon_url ? (
                            <img src={ext.icon_url} alt="" className="w-6 h-6" />
                          ) : (
                            ext.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base text-slate-900 dark:text-white truncate">{ext.name}</CardTitle>
                          {ext.provider_name && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{ext.provider_name}</p>
                          )}
                        </div>
                      </div>
                      {ext.is_featured && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs shrink-0">
                          Featured
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 flex-1">
                      {ext.description || 'No description available'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[ext.category] || CATEGORY_COLORS.custom}`}>
                        {CATEGORY_LABELS[ext.category] || ext.category}
                      </span>
                      {renderRating(ext.rating_avg)}
                      <span className="text-xs text-slate-500">
                        <Download className="w-3 h-3 inline mr-0.5" />
                        {ext.install_count.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {ext.is_free ? 'Free' : ext.pricing || 'Paid'}
                      </span>
                      {ext.installed ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Installed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => installExtension(ext)}
                          disabled={installingId === ext.id}
                        >
                          {installingId === ext.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          Install
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== INSTALLED VIEW ========== */}
      {activeView === 'installed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {installs.length} extension{installs.length !== 1 ? 's' : ''} installed
            </p>
            <Button onClick={() => { setInstallsLoading(true); fetchInstalls(); }} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          {installsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : installs.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No extensions installed yet</p>
              <Button onClick={() => setActiveView('browse')} variant="outline" className="mt-4">
                Browse Extensions
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {installs.map((install) => (
                <Card key={install.id} className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{ backgroundColor: install.extension.color || '#6366f1' }}
                        >
                          {install.extension.icon_url ? (
                            <img src={install.extension.icon_url} alt="" className="w-6 h-6" />
                          ) : (
                            install.extension.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 dark:text-white">{install.extension.name}</h3>
                            <Badge
                              variant="secondary"
                              className={
                                install.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }
                            >
                              {install.status}
                            </Badge>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[install.extension.category] || CATEGORY_COLORS.custom}`}>
                              {CATEGORY_LABELS[install.extension.category] || install.extension.category}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {install.extension.description || 'No description'}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>v{install.extension.version}</span>
                            {install.extension.provider_name && (
                              <span>by {install.extension.provider_name}</span>
                            )}
                            <span>
                              Installed {new Date(install.installed_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleInstall(install)}
                          disabled={togglingId === install.id}
                          className="flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
                          title={install.status === 'active' ? 'Disable' : 'Enable'}
                        >
                          {togglingId === install.id ? (
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                          ) : install.status === 'active' ? (
                            <ToggleRight className="w-8 h-8 text-teal-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-slate-400" />
                          )}
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uninstallExtension(install)}
                          disabled={uninstallingId === install.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          {uninstallingId === install.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
