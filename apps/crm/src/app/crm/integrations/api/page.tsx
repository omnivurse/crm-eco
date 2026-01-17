'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Plus,
  ArrowLeft,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  last_used: string | null;
  created_at: string;
  expires_at: string | null;
}

const PERMISSIONS = [
  { value: 'read:records', label: 'Read Records' },
  { value: 'write:records', label: 'Create/Update Records' },
  { value: 'delete:records', label: 'Delete Records' },
  { value: 'read:contacts', label: 'Read Contacts' },
  { value: 'write:contacts', label: 'Create/Update Contacts' },
  { value: 'read:deals', label: 'Read Deals' },
  { value: 'write:deals', label: 'Create/Update Deals' },
  { value: 'read:tasks', label: 'Read Tasks' },
  { value: 'write:tasks', label: 'Create/Update Tasks' },
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
    expires: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('crm_api_keys');
    if (saved) {
      setApiKeys(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const saveKeys = (newKeys: ApiKey[]) => {
    setApiKeys(newKeys);
    localStorage.setItem('crm_api_keys', JSON.stringify(newKeys));
  };

  const generateKey = () => {
    return 'crm_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleCreate = () => {
    if (!formData.name || formData.permissions.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    const key = generateKey();
    const newApiKey: ApiKey = {
      id: Date.now().toString(),
      name: formData.name,
      key: key,
      permissions: formData.permissions,
      last_used: null,
      created_at: new Date().toISOString(),
      expires_at: formData.expires ? new Date(formData.expires).toISOString() : null,
    };

    saveKeys([...apiKeys, newApiKey]);
    setNewKeyVisible(key);
    setShowForm(false);
    setFormData({ name: '', permissions: [], expires: '' });
    toast.success('API key created');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this API key? Any applications using it will stop working.')) return;
    saveKeys(apiKeys.filter(k => k.id !== id));
    toast.success('API key deleted');
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/integrations"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 rounded-lg">
              <Key className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">API Keys</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage API access for integrations
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* New Key Alert */}
      {newKeyVisible && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Save your API key now
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This is the only time you'll be able to see this key. Copy it now and store it securely.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded font-mono break-all">
                  {newKeyVisible}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyKey(newKeyVisible)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setNewKeyVisible(null)}
              >
                I've saved my key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Create API Key
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Key Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Integration"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Permissions
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {PERMISSIONS.map(perm => (
                    <label key={perm.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, permissions: [...formData.permissions, perm.value] });
                          } else {
                            setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm.value) });
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-600 text-teal-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expiration (optional)
                </label>
                <Input
                  type="date"
                  value={formData.expires}
                  onChange={(e) => setFormData({ ...formData, expires: e.target.value })}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} className="bg-teal-600 hover:bg-teal-700 text-white">
                  Create Key
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <Key className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No API keys yet
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create an API key to connect external services
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create First Key
            </Button>
          </div>
        ) : (
          apiKeys.map(apiKey => (
            <div
              key={apiKey.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{apiKey.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                      {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyKey(apiKey.key)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(apiKey.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {apiKey.permissions.map(perm => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                  >
                    {perm}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Created {new Date(apiKey.created_at).toLocaleDateString()}
                </div>
                {apiKey.expires_at && (
                  <div>
                    Expires {new Date(apiKey.expires_at).toLocaleDateString()}
                  </div>
                )}
                {apiKey.last_used && (
                  <div>
                    Last used {new Date(apiKey.last_used).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
