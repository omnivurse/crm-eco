'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Star,
  Check,
  Sparkles,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  is_featured: boolean;
  is_free: boolean;
  rating: number | null;
  install_count: number;
  status: string;
  installed: boolean;
  install_status: string | null;
}

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'communication', label: 'Communication' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'automation', label: 'Automation' },
  { value: 'data', label: 'Data' },
  { value: 'finance', label: 'Finance' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'utility', label: 'Utility' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, string> = {
  communication: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  analytics: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  automation: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  data: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  finance: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  compliance: 'bg-red-500/10 text-red-600 dark:text-red-400',
  productivity: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  utility: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  custom: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExtensionsCatalog() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const fetchExtensions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/crm/extensions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setExtensions(data.extensions || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Failed to load extensions');
      }
    } catch {
      toast.error('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    setLoading(true);
    const debounce = setTimeout(() => fetchExtensions(), 300);
    return () => clearTimeout(debounce);
  }, [fetchExtensions]);

  async function handleInstall(ext: Extension) {
    setInstalling(ext.id);
    try {
      const res = await fetch('/api/crm/extensions/installs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extension_id: ext.id }),
      });
      if (res.ok) {
        toast.success(`${ext.name} installed successfully`);
        // Update local state
        setExtensions((prev) =>
          prev.map((e) =>
            e.id === ext.id ? { ...e, installed: true, install_status: 'active' } : e
          )
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to install extension');
      }
    } catch {
      toast.error('Failed to install extension');
    } finally {
      setInstalling(null);
    }
  }

  function renderStars(rating: number | null) {
    if (rating == null) return null;
    const stars = Math.round(rating * 2) / 2; // round to nearest 0.5
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        ))}
        <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading && extensions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Extensions Catalog</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Browse and install extensions to enhance your CRM ({total} available)
          </p>
        </div>
        <Button onClick={() => { setLoading(true); fetchExtensions(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search extensions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Extensions grid */}
      {extensions.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p>No extensions found</p>
          {(category !== 'all' || search) && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { setCategory('all'); setSearch(''); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {extensions.map((ext) => (
            <Card
              key={ext.id}
              className="glass-card border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 transition-colors relative"
            >
              {ext.is_featured && (
                <div className="absolute top-3 right-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
              )}
              <CardContent className="pt-6">
                {/* Icon placeholder */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold mb-4"
                  style={{ backgroundColor: ext.color || '#6366f1' }}
                >
                  {ext.icon ? (
                    <span>{ext.icon}</span>
                  ) : (
                    <span>{ext.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <h3 className="font-semibold text-slate-900 dark:text-white">{ext.name}</h3>
                {ext.provider_name && (
                  <p className="text-xs text-slate-400 mt-0.5">by {ext.provider_name}</p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                  {ext.description || 'No description provided'}
                </p>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge className={CATEGORY_COLORS[ext.category] || CATEGORY_COLORS.utility}>
                    {ext.category}
                  </Badge>
                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {ext.extension_type}
                  </Badge>
                  {ext.is_free && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Free
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
                  <div className="space-y-1">
                    {renderStars(ext.rating)}
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Download className="w-3 h-3" />
                      <span>{ext.install_count.toLocaleString()} installs</span>
                    </div>
                  </div>

                  {ext.installed ? (
                    <Button variant="outline" size="sm" disabled className="text-emerald-600">
                      <Check className="w-4 h-4 mr-1" /> Installed
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleInstall(ext)}
                      disabled={installing === ext.id}
                    >
                      {installing === ext.id ? (
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
  );
}
