'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Code2,
  Loader2,
  RefreshCw,
  Plus,
  Key,
  Webhook,
  ScrollText,
  ArrowLeft,
  Search,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import { Input } from '@crm-eco/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@crm-eco/ui/components/dialog';
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

interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  scopes: string[];
  allowed_ips: string[];
  allowed_origins: string[];
  rate_limit_rpm: number;
  environment: string;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface WebhookEntry {
  id: string;
  name: string;
  description: string | null;
  url: string;
  events: string[];
  auth_type: string;
  status: string;
  consecutive_failures: number;
  secret_masked: string | null;
  has_auth: boolean;
  timeout_ms: number;
  max_retries: number;
  created_at: string;
}

interface ApiLog {
  id: string;
  api_key_id: string | null;
  method: string;
  path: string;
  response_status: number;
  latency_ms: number;
  request_body_size: number | null;
  response_body_size: number | null;
  ip_address: string | null;
  user_agent: string | null;
  rate_limited: boolean;
  error_message: string | null;
  created_at: string;
}

/* ---------- constants ---------- */

const API_SCOPES = [
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

const WEBHOOK_EVENTS = [
  'record.created', 'record.updated', 'record.deleted', 'record.stage_changed',
  'contact.created', 'contact.updated', 'contact.deleted',
  'deal.created', 'deal.updated', 'deal.won', 'deal.lost',
  'task.created', 'task.completed',
  'note.created',
  'import.completed', 'export.completed',
  'pipeline.stage_changed',
  'signal.fired', 'signal.resolved',
  'extension.installed', 'extension.uninstalled',
  'api_key.created', 'api_key.revoked',
] as const;

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  disabled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ENV_COLORS: Record<string, string> = {
  production: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  staging: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  development: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  test: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

/* ---------- component ---------- */

export default function DeveloperHubPage() {
  const [activeTab, setActiveTab] = useState<'api-keys' | 'webhooks' | 'logs'>('api-keys');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    description: '',
    scopes: ['crm.read'] as string[],
    environment: 'production' as string,
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  // Logs state
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logMethodFilter, setLogMethodFilter] = useState<string>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');

  /* ---------- fetch API keys ---------- */

  const fetchApiKeys = useCallback(async () => {
    try {
      setKeysLoading(true);
      const res = await fetch('/api/crm/developer/api-keys');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setApiKeys(json.api_keys || []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setKeysLoading(false);
    }
  }, []);

  /* ---------- fetch webhooks ---------- */

  const fetchWebhooks = useCallback(async () => {
    try {
      setWebhooksLoading(true);
      const res = await fetch('/api/crm/developer/webhooks');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setWebhooks(json.webhooks || []);
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  /* ---------- fetch logs ---------- */

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams();
      if (logMethodFilter !== 'all') params.set('method', logMethodFilter);
      if (logStatusFilter === 'errors') params.set('status_gte', '400');
      if (logStatusFilter === 'success') params.set('status_lte', '399');
      const res = await fetch(`/api/crm/developer/logs?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLogs(json.logs || []);
      setLogsTotal(json.total || 0);
    } catch {
      toast.error('Failed to load API logs');
    } finally {
      setLogsLoading(false);
    }
  }, [logMethodFilter, logStatusFilter]);

  useEffect(() => { fetchApiKeys(); }, [fetchApiKeys]);
  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* ---------- create API key ---------- */

  async function handleCreateKey() {
    if (!newKey.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (newKey.scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    try {
      setCreatingKey(true);
      const res = await fetch('/api/crm/developer/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKey),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to create API key');
        return;
      }
      const json = await res.json();
      setNewKeyResult(json.api_key?.key || null);
      setShowCreateKey(false);
      setShowNewKey(true);
      setNewKey({ name: '', description: '', scopes: ['crm.read'], environment: 'production' });
      fetchApiKeys();
      toast.success('API key created');
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  }

  /* ---------- revoke API key ---------- */

  async function revokeKey(key: ApiKey) {
    if (!confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) return;
    try {
      setRevokingId(key.id);
      const res = await fetch(`/api/crm/developer/api-keys?id=${key.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setApiKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, status: 'revoked', revoked_at: new Date().toISOString() } : k))
      );
      toast.success('API key revoked');
    } catch {
      toast.error('Failed to revoke API key');
    } finally {
      setRevokingId(null);
    }
  }

  /* ---------- create webhook ---------- */

  async function handleCreateWebhook() {
    if (!newWebhook.name.trim() || !newWebhook.url.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    if (newWebhook.events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    try {
      setCreatingWebhook(true);
      const res = await fetch('/api/crm/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(typeof err.error === 'string' ? err.error : 'Failed to create webhook');
        return;
      }
      toast.success('Webhook created');
      setShowCreateWebhook(false);
      setNewWebhook({ name: '', url: '', events: [] });
      fetchWebhooks();
    } catch {
      toast.error('Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  }

  /* ---------- delete webhook ---------- */

  async function deleteWebhook(wh: WebhookEntry) {
    if (!confirm(`Delete webhook "${wh.name}"? This cannot be undone.`)) return;
    try {
      setDeletingWebhookId(wh.id);
      const res = await fetch(`/api/crm/developer/webhooks?id=${wh.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setWebhooks((prev) => prev.filter((w) => w.id !== wh.id));
      toast.success('Webhook deleted');
    } catch {
      toast.error('Failed to delete webhook');
    } finally {
      setDeletingWebhookId(null);
    }
  }

  /* ---------- scope toggle ---------- */

  function toggleScope(scope: string) {
    setNewKey((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  }

  /* ---------- event toggle ---------- */

  function toggleEvent(event: string) {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  /* ---------- copy to clipboard ---------- */

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  /* ---------- status code color ---------- */

  function statusColor(code: number) {
    if (code < 300) return 'text-emerald-600 dark:text-emerald-400';
    if (code < 400) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
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
            <Code2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Developer Hub</h1>
            <p className="text-slate-600 dark:text-slate-400">API keys, outbound webhooks, and request logs</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('api-keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'api-keys'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" /> API Keys
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Webhook className="w-4 h-4" /> Webhooks
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'logs'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <ScrollText className="w-4 h-4" /> Logs
        </button>
      </div>

      {/* ========== API KEYS TAB ========== */}
      {activeTab === 'api-keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {apiKeys.filter((k) => k.status === 'active').length} active key{apiKeys.filter((k) => k.status === 'active').length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => { setKeysLoading(true); fetchApiKeys(); }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => setShowCreateKey(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" /> New API Key
              </Button>
            </div>
          </div>

          {keysLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Key className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No API keys created yet</p>
              <Button onClick={() => setShowCreateKey(true)} variant="outline" className="mt-4">Create API Key</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <Card key={key.id} className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{key.name}</h3>
                          <Badge variant="secondary" className={STATUS_COLORS[key.status] || STATUS_COLORS.active}>
                            {key.status}
                          </Badge>
                          <Badge variant="secondary" className={ENV_COLORS[key.environment] || ENV_COLORS.development}>
                            {key.environment}
                          </Badge>
                        </div>
                        {key.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{key.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {key.key_prefix}{'*'.repeat(20)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(key.key_prefix)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {key.scopes.slice(0, 5).map((scope) => (
                            <span key={scope} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {scope}
                            </span>
                          ))}
                          {key.scopes.length > 5 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              +{key.scopes.length - 5} more
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>
                            Created {new Date(key.created_at).toLocaleDateString()}
                          </span>
                          {key.last_used_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last used {new Date(key.last_used_at).toLocaleDateString()}
                            </span>
                          )}
                          {key.expires_at && (
                            <span>Expires {new Date(key.expires_at).toLocaleDateString()}</span>
                          )}
                          {key.revoked_at && (
                            <span className="text-red-500">Revoked {new Date(key.revoked_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {key.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeKey(key)}
                          disabled={revokingId === key.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 shrink-0"
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-1" />
                          )}
                          Revoke
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

      {/* ========== WEBHOOKS TAB ========== */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {webhooks.filter((w) => w.status === 'active').length} active webhook{webhooks.filter((w) => w.status === 'active').length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => { setWebhooksLoading(true); fetchWebhooks(); }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => setShowCreateWebhook(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" /> New Webhook
              </Button>
            </div>
          </div>

          {webhooksLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Webhook className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured yet</p>
              <Button onClick={() => setShowCreateWebhook(true)} variant="outline" className="mt-4">Create Webhook</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <Card key={wh.id} className="glass-card border-slate-200 dark:border-white/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{wh.name}</h3>
                          <Badge variant="secondary" className={STATUS_COLORS[wh.status] || STATUS_COLORS.active}>
                            {wh.status}
                          </Badge>
                          {wh.consecutive_failures > 0 && (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {wh.consecutive_failures} failure{wh.consecutive_failures !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-md">
                            {wh.url}
                          </code>
                          <button
                            onClick={() => copyToClipboard(wh.url)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {wh.events.slice(0, 4).map((event) => (
                            <span key={event} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                              {event}
                            </span>
                          ))}
                          {wh.events.length > 4 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              +{wh.events.length - 4} more
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>Auth: {wh.auth_type || 'hmac_sha256'}</span>
                          <span>Timeout: {wh.timeout_ms}ms</span>
                          <span>Retries: {wh.max_retries}</span>
                          <span>Created {new Date(wh.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteWebhook(wh)}
                        disabled={deletingWebhookId === wh.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 shrink-0"
                      >
                        {deletingWebhookId === wh.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== LOGS TAB ========== */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Select value={logMethodFilter} onValueChange={setLogMethodFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success (2xx/3xx)</SelectItem>
                  <SelectItem value="errors">Errors (4xx/5xx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{logsTotal} total</span>
              <Button onClick={() => { setLogsLoading(true); fetchLogs(); }} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </div>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <ScrollText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No API logs found</p>
              <Button onClick={() => { setLogsLoading(true); fetchLogs(); }} variant="outline" className="mt-4">Try Again</Button>
            </div>
          ) : (
            <Card className="glass-card border-slate-200 dark:border-white/10">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Method</th>
                        <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Path</th>
                        <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                        <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Latency</th>
                        <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[log.method] || METHOD_COLORS.GET}`}>
                              {log.method}
                            </span>
                          </td>
                          <td className="p-3">
                            <code className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs block">
                              {log.path}
                            </code>
                            {log.rate_limited && (
                              <Badge variant="secondary" className="mt-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                                Rate Limited
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`font-mono font-bold ${statusColor(log.response_status)}`}>
                              {log.response_status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`text-sm ${
                              log.latency_ms > 1000
                                ? 'text-red-600 dark:text-red-400'
                                : log.latency_ms > 500
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}>
                              {log.latency_ms}ms
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-xs whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== CREATE API KEY DIALOG ========== */}
      <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Generate a new API key for programmatic access. The full key will only be shown once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <Input
                placeholder="e.g. Production Backend"
                value={newKey.name}
                onChange={(e) => setNewKey((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <Input
                placeholder="Optional description"
                value={newKey.description}
                onChange={(e) => setNewKey((p) => ({ ...p, description: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment</label>
              <Select value={newKey.environment} onValueChange={(v) => setNewKey((p) => ({ ...p, environment: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => (
                    <SelectItem key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Scopes</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1">
                {API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={newKey.scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKey(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} disabled={creatingKey}>
              {creatingKey && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== NEW KEY REVEAL DIALOG ========== */}
      <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You will not be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-slate-900 dark:text-white break-all flex-1">
                {newKeyResult || ''}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(newKeyResult || '')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Store this key securely. It will not be displayed again after closing this dialog.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowNewKey(false); setNewKeyResult(null); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== CREATE WEBHOOK DIALOG ========== */}
      <Dialog open={showCreateWebhook} onOpenChange={setShowCreateWebhook}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>Subscribe to CRM events and receive real-time HTTP notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
              <Input
                placeholder="e.g. Slack Notifications"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook((p) => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">URL</label>
              <Input
                placeholder="https://example.com/webhook"
                type="url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook((p) => ({ ...p, url: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Events ({newWebhook.events.length} selected)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-700 rounded-lg">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded border-slate-300 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300 text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateWebhook(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} disabled={creatingWebhook}>
              {creatingWebhook && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
