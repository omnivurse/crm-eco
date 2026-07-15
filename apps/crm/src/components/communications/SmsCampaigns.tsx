'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  RefreshCw,
  Phone,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  channel: string;
  category: string | null;
  usage_count: number;
  created_at: string;
}

interface SmsActivity {
  id: string;
  to: string;
  body: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt: string;
}

interface ProviderStatus {
  configured: boolean;
  providerName: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmsCampaigns() {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    configured: false,
    providerName: null,
  });
  const [recentActivity, setRecentActivity] = useState<SmsActivity[]>([]);

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactId, setContactId] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<Array<{ id: string; title: string; phone?: string }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; title: string; phone?: string } | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);

  // Template search
  const [templateSearch, setTemplateSearch] = useState('');

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/templates?channel=sms');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      } else {
        toast.error('Failed to load SMS templates');
      }
    } catch {
      toast.error('Failed to load SMS templates');
    }
  }, []);

  const fetchProviderStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/providers');
      if (res.ok) {
        const data = await res.json();
        const providers = data.providers || data || [];
        const smsProvider = Array.isArray(providers)
          ? providers.find(
              (p: { type?: string; channel?: string; key?: string }) =>
                p.type === 'sms' || p.channel === 'sms' || p.key === 'twilio'
            )
          : null;
        setProviderStatus({
          configured: !!smsProvider,
          providerName: smsProvider?.name || smsProvider?.key || null,
        });
      }
    } catch {
      // Provider endpoint may not exist - that's okay
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTemplates(), fetchProviderStatus()]);
    setLoading(false);
  }, [fetchTemplates, fetchProviderStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // Contact Search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (contactSearch.length < 2) {
      setContactResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingContacts(true);
      try {
        // The records API requires `module_key` and reads `search` (the old
        // `?q=&limit=` call 400'd on every keystroke, so this picker never
        // returned results).
        const res = await fetch(
          `/api/crm/records?module_key=contacts&search=${encodeURIComponent(contactSearch)}&page_size=8`,
        );
        if (res.ok) {
          const data = await res.json();
          const records = data.records || data.data || [];
          setContactResults(
            records.map((r: { id: string; title?: string; data?: { phone?: string } }) => ({
              id: r.id,
              title: r.title || 'Untitled',
              phone: r.data?.phone || undefined,
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // ---------------------------------------------------------------------------
  // Send SMS
  // ---------------------------------------------------------------------------

  async function handleSend() {
    if (!selectedContact) {
      toast.error('Select a contact first');
      return;
    }
    if (!messageBody.trim()) {
      toast.error('Enter a message');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/comms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: selectedContact.id,
          channel: 'sms',
          body: messageBody,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('SMS sent successfully');
        setRecentActivity((prev) => [
          {
            id: data.messageId || crypto.randomUUID(),
            to: selectedContact.title,
            body: messageBody,
            status: 'sent',
            sentAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setMessageBody('');
        setSelectedContact(null);
        setContactSearch('');
        setComposeOpen(false);
      } else {
        toast.error(data.error || data.reason || 'Failed to send SMS');
        setRecentActivity((prev) => [
          {
            id: crypto.randomUUID(),
            to: selectedContact.title,
            body: messageBody,
            status: 'failed',
            sentAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch {
      toast.error('Network error sending SMS');
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const filteredTemplates = templates.filter(
    (t) =>
      !templateSearch ||
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.body.toLowerCase().includes(templateSearch.toLowerCase())
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatDate(dateStr);
  }

  // ---------------------------------------------------------------------------
  // Loading & Error States
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">SMS Campaigns</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage SMS templates and send text messages</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchAll} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button
            onClick={() => setComposeOpen(!composeOpen)}
            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
          >
            <Plus className="w-4 h-4 mr-2" /> Quick Compose
          </Button>
        </div>
      </div>

      {/* Provider Status */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${
                providerStatus.configured
                  ? 'bg-emerald-500/10'
                  : 'bg-amber-500/10'
              }`}
            >
              {providerStatus.configured ? (
                <Wifi className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                SMS Provider Status
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {providerStatus.configured
                  ? `Connected via ${providerStatus.providerName || 'SMS provider'}`
                  : 'No SMS provider configured. Set up Twilio or another SMS provider in Integrations.'}
              </p>
            </div>
            {!providerStatus.configured && (
              <Button variant="outline" size="sm" asChild>
                <a href="/crm/integrations">Configure</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Compose */}
      {composeOpen && (
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5" /> Quick Compose SMS
            </CardTitle>
            <CardDescription>Send a text message to a contact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contact Picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recipient
              </label>
              {selectedContact ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-900 dark:text-white flex-1">
                    {selectedContact.title}
                    {selectedContact.phone && (
                      <span className="text-slate-500 ml-2">{selectedContact.phone}</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedContact(null);
                      setContactSearch('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts by name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none"
                  />
                  {searchingContacts && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                  )}
                  {contactResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {contactResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedContact(c);
                            setContactId(c.id);
                            setContactSearch('');
                            setContactResults([]);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm"
                        >
                          <span className="text-slate-900 dark:text-white">{c.title}</span>
                          {c.phone && (
                            <span className="text-slate-500 ml-2 text-xs">{c.phone}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Message
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your SMS message..."
                rows={3}
                maxLength={1600}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">
                {messageBody.length}/1600 characters
                {messageBody.length > 160 && (
                  <span className="ml-2">({Math.ceil(messageBody.length / 160)} SMS segments)</span>
                )}
              </p>
            </div>

            {/* Template Quick-Fill */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Use Template
                </label>
                <div className="flex flex-wrap gap-2">
                  {templates.slice(0, 5).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setMessageBody(t.body)}
                      className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Send */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending || !selectedContact || !messageBody.trim()}>
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send SMS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SMS Templates */}
        <Card className="glass-card border-slate-200 dark:border-white/10 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 dark:text-white">SMS Templates</CardTitle>
                <CardDescription>{templates.length} template{templates.length !== 1 ? 's' : ''} available</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 outline-none w-44"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No SMS templates found</p>
                <p className="text-sm mt-1">Create templates in Settings to get started</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-teal-500/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-500 shrink-0" />
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {tpl.name}
                          </h4>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {tpl.body}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">{formatDate(tpl.created_at)}</p>
                        {tpl.usage_count > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Used {tpl.usage_count}x
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMessageBody(tpl.body);
                          setComposeOpen(true);
                        }}
                      >
                        <Send className="w-3 h-3 mr-1.5" /> Use Template
                      </Button>
                      {tpl.category && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {tpl.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent SMS Activity */}
        <Card className="glass-card border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Recent Activity</CardTitle>
            <CardDescription>SMS messages sent this session</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Phone className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No SMS activity yet</p>
                <p className="text-xs mt-1 text-slate-400">Send a message to see it here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recentActivity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        a.status === 'sent'
                          ? 'bg-emerald-500'
                          : a.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {a.status === 'sent' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : a.status === 'failed' ? (
                          <AlertCircle className="w-3 h-3 text-red-500" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-500" />
                        )}
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          To: {a.to}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatTime(a.sentAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
