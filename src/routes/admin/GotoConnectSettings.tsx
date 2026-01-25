import { useState, useEffect } from 'react';
import { Phone, Save, Check, AlertCircle } from 'lucide-react';

interface GotoSettings {
  webhook_url?: string;
  business_hours_start?: string;
  business_hours_end?: string;
  max_queue_wait_seconds?: number;
  voicemail_enabled?: boolean;
  auto_ticket_creation?: boolean;
  call_recording_enabled?: boolean;
  recording_retention_days?: number;
}

export default function GotoConnectSettings() {
  const [settings, setSettings] = useState<GotoSettings>({});
  const [accessToken, setAccessToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/goto-connect/settings');
      const data = await response.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload: any = { ...settings };
      if (accessToken) {
        payload.access_token = accessToken;
      }

      const response = await fetch('/api/goto-connect/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSettings(data.settings);
      setAccessToken('');
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <Phone className="w-6 h-6" />
          GoTo Connect Settings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Configure your GoTo Connect call center integration
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* API Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">
            API Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Personal Access Token
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter new token to update"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Leave blank to keep existing token. Get your token from GoTo Connect dashboard.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Webhook URL
              </label>
              <input
                type="text"
                value={settings.webhook_url || ''}
                onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                placeholder="https://your-domain.com/api/goto-connect/webhooks"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                The URL where GoTo Connect will send call event notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">
            Business Hours
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={settings.business_hours_start || '09:00'}
                onChange={(e) => setSettings({ ...settings, business_hours_start: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={settings.business_hours_end || '17:00'}
                onChange={(e) => setSettings({ ...settings, business_hours_end: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Call Handling */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">
            Call Handling
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Max Queue Wait Time (seconds)
              </label>
              <input
                type="number"
                value={settings.max_queue_wait_seconds || 300}
                onChange={(e) => setSettings({ ...settings, max_queue_wait_seconds: parseInt(e.target.value) })}
                min="60"
                max="600"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Maximum time a call can wait in queue before overflow action.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="voicemail"
                checked={settings.voicemail_enabled ?? true}
                onChange={(e) => setSettings({ ...settings, voicemail_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="voicemail" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enable voicemail for missed calls
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_ticket"
                checked={settings.auto_ticket_creation ?? true}
                onChange={(e) => setSettings({ ...settings, auto_ticket_creation: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto_ticket" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Automatically create tickets for incoming calls
              </label>
            </div>
          </div>
        </div>

        {/* Recording Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">
            Call Recording
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="recording"
                checked={settings.call_recording_enabled ?? true}
                onChange={(e) => setSettings({ ...settings, call_recording_enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="recording" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Record all calls automatically
              </label>
            </div>

            {settings.call_recording_enabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Recording Retention (days)
                </label>
                <input
                  type="number"
                  value={settings.recording_retention_days || 90}
                  onChange={(e) => setSettings({ ...settings, recording_retention_days: parseInt(e.target.value) })}
                  min="1"
                  max="365"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Recordings will be automatically deleted after this many days.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-900 dark:text-green-100">Settings saved successfully!</p>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
