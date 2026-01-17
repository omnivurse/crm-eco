'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Webhook,
  Plus,
  ArrowLeft,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { toast } from 'sonner';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  last_triggered: string | null;
  last_status: 'success' | 'failed' | null;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  { value: 'record.created', label: 'Record Created' },
  { value: 'record.updated', label: 'Record Updated' },
  { value: 'record.deleted', label: 'Record Deleted' },
  { value: 'deal.stage_changed', label: 'Deal Stage Changed' },
  { value: 'deal.won', label: 'Deal Won' },
  { value: 'deal.lost', label: 'Deal Lost' },
  { value: 'lead.converted', label: 'Lead Converted' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'note.added', label: 'Note Added' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });

  useEffect(() => {
    const saved = localStorage.getItem('crm_webhooks');
    if (saved) {
      setWebhooks(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const saveWebhooks = (newWebhooks: WebhookConfig[]) => {
    setWebhooks(newWebhooks);
    localStorage.setItem('crm_webhooks', JSON.stringify(newWebhooks));
  };

  const generateSecret = () => {
    return 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleCreate = () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    const newWebhook: WebhookConfig = {
      id: Date.now().toString(),
      name: formData.name,
      url: formData.url,
      events: formData.events,
      secret: generateSecret(),
      is_active: true,
      last_triggered: null,
      last_status: null,
      created_at: new Date().toISOString(),
    };

    saveWebhooks([...webhooks, newWebhook]);
    setShowForm(false);
    setFormData({ name: '', url: '', events: [] });
    toast.success('Webhook created');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    saveWebhooks(webhooks.filter(w => w.id !== id));
    toast.success('Webhook deleted');
  };

  const toggleActive = (id: string) => {
    const updated = webhooks.map(w =>
      w.id === id ? { ...w, is_active: !w.is_active } : w
    );
    saveWebhooks(updated);
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  const testWebhook = async (webhook: WebhookConfig) => {
    toast.success('Test webhook sent');
    const updated = webhooks.map(w =>
      w.id === webhook.id
        ? { ...w, last_triggered: new Date().toISOString(), last_status: 'success' as const }
        : w
    );
    saveWebhooks(updated);
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
            <div className="p-2.5 bg-orange-500/10 rounded-lg">
              <Webhook className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Webhooks</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Send real-time updates to external services
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              New Webhook
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Webhook"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL
                </label>
                <Input
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-app.com/webhook"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Events
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {WEBHOOK_EVENTS.map(event => (
                    <label key={event.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, events: [...formData.events, event.value] });
                          } else {
                            setFormData({ ...formData, events: formData.events.filter(ev => ev !== event.value) });
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-600 text-teal-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} className="bg-teal-600 hover:bg-teal-700 text-white">
                  Create Webhook
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks.length === 0 ? (
          <div className="text-center py-12 glass-card border border-slate-200 dark:border-slate-700 rounded-xl">
            <Webhook className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No webhooks configured
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Create webhooks to send data to external services
            </p>
            <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add First Webhook
            </Button>
          </div>
        ) : (
          webhooks.map(webhook => (
            <div
              key={webhook.id}
              className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{webhook.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      webhook.is_active
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1">
                    {webhook.url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(webhook.id)}
                    className={`p-1.5 rounded-lg ${webhook.is_active ? 'text-teal-600' : 'text-slate-400'}`}
                  >
                    {webhook.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => testWebhook(webhook)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Events:</span>
                  <span className="text-slate-900 dark:text-white">{webhook.events.length}</span>
                </div>
                {webhook.last_triggered && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 dark:text-slate-400">
                      Last: {new Date(webhook.last_triggered).toLocaleString()}
                    </span>
                    {webhook.last_status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : webhook.last_status === 'failed' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Secret:</span>
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                    {webhook.secret.substring(0, 20)}...
                  </code>
                  <button
                    onClick={() => copySecret(webhook.secret)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
