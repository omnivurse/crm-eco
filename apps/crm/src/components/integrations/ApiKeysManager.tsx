'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
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
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  status: 'active' | 'disabled' | 'revoked';
  scopes: string[];
  environment: string;
  rate_limit_rpm: number;
  allowed_ips: string[];
  allowed_origins: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const SCOPE_OPTIONS = [
  'crm.read', 'crm.write', 'crm.admin',
  'records.read', 'records.write', 'records.delete',
  'contacts.read', 'contacts.write',
  'pipelines.read', 'pipelines.write',
  'automations.read', 'automations.write',
  'analytics.read',
  'import.execute', 'export.execute',
  'webhooks.manage',
  'extensions.read', 'extensions.manage',
] as const;

const ENVIRONMENTS = ['production', 'staging', 'development', 'test'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showRevealedDialog, setShowRevealedDialog] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newEnvironment, setNewEnvironment] = useState<string>('production');
  const [newScopes, setNewScopes] = useState<string[]>(['crm.read']);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/developer/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.api_keys || []);
      } else {
        toast.error('Failed to load API keys');
      }
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Name is required'); return; }
    if (newScopes.length === 0) { toast.error('Select at least one scope'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/crm/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          environment: newEnvironment,
          scopes: newScopes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.api_key.key);
        setShowCreate(false);
        setShowRevealedDialog(true);
        setNewName('');
        setNewDescription('');
        setNewEnvironment('production');
        setNewScopes(['crm.read']);
        toast.success('API key created');
        fetchKeys();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to create API key');
      }
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/crm/developer/api-keys?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('API key revoked');
        fetchKeys();
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch {
      toast.error('Failed to revoke API key');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  function toggleScope(scope: string) {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    disabled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const envColor: Record<string, string> = {
    production: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    staging: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    development: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    test: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  };

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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage API keys for programmatic access to your CRM</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setLoading(true); fetchKeys(); }} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Key
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Keys', value: keys.length, icon: Key, color: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
          { label: 'Active', value: keys.filter((k) => k.status === 'active').length, icon: ShieldCheck, color: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Revoked', value: keys.filter((k) => k.status === 'revoked').length, icon: AlertTriangle, color: 'bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
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

      {/* Keys list */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-500" /> Your API Keys
          </CardTitle>
          <CardDescription>Keys are hashed and cannot be revealed after creation</CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No API keys yet</p>
              <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" /> Create your first key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white">{k.name}</span>
                      <Badge className={statusColor[k.status] || ''}>{k.status}</Badge>
                      <Badge className={envColor[k.environment] || ''}>{k.environment}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 font-mono">{k.key_prefix}{'...'}</p>
                    {k.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{k.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {k.scopes.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {s}
                        </span>
                      ))}
                      {k.scopes.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          +{k.scopes.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(k.created_at).toLocaleDateString()}</span>
                    </div>
                    {k.last_used_at && (
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>Used {new Date(k.last_used_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {k.status !== 'revoked' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleRevoke(k.id, k.name)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              The full key will only be shown once after creation. Store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <Input
                placeholder="e.g. Production Backend"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (optional)</label>
              <Input
                placeholder="What this key is used for"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Environment</label>
              <Select value={newEnvironment} onValueChange={setNewEnvironment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env} value={env}>
                      {env.charAt(0).toUpperCase() + env.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Scopes ({newScopes.length} selected)
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded border border-slate-200 dark:border-white/10 p-2">
                {SCOPE_OPTIONS.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1.5 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={newScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revealed key dialog (shown once after creation) */}
      <Dialog open={showRevealedDialog} onOpenChange={setShowRevealedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" /> API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 font-mono text-sm break-all">
              <span className="flex-1 select-all">{revealedKey}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revealedKey && copyToClipboard(revealedKey)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Store this key in a secure location. You will not be able to see it again.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowRevealedDialog(false); setRevealedKey(null); }}>
              I have saved the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
