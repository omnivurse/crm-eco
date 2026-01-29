'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface SyncStatus {
  connected: boolean;
  last_sync: string | null;
  sync_in_progress: boolean;
  total_synced: number;
  errors: number;
}

interface SyncMapping {
  module: string;
  zoho_module: string;
  direction: 'bidirectional' | 'crm_to_zoho' | 'zoho_to_crm';
  enabled: boolean;
  last_sync: string | null;
  record_count: number;
}

export default function ZohoSyncPage() {
  const [status, setStatus] = useState<SyncStatus>({
    connected: false,
    last_sync: null,
    sync_in_progress: false,
    total_synced: 0,
    errors: 0,
  });

  const [mappings, setMappings] = useState<SyncMapping[]>([
    { module: 'Contacts', zoho_module: 'Contacts', direction: 'bidirectional', enabled: true, last_sync: null, record_count: 0 },
    { module: 'Deals', zoho_module: 'Deals', direction: 'bidirectional', enabled: true, last_sync: null, record_count: 0 },
    { module: 'Leads', zoho_module: 'Leads', direction: 'bidirectional', enabled: true, last_sync: null, record_count: 0 },
    { module: 'Accounts', zoho_module: 'Accounts', direction: 'bidirectional', enabled: false, last_sync: null, record_count: 0 },
  ]);

  const [showConnect, setShowConnect] = useState(false);
  const [credentials, setCredentials] = useState({
    client_id: '',
    client_secret: '',
    refresh_token: '',
  });

  const handleConnect = () => {
    if (!credentials.client_id || !credentials.client_secret) {
      toast.error('Please enter your Zoho credentials');
      return;
    }

    // Simulate connection
    setStatus({ ...status, connected: true });
    setShowConnect(false);
    toast.success('Connected to Zoho CRM');

    // Save to localStorage
    localStorage.setItem('zoho_connected', 'true');
  };

  const handleDisconnect = () => {
    if (!confirm('Disconnect from Zoho CRM? Sync will be paused.')) return;
    setStatus({ ...status, connected: false });
    localStorage.removeItem('zoho_connected');
    toast.success('Disconnected from Zoho');
  };

  const handleSync = async () => {
    setStatus({ ...status, sync_in_progress: true });
    toast.success('Sync started');

    // Simulate sync
    setTimeout(() => {
      setStatus({
        ...status,
        sync_in_progress: false,
        last_sync: new Date().toISOString(),
        total_synced: status.total_synced + 50,
      });
      setMappings(mappings.map(m => ({
        ...m,
        last_sync: m.enabled ? new Date().toISOString() : m.last_sync,
        record_count: m.enabled ? m.record_count + Math.floor(Math.random() * 20) : m.record_count,
      })));
      toast.success('Sync completed');
    }, 2000);
  };

  const toggleMapping = (module: string) => {
    setMappings(mappings.map(m =>
      m.module === module ? { ...m, enabled: !m.enabled } : m
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/integrations"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-lg">
              <Database className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Zoho CRM Sync</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Two-way sync with your Zoho CRM account
              </p>
            </div>
          </div>
        </div>

        {status.connected && (
          <Button
            onClick={handleSync}
            disabled={status.sync_in_progress}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {status.sync_in_progress ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>
            )}
          </Button>
        )}
      </div>

      {/* Connection Status */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${status.connected ? 'bg-green-500/10' : 'bg-slate-500/10'}`}>
              {status.connected ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {status.connected ? 'Connected to Zoho CRM' : 'Not Connected'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {status.connected
                  ? status.last_sync
                    ? `Last sync: ${new Date(status.last_sync).toLocaleString()}`
                    : 'Never synced'
                  : 'Connect your Zoho CRM account to enable sync'}
              </p>
            </div>
          </div>

          {status.connected ? (
            <Button variant="outline" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={() => setShowConnect(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
              Connect Zoho
            </Button>
          )}
        </div>

        {status.connected && (
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{status.total_synced}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Records Synced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {mappings.filter(m => m.enabled).length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Active Mappings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{status.errors}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Sync Errors</div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {showConnect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Connect to Zoho CRM
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                You'll need to create a self-client in Zoho API Console
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Client ID
                </label>
                <Input
                  value={credentials.client_id}
                  onChange={(e) => setCredentials({ ...credentials, client_id: e.target.value })}
                  placeholder="1000.xxx..."
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Client Secret
                </label>
                <Input
                  type="password"
                  value={credentials.client_secret}
                  onChange={(e) => setCredentials({ ...credentials, client_secret: e.target.value })}
                  placeholder="xxx..."
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowConnect(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConnect} className="bg-teal-600 hover:bg-teal-700 text-white">
                  Connect
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Mappings */}
      {status.connected && (
        <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Module Mappings</h3>
            <Button variant="outline" size="sm" onClick={() => toast.info('Field configuration coming soon')}>
              <Settings className="w-4 h-4 mr-2" />
              Configure Fields
            </Button>
          </div>

          <div className="space-y-3">
            {mappings.map(mapping => (
              <div
                key={mapping.module}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  mapping.enabled
                    ? 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => toggleMapping(mapping.module)}
                    className={`p-1.5 rounded ${mapping.enabled ? 'text-teal-600' : 'text-slate-400'}`}
                  >
                    {mapping.enabled ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {mapping.module}
                      <span className="mx-2 text-slate-400">→</span>
                      Zoho {mapping.zoho_module}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {mapping.direction === 'bidirectional' ? 'Two-way sync' :
                       mapping.direction === 'crm_to_zoho' ? 'CRM → Zoho' : 'Zoho → CRM'}
                    </div>
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="text-slate-900 dark:text-white font-medium">
                    {mapping.record_count} records
                  </div>
                  {mapping.last_sync && (
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(mapping.last_sync).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
