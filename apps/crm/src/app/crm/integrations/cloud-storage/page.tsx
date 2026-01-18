'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Cloud,
  HardDrive,
  FolderOpen,
  Check,
  X,
  Settings,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Switch } from '@crm-eco/ui/components/switch';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';

interface CloudProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  status: 'connected' | 'disconnected' | 'coming_soon';
  lastSync?: string;
  storageUsed?: string;
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Connect your Google Drive to sync and access documents',
    icon: (
      <svg viewBox="0 0 87.3 78" className="w-6 h-6">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
    ),
    color: 'blue',
    features: ['Two-way sync', 'Folder mapping', 'Auto-backup'],
    status: 'disconnected',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Sync files with your Dropbox account',
    icon: (
      <svg viewBox="0 0 43 40" className="w-6 h-6" fill="#0061FF">
        <path d="M12.5 0L0 8.1l8.6 6.9 12.5-7.8L12.5 0zM0 22l12.5 8.1 8.6-7.2-12.5-7.8L0 22zm21.1 0.9l8.6 7.2L42.2 22l-8.6-6.9-12.5 7.8zm21.1-14.8L29.7 0l-8.6 7.2 12.5 7.8 8.6-6.9zM21.2 24.6l-8.6 7.2-3.9-2.5v2.8l12.5 7.5 12.5-7.5v-2.8l-3.9 2.5-8.6-7.2z"/>
      </svg>
    ),
    color: 'blue',
    features: ['Smart sync', 'Team folders', 'Version history'],
    status: 'coming_soon',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Connect Microsoft OneDrive for Business',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0078D4">
        <path d="M10.5 18.5h8.25a3.75 3.75 0 001.455-7.208A5.251 5.251 0 0010.5 9.75a5.21 5.21 0 00-2.756.79A4.501 4.501 0 003 15a4.5 4.5 0 004.5 4.5h3v-1z"/>
      </svg>
    ),
    color: 'sky',
    features: ['Office 365 integration', 'SharePoint sync', 'Real-time collaboration'],
    status: 'coming_soon',
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Enterprise-grade cloud storage',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0061D5">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.08 5.1 7.63 12 4.18zM4 8.82l7 3.5v6.86l-7-3.5V8.82zm9 10.36v-6.86l7-3.5v6.86l-7 3.5z"/>
      </svg>
    ),
    color: 'blue',
    features: ['Advanced security', 'Compliance tools', 'Workflow automation'],
    status: 'coming_soon',
  },
];

export default function CloudStoragePage() {
  const [providers, setProviders] = useState<CloudProvider[]>(CLOUD_PROVIDERS);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Check for existing cloud storage connections
      const { data: connections } = await supabase
        .from('integration_connections')
        .select('*')
        .eq('org_id', profile.organization_id)
        .in('provider', ['google', 'dropbox', 'onedrive', 'box']);

      if (connections) {
        setProviders((prev) =>
          prev.map((p) => {
            const conn = connections.find(
              (c) =>
                (c.provider === 'google' && p.id === 'google_drive') ||
                c.provider === p.id
            );
            if (conn && conn.status === 'connected') {
              return {
                ...p,
                status: 'connected' as const,
                lastSync: conn.last_sync_at,
              };
            }
            return p;
          })
        );
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleConnect = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || provider.status === 'coming_soon') {
      toast.info('This integration is coming soon!');
      return;
    }

    setConnecting(providerId);

    try {
      // In production, this would initiate OAuth flow
      if (providerId === 'google_drive') {
        // Simulate OAuth redirect
        toast.info('Redirecting to Google for authentication...');

        // For now, show a message about OAuth setup
        setTimeout(() => {
          toast.error(
            'Google Drive OAuth requires setup in Google Cloud Console. Contact your admin.'
          );
          setConnecting(null);
        }, 2000);
      } else {
        toast.info(`${provider.name} integration coming soon!`);
        setConnecting(null);
      }
    } catch (error) {
      toast.error('Failed to connect');
      setConnecting(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm('Are you sure you want to disconnect this storage provider?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const providerKey = providerId === 'google_drive' ? 'google' : providerId;

      await supabase
        .from('integration_connections')
        .update({ status: 'disconnected' })
        .eq('org_id', profile.organization_id)
        .eq('provider', providerKey);

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, status: 'disconnected' as const } : p
        )
      );

      toast.success('Disconnected successfully');
    } catch (error) {
      toast.error('Failed to disconnect');
    }
  };

  const getStatusBadge = (status: CloudProvider['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
            <Check className="w-3 h-3" />
            Connected
          </span>
        );
      case 'disconnected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Not Connected
          </span>
        );
      case 'coming_soon':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
            Coming Soon
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/crm/integrations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-xl">
            <Cloud className="w-6 h-6 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Cloud Storage
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Connect cloud storage providers to sync and manage documents
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="glass-card border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-sky-600 dark:text-sky-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-sky-900 dark:text-sky-100">
              Local Storage Active
            </h3>
            <p className="text-sm text-sky-700 dark:text-sky-300 mt-1">
              Documents are currently stored in your CRM's built-in storage.
              Connect a cloud provider for additional backup and sync capabilities.
            </p>
          </div>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`glass-card border rounded-xl p-6 transition-all ${
              provider.status === 'coming_soon'
                ? 'border-slate-200 dark:border-slate-700 opacity-75'
                : 'border-slate-200 dark:border-slate-700 hover:border-teal-500/50'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {provider.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {provider.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {provider.description}
                  </p>
                </div>
              </div>
              {getStatusBadge(provider.status)}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {provider.features.map((feature) => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>

            {provider.status === 'connected' && provider.lastSync && (
              <p className="text-xs text-slate-500 mb-4">
                Last synced: {new Date(provider.lastSync).toLocaleString()}
              </p>
            )}

            <div className="flex items-center gap-2">
              {provider.status === 'connected' ? (
                <>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(provider.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleConnect(provider.id)}
                  disabled={
                    provider.status === 'coming_soon' ||
                    connecting === provider.id
                  }
                  className={
                    provider.status === 'coming_soon'
                      ? ''
                      : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                  }
                  size="sm"
                >
                  {connecting === provider.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Help Section */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
          Need Help?
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Cloud storage integrations require OAuth setup. Contact your administrator
          to configure API credentials for each provider.
        </p>
        <Link href="/crm/integrations">
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            View All Integrations
          </Button>
        </Link>
      </div>
    </div>
  );
}
