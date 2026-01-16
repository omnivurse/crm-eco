'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Key,
  Plug,
  Unplug,
} from 'lucide-react';
import { 
  PROVIDER_CONFIGS, 
  type IntegrationConnection, 
  type IntegrationProvider,
  type ConnectionType,
} from '@/lib/integrations/types';

// ============================================================================
// Types
// ============================================================================

interface IntegrationCategoryPageProps {
  connectionType: ConnectionType;
  title: string;
  description: string;
  icon: ReactNode;
  providers: IntegrationProvider[];
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: ReactNode }> = {
    connected: { 
      bg: 'bg-green-100 dark:bg-green-500/20', 
      text: 'text-green-700 dark:text-green-400',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    disconnected: { 
      bg: 'bg-slate-100 dark:bg-slate-700/50', 
      text: 'text-slate-600 dark:text-slate-400',
      icon: <Unplug className="w-3.5 h-3.5" />,
    },
    error: { 
      bg: 'bg-red-100 dark:bg-red-500/20', 
      text: 'text-red-700 dark:text-red-400',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    pending: { 
      bg: 'bg-amber-100 dark:bg-amber-500/20', 
      text: 'text-amber-700 dark:text-amber-400',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    expired: { 
      bg: 'bg-orange-100 dark:bg-orange-500/20', 
      text: 'text-orange-700 dark:text-orange-400',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
  };
  
  const { bg, text, icon } = config[status] || config.disconnected;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}

function ProviderCard({ 
  provider, 
  connection,
  onConnect,
  onDisconnect,
  onTest,
  onDelete,
}: { 
  provider: IntegrationProvider;
  connection?: IntegrationConnection;
  onConnect: (provider: IntegrationProvider) => void;
  onDisconnect: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = PROVIDER_CONFIGS[provider];
  const [testing, setTesting] = useState(false);
  
  const handleTest = async () => {
    if (!connection) return;
    setTesting(true);
    await onTest(connection.id);
    setTesting(false);
  };

  return (
    <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg bg-${config.color}-500/10`}>
            <Plug className={`w-5 h-5 text-${config.color}-600 dark:text-${config.color}-400`} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{config.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
          </div>
        </div>
        {connection && <StatusBadge status={connection.status} />}
      </div>
      
      {connection ? (
        <>
          {/* Connected State */}
          <div className="space-y-3 mb-4">
            {connection.external_account_email && (
              <div className="text-sm">
                <span className="text-slate-500 dark:text-slate-400">Account:</span>{' '}
                <span className="text-slate-900 dark:text-white">{connection.external_account_email}</span>
              </div>
            )}
            {connection.last_sync_at && (
              <div className="text-sm">
                <span className="text-slate-500 dark:text-slate-400">Last Sync:</span>{' '}
                <span className="text-slate-900 dark:text-white">
                  {new Date(connection.last_sync_at).toLocaleString()}
                </span>
              </div>
            )}
            {connection.health_status !== 'healthy' && connection.health_status !== 'unknown' && (
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
                <div className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Health: {connection.health_status}
                </div>
                {connection.last_error_message && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {connection.last_error_message}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              Test
            </button>
            <button
              onClick={() => onDisconnect(connection.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors"
            >
              <Unplug className="w-3.5 h-3.5" />
              Disconnect
            </button>
            <button
              onClick={() => onDelete(connection.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Not Connected State */}
          <div className="mb-4">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Auth Type: <span className="capitalize">{config.authType.replace('_', ' ')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {config.features.slice(0, 3).map((feature) => (
                <span
                  key={feature}
                  className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                >
                  {feature.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onConnect(provider)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Connect
            </button>
            {config.docsUrl && (
              <a
                href={config.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Docs
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectModal({
  provider,
  onClose,
  onSubmit,
}: {
  provider: IntegrationProvider;
  onClose: () => void;
  onSubmit: (data: { api_key?: string; api_secret?: string }) => void;
}) {
  const config = PROVIDER_CONFIGS[provider];
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ api_key: apiKey, api_secret: apiSecret || undefined });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-teal-500/10 rounded-lg">
            <Key className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Connect {config.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Enter your API credentials</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          
          {config.authType === 'api_key' && config.requiredSettings?.includes('auth_token') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Secret / Auth Token
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter API secret (optional)"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey || loading}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function IntegrationCategoryPage({
  connectionType,
  title,
  description,
  icon,
  providers,
}: IntegrationCategoryPageProps) {
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/integrations?connection_type=${connectionType}`);
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  }, [connectionType]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleConnect = async (data: { api_key?: string; api_secret?: string }) => {
    if (!connectingProvider) return;
    
    try {
      const config = PROVIDER_CONFIGS[connectingProvider];
      
      // First create the connection
      const createResponse = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: connectingProvider,
          connection_type: connectionType,
          name: config.name,
          description: config.description,
        }),
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        alert(errorData.error || 'Failed to create connection');
        return;
      }
      
      const connection = await createResponse.json();
      
      // Then connect with credentials
      await fetch(`/api/integrations/${connection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          api_key: data.api_key,
          api_secret: data.api_secret,
        }),
      });
      
      setConnectingProvider(null);
      fetchConnections();
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect integration');
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    
    try {
      await fetch(`/api/integrations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      fetchConnections();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const response = await fetch(`/api/integrations/${id}/test`, {
        method: 'POST',
      });
      const result = await response.json();
      alert(result.success ? 'Connection is working!' : `Test failed: ${result.message}`);
      fetchConnections();
    } catch (error) {
      console.error('Failed to test:', error);
      alert('Failed to test connection');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this integration? This cannot be undone.')) return;
    
    try {
      await fetch(`/api/integrations/${id}`, {
        method: 'DELETE',
      });
      fetchConnections();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const getConnectionForProvider = (provider: IntegrationProvider) => {
    return connections.find(c => c.provider === provider);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/integrations"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
            </div>
          </div>
        </div>
        
        <Link
          href="/crm/integrations/logs"
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          View Logs
        </Link>
      </div>
      
      {/* Provider Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              connection={getConnectionForProvider(provider)}
              onConnect={setConnectingProvider}
              onDisconnect={handleDisconnect}
              onTest={handleTest}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      
      {/* Connect Modal */}
      {connectingProvider && (
        <ConnectModal
          provider={connectingProvider}
          onClose={() => setConnectingProvider(null)}
          onSubmit={handleConnect}
        />
      )}
    </div>
  );
}
