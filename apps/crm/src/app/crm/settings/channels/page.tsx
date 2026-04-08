'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Mail,
  MessageSquare,
  Phone,
  MessagesSquare,
  Globe,
  Share2,
  Users,
  Plus,
  Trash2,
  RefreshCw,
  Pencil,
  Key,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Inbox,
  X,
  Save,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { Switch } from '@crm-eco/ui/components/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@crm-eco/ui/components/dialog';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Channel {
  id: string;
  organization_id: string;
  channel_type: string;
  provider: string;
  display_name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  inbound_enabled: boolean;
  inbound_address: string | null;
  created_at: string;
}

interface InboundMessage {
  id: string;
  channel_type: string;
  from_address: string;
  from_name: string | null;
  subject: string | null;
  status: string;
  matched_record_id: string | null;
  match_method: string | null;
  created_at: string;
  crm_channels?: { display_name: string; provider: string } | null;
}

const CHANNEL_TYPES = ['email', 'sms', 'telephony', 'chat', 'webform', 'social', 'portal'] as const;
type ChannelType = (typeof CHANNEL_TYPES)[number];

const CHANNEL_META: Record<ChannelType, { label: string; icon: React.ReactNode; color: string; providers: string[] }> = {
  email:     { label: 'Email',     icon: <Mail className="w-4 h-4" />,           color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',     providers: ['resend', 'smtp', 'sendgrid'] },
  sms:       { label: 'SMS',       icon: <MessageSquare className="w-4 h-4" />,  color: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400', providers: ['twilio', 'telnyx'] },
  telephony: { label: 'Telephony', icon: <Phone className="w-4 h-4" />,          color: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400', providers: ['twilio_voice', 'telnyx_voice'] },
  chat:      { label: 'Chat',      icon: <MessagesSquare className="w-4 h-4" />, color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',     providers: ['webchat', 'intercom'] },
  webform:   { label: 'Webforms',  icon: <Globe className="w-4 h-4" />,          color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400', providers: ['native', 'typeform'] },
  social:    { label: 'Social',    icon: <Share2 className="w-4 h-4" />,         color: 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',     providers: ['facebook', 'instagram', 'linkedin', 'twitter'] },
  portal:    { label: 'Portals',   icon: <Users className="w-4 h-4" />,          color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400', providers: ['member_portal', 'advisor_portal'] },
};

type Tab = 'channels' | 'inbound';

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChannelsHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [inbound, setInbound] = useState<InboundMessage[]>([]);
  const [inboundTotal, setInboundTotal] = useState(0);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['email']));

  // Add channel dialog
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState<ChannelType>('email');
  const [newProvider, setNewProvider] = useState('');
  const [newName, setNewName] = useState('');
  const [newInbound, setNewInbound] = useState(false);
  const [newInboundAddr, setNewInboundAddr] = useState('');
  const [saving, setSaving] = useState(false);

  // Credential dialog
  const [credChannel, setCredChannel] = useState<Channel | null>(null);
  const [credKey, setCredKey] = useState('');
  const [credValue, setCredValue] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [chRes, inRes] = await Promise.all([
        fetch('/api/crm/channels'),
        fetch('/api/crm/channels/inbound?limit=30'),
      ]);
      if (chRes.ok) setChannels((await chRes.json()).channels || []);
      if (inRes.ok) {
        const inData = await inRes.json();
        setInbound(inData.messages || []);
        setInboundTotal(inData.total || 0);
      }
    } catch (err) {
      console.error('[ChannelsHub] Fetch error:', err);
      toast.error('Failed to load channels data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Create channel ────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newProvider || !newName) { toast.error('Provider and name required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_type: newType,
          provider: newProvider,
          display_name: newName,
          inbound_enabled: newInbound,
          inbound_address: newInboundAddr || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast.success(`Channel "${newName}" created`);
      setShowAdd(false);
      setNewProvider(''); setNewName(''); setNewInbound(false); setNewInboundAddr('');
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  // ── Toggle active ────────────────────────────────────────────────────────
  async function toggleActive(ch: Channel) {
    try {
      const res = await fetch('/api/crm/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ch.id, is_active: !ch.is_active }),
      });
      if (!res.ok) throw new Error('Failed');
      setChannels((prev) => prev.map((c) => c.id === ch.id ? { ...c, is_active: !c.is_active } : c));
    } catch { toast.error('Failed to update channel'); }
  }

  // ── Save credential ──────────────────────────────────────────────────────
  async function handleSaveCredential() {
    if (!credChannel || !credKey || !credValue) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/channels/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: credChannel.id, credential_key: credKey, credential_value: credValue }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Credential "${credKey}" saved`);
      setCredChannel(null); setCredKey(''); setCredValue('');
    } catch { toast.error('Failed to save credential'); }
    finally { setSaving(false); }
  }

  // ── Delete channel ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/crm/channels?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Deleted ${deleteTarget.display_name}`);
      setDeleteTarget(null);
      fetchData();
    } catch { toast.error('Failed to delete channel'); }
  }

  // ── Group channels by type ────────────────────────────────────────────────
  const grouped = CHANNEL_TYPES.reduce<Record<string, Channel[]>>((acc, t) => {
    acc[t] = channels.filter((c) => c.channel_type === t);
    return acc;
  }, {} as Record<string, Channel[]>);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Channels Hub</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Manage communication channels and inbound message routing
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Channel
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px">
        {[
          { key: 'channels' as Tab, label: 'Channels', icon: <Radio className="w-4 h-4" />, count: channels.length },
          { key: 'inbound' as Tab, label: 'Inbound Messages', icon: <Inbox className="w-4 h-4" />, count: inboundTotal },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.icon} {t.label}
            <Badge variant="secondary" className="text-xs ml-1">{t.count}</Badge>
          </button>
        ))}
      </div>

      {/* ═══════════ CHANNELS TAB ═══════════ */}
      {activeTab === 'channels' && (
        <div className="space-y-3">
          {CHANNEL_TYPES.map((type) => {
            const meta = CHANNEL_META[type];
            const items = grouped[type] || [];
            const isOpen = expandedTypes.has(type);
            return (
              <div key={type} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type); else next.add(type);
                    return next;
                  })}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${meta.color}`}>{meta.icon}</div>
                    <span className="font-semibold text-slate-900 dark:text-white">{meta.label}</span>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-white/5">
                    {items.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-400">No {meta.label.toLowerCase()} channels configured</p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {items.map((ch) => (
                          <div key={ch.id} className="flex items-center gap-4 px-5 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-white">{ch.display_name}</span>
                                <code className="text-xs text-slate-400">{ch.provider}</code>
                                {ch.is_default && <Badge className="text-xs bg-teal-100 text-teal-700">Default</Badge>}
                                {ch.inbound_enabled && <Badge variant="outline" className="text-xs">Inbound</Badge>}
                              </div>
                              {ch.inbound_address && (
                                <p className="text-xs text-slate-400 mt-0.5 font-mono">{ch.inbound_address}</p>
                              )}
                            </div>
                            <Switch checked={ch.is_active} onCheckedChange={() => toggleActive(ch)} />
                            <Button size="sm" variant="ghost" onClick={() => { setCredChannel(ch); setCredKey(''); setCredValue(''); }}>
                              <Key className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setDeleteTarget(ch)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ INBOUND TAB ═══════════ */}
      {activeTab === 'inbound' && (
        <div>
          {inbound.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500">No inbound messages yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">From</th>
                    <th className="px-4 py-3 font-medium">Channel</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Match</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {inbound.map((msg) => (
                    <tr key={msg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2">
                        <div className="text-slate-900 dark:text-white">{msg.from_name || msg.from_address}</div>
                        {msg.from_name && <div className="text-xs text-slate-400">{msg.from_address}</div>}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {msg.channel_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">
                        {msg.subject || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            msg.status === 'matched' ? 'text-emerald-600 border-emerald-300'
                            : msg.status === 'unmatched' ? 'text-amber-600 border-amber-300'
                            : msg.status === 'failed' ? 'text-red-600 border-red-300'
                            : 'text-slate-600'
                          }`}
                        >
                          {msg.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {msg.match_method?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Add Channel Dialog ───────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Channel</DialogTitle>
            <DialogDescription>Register a new communication channel</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Channel Type</label>
              <select
                value={newType}
                onChange={(e) => { setNewType(e.target.value as ChannelType); setNewProvider(''); }}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {CHANNEL_TYPES.map((t) => (
                  <option key={t} value={t}>{CHANNEL_META[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Select provider...</option>
                {CHANNEL_META[newType].providers.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Display Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Production Email" className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newInbound} onCheckedChange={setNewInbound} />
              <label className="text-sm text-slate-600 dark:text-slate-400">Enable inbound messages</label>
            </div>
            {newInbound && (
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Inbound Address</label>
                <Input value={newInboundAddr} onChange={(e) => setNewInboundAddr(e.target.value)} placeholder="e.g. inbound@crm.doublehelixhub.com or +15551234567" className="mt-1 font-mono" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Channel'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Credential Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!credChannel} onOpenChange={() => setCredChannel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Credentials</DialogTitle>
            <DialogDescription>
              Add or update credentials for <strong>{credChannel?.display_name}</strong> ({credChannel?.provider})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Credential Key</label>
              <Input value={credKey} onChange={(e) => setCredKey(e.target.value)} placeholder="e.g. api_key, auth_token" className="mt-1 font-mono" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Credential Value</label>
              <Input type="password" value={credValue} onChange={(e) => setCredValue(e.target.value)} placeholder="Enter secret value" className="mt-1 font-mono" />
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Credentials are stored securely and never returned in API responses. This action is logged.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredChannel(null)}>Cancel</Button>
            <Button onClick={handleSaveCredential} disabled={saving}>
              <Save className="w-3 h-3 mr-2" /> {saving ? 'Saving...' : 'Save Credential'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete Channel
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.display_name}</strong>?
              Associated credentials will also be removed. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
