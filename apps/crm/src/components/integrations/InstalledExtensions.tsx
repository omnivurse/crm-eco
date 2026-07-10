'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Loader2,
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Settings,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { Badge } from '@crm-eco/ui/components/badge';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstalledExtension {
  id: string;
  extension_id: string;
  organization_id: string;
  status: 'active' | 'disabled';
  config: Record<string, unknown>;
  granted_scopes: string[];
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstalledExtensions() {
  const [installs, setInstalls] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);

  const fetchInstalls = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/extensions/installs');
      if (res.ok) {
        const data = await res.json();
        setInstalls(data.installs || []);
      } else {
        toast.error('Failed to load installed extensions');
      }
    } catch {
      toast.error('Failed to load installed extensions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInstalls(); }, [fetchInstalls]);

  async function handleToggle(install: InstalledExtension) {
    const newStatus = install.status === 'active' ? 'disabled' : 'active';
    setToggling(install.id);
    try {
      const res = await fetch('/api/crm/extensions/installs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: install.id, status: newStatus }),
      });
      if (res.ok) {
        toast.success(`${install.extension.name} ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
        setInstalls((prev) =>
          prev.map((i) => (i.id === install.id ? { ...i, status: newStatus } : i))
        );
      } else {
        toast.error('Failed to update extension');
      }
    } catch {
      toast.error('Failed to update extension');
    } finally {
      setToggling(null);
    }
  }

  async function handleUninstall(install: InstalledExtension) {
    if (!(await confirmDialog({ title: `Uninstall "${install.extension.name}"?`, description: 'This will remove all configuration.', confirmLabel: 'Uninstall', destructive: true }))) return;
    setUninstalling(install.id);
    try {
      const res = await fetch(`/api/crm/extensions/installs?extension_id=${install.extension_id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`${install.extension.name} uninstalled`);
        setInstalls((prev) => prev.filter((i) => i.id !== install.id));
      } else {
        toast.error('Failed to uninstall extension');
      }
    } catch {
      toast.error('Failed to uninstall extension');
    } finally {
      setUninstalling(null);
    }
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  const activeCount = installs.filter((i) => i.status === 'active').length;
  const disabledCount = installs.filter((i) => i.status === 'disabled').length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Installed Extensions</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage extensions installed in your organization</p>
        </div>
        <Button onClick={() => { setLoading(true); fetchInstalls(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Installed', value: installs.length, icon: Package, color: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, color: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Disabled', value: disabledCount, icon: XCircle, color: 'bg-slate-500/10', textColor: 'text-slate-600 dark:text-slate-400' },
        ].map((kpi) => (
          <Card key={kpi.label} className="glass-card border-slate-200 dark:border-white/10">
            <CardContent className="pt-6">
              <div className={`p-3 rounded-xl ${kpi.color} w-fit mb-3`}>
                <kpi.icon className={`w-6 h-6 ${kpi.textColor}`} />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Installed list */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-blue-500" /> Your Extensions
          </CardTitle>
          <CardDescription>Enable, disable, or uninstall extensions</CardDescription>
        </CardHeader>
        <CardContent>
          {installs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Puzzle className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No extensions installed yet</p>
              <p className="text-sm mt-1">Browse the catalog to find extensions for your CRM.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {installs.map((inst) => {
                const ext = inst.extension;
                const isActive = inst.status === 'active';
                return (
                  <div
                    key={inst.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border transition-colors ${
                      isActive
                        ? 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/20 opacity-75'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: ext.color || '#6366f1' }}
                    >
                      {ext.icon ? (
                        <span>{ext.icon}</span>
                      ) : (
                        <span>{ext.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-white">{ext.name}</span>
                        <Badge
                          className={
                            isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }
                        >
                          {inst.status}
                        </Badge>
                        <span className="text-xs text-slate-400">v{ext.version}</span>
                      </div>
                      {ext.description && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{ext.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Installed {new Date(inst.installed_at).toLocaleDateString()}
                        </span>
                        {ext.provider_name && (
                          <span>by {ext.provider_name}</span>
                        )}
                        <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px]">
                          {ext.category}
                        </Badge>
                      </div>
                      {/* Config summary */}
                      {inst.config && Object.keys(inst.config).length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-400">
                          <Settings className="w-3 h-3" />
                          <span>{Object.keys(inst.config).length} config value{Object.keys(inst.config).length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={isActive
                          ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }
                        onClick={() => handleToggle(inst)}
                        disabled={toggling === inst.id}
                      >
                        {toggling === inst.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isActive ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                        <span className="ml-1 text-xs">
                          {isActive ? 'Disable' : 'Enable'}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleUninstall(inst)}
                        disabled={uninstalling === inst.id}
                      >
                        {uninstalling === inst.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
