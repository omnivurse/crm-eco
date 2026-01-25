import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Check, X, RefreshCw, Upload, Download, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';

interface OneDriveIntegration {
  id: string;
  provider: string;
  is_active: boolean;
  last_sync_at: string | null;
  metadata: Record<string, any>;
}

interface PendingFile {
  file_id: string;
  filename: string;
  byte_size: number;
  mime_type: string;
}

export function OneDriveSettings() {
  const { user } = useAuth();
  const [integration, setIntegration] = useState<OneDriveIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadIntegration();
      loadPendingFiles();
    }
  }, [user]);

  async function loadIntegration() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user!.id)
        .eq('provider', 'onedrive')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIntegration(data);
    } catch (err) {
      console.error('Error loading OneDrive integration:', err);
      setError('Failed to load OneDrive connection status');
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingFiles() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/onedrive-sync/sync-pending`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingFiles(data.pending_files || []);
      }
    } catch (err) {
      console.error('Error loading pending files:', err);
    }
  }

  async function connectOneDrive() {
    try {
      setConnecting(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/onedrive-oauth/authorize`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();

      const authWindow = window.open(
        data.authUrl,
        'OneDrive Authorization',
        'width=600,height=700'
      );

      const checkWindow = setInterval(() => {
        try {
          if (authWindow?.closed) {
            clearInterval(checkWindow);
            setConnecting(false);
            loadIntegration();
            setSuccess('OneDrive connected successfully!');
          }
        } catch (e) {
          console.error('Error checking window:', e);
        }
      }, 1000);

    } catch (err) {
      console.error('Error connecting OneDrive:', err);
      setError('Failed to connect OneDrive. Please try again.');
      setConnecting(false);
    }
  }

  async function disconnectOneDrive() {
    if (!confirm('Are you sure you want to disconnect OneDrive? This will not delete your files.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/onedrive-oauth/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect OneDrive');
      }

      setIntegration(null);
      setSuccess('OneDrive disconnected successfully');
    } catch (err) {
      console.error('Error disconnecting OneDrive:', err);
      setError('Failed to disconnect OneDrive. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function syncPendingFiles() {
    try {
      setSyncing(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      let successCount = 0;
      let errorCount = 0;

      for (const file of pendingFiles) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/onedrive-sync/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileId: file.file_id,
              fileName: file.filename,
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Error syncing file ${file.filename}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`Successfully synced ${successCount} file(s) to OneDrive`);
      }
      if (errorCount > 0) {
        setError(`Failed to sync ${errorCount} file(s)`);
      }

      loadPendingFiles();
    } catch (err) {
      console.error('Error syncing files:', err);
      setError('Failed to sync files. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Microsoft OneDrive</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sync your files with OneDrive automatically
              </p>
            </div>
          </div>

          {integration?.is_active ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
              <Check size={16} />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-lg">
              <X size={16} />
              <span className="text-sm font-medium">Not Connected</span>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3"
            >
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-900 dark:text-green-200">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {!integration?.is_active ? (
          <div className="space-y-4">
            <p className="text-neutral-600 dark:text-neutral-400">
              Connect your Microsoft OneDrive account to automatically sync files between your workspace and OneDrive.
            </p>
            <button
              onClick={connectOneDrive}
              disabled={connecting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-400 text-white rounded-xl transition-all font-medium shadow-lg disabled:cursor-not-allowed"
            >
              {connecting ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="h-5 w-5" />
                  Connect OneDrive
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Status</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">Active</span>
                </div>
                {integration.last_sync_at && (
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Pending Files</span>
                  <span className="text-sm font-bold text-primary-800 dark:text-primary-500">{pendingFiles.length}</span>
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Files waiting to be synced
                </div>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Pending Sync</h4>
                  <button
                    onClick={syncPendingFiles}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-800 hover:bg-primary-900 disabled:bg-neutral-400 text-white rounded-lg transition-colors text-sm font-medium disabled:cursor-not-allowed"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Sync All
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingFiles.map((file) => (
                    <div
                      key={file.file_id}
                      className="p-3 bg-white dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{file.filename}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {formatBytes(file.byte_size)} • {file.mime_type}
                        </p>
                      </div>
                      <Upload className="h-4 w-4 text-neutral-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={disconnectOneDrive}
                className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white rounded-lg transition-colors text-sm font-medium"
              >
                Disconnect
              </button>
              <a
                href="https://onedrive.live.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-600 rounded-lg transition-colors text-sm font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                Open OneDrive
              </a>
            </div>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">How It Works</h4>
        <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-800 dark:text-primary-500 font-bold text-xs">
              1
            </div>
            <p>Connect your OneDrive account using secure OAuth authentication</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-800 dark:text-primary-500 font-bold text-xs">
              2
            </div>
            <p>Files you upload will be marked for sync automatically</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-800 dark:text-primary-500 font-bold text-xs">
              3
            </div>
            <p>Click "Sync All" to upload pending files to your OneDrive</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-800 dark:text-primary-500 font-bold text-xs">
              4
            </div>
            <p>Access your files from anywhere using OneDrive</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
