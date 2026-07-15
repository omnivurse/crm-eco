'use client';

/**
 * CarrierContactsPanel — Displays and manages multiple contacts, credentials,
 * and portal links for an insurance carrier. Designed to be embedded inside
 * the Carrier Management edit dialog or a future carrier detail page.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@crm-eco/ui/components/confirm-dialog';
import { toastItemDeletedWithUndo } from '@/lib/crm/undo-delete';
import { cn } from '@crm-eco/ui/lib/utils';
import type { CarrierContact, CarrierContactRole } from '@/lib/crm/types';

// ---------------------------------------------------------------------------
// Role metadata — icons, labels, accent colors
// ---------------------------------------------------------------------------
interface RoleMeta {
  label: string;
  color: string;
  icon: string; // emoji fallback for badges
}

const ROLE_META: Record<CarrierContactRole, RoleMeta> = {
  general:        { label: 'General',          color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',     icon: '📋' },
  broker_support: { label: 'Broker Support',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',     icon: '🎧' },
  direct_rep:     { label: 'Direct Rep',       color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',     icon: '👤' },
  commissions:    { label: 'Commissions',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: '💰' },
  client_support: { label: 'Client Support',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',   icon: '📞' },
  underwriting:   { label: 'Underwriting',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',     icon: '📝' },
  claims:         { label: 'Claims',           color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',         icon: '🏥' },
  enrollment:     { label: 'Enrollment',       color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', icon: '📄' },
  other:          { label: 'Other',            color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',       icon: '📌' },
};

const ROLE_OPTIONS: { value: CarrierContactRole; label: string }[] = [
  { value: 'broker_support', label: 'Broker Support' },
  { value: 'direct_rep',     label: 'Direct Rep' },
  { value: 'commissions',    label: 'Commissions' },
  { value: 'client_support', label: 'Client Support' },
  { value: 'underwriting',   label: 'Underwriting' },
  { value: 'claims',         label: 'Claims' },
  { value: 'enrollment',     label: 'Enrollment' },
  { value: 'general',        label: 'General' },
  { value: 'other',          label: 'Other' },
];

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
interface ContactForm {
  contact_role: CarrierContactRole;
  label: string;
  contact_name: string;
  phone: string;
  email: string;
  agent_id: string;
  username: string;
  password: string;
  secure_email_user: string;
  secure_email_addr: string;
  portal_url: string;
  custom_link: string;
  custom_link_label: string;
  notes: string;
}

const EMPTY_FORM: ContactForm = {
  contact_role: 'broker_support',
  label: '',
  contact_name: '',
  phone: '',
  email: '',
  agent_id: '',
  username: '',
  password: '',
  secure_email_user: '',
  secure_email_addr: '',
  portal_url: '',
  custom_link: '',
  custom_link_label: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export interface CarrierContactsPanelProps {
  carrierId: string;
  className?: string;
}

export function CarrierContactsPanel({ carrierId, className }: CarrierContactsPanelProps) {
  const [contacts, setContacts] = useState<CarrierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ---- Fetch ----
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/carriers/${carrierId}/contacts`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setContacts(json.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [carrierId]);

  useEffect(() => {
    if (carrierId) fetchContacts();
  }, [carrierId, fetchContacts]);

  // ---- Save (create or update) ----
  const handleSave = async () => {
    if (!form.contact_name && !form.phone && !form.email && !form.agent_id && !form.portal_url) {
      toast.error('Please fill in at least one contact field');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/crm/carriers/${carrierId}/contacts`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: editingId, ...form }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
        toast.success('Contact updated');
      } else {
        const res = await fetch(`/api/crm/carriers/${carrierId}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
        toast.success('Contact added');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await fetchContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (contactId: string) => {
    if (
      !(await confirmDialog({
        title: 'Delete this carrier contact?',
        description:
          'This contact stores carrier login credentials. It will be moved to Trash — you can restore it for 30 days before it is permanently deleted.',
        confirmLabel: 'Move to Trash',
        destructive: true,
      }))
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/crm/carriers/${carrierId}/contacts?contact_id=${contactId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      await fetchContacts();
      toastItemDeletedWithUndo({
        entity: 'carrier_contact',
        id: contactId,
        label: 'Contact',
        onUndo: fetchContacts,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // ---- Edit ----
  const openEdit = (c: CarrierContact) => {
    setEditingId(c.id);
    setForm({
      contact_role: c.contact_role,
      label: c.label || '',
      contact_name: c.contact_name || '',
      phone: c.phone || '',
      email: c.email || '',
      agent_id: c.agent_id || '',
      username: c.username || '',
      password: c.password || '',
      secure_email_user: c.secure_email_user || '',
      secure_email_addr: c.secure_email_addr || '',
      portal_url: c.portal_url || '',
      custom_link: c.custom_link || '',
      custom_link_label: c.custom_link_label || '',
      notes: c.notes || '',
    });
    setShowForm(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Render ----
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Contacts & Credentials
        </h3>
        {!showForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="h-7 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Contact
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-500/30 bg-teal-50/50 dark:bg-teal-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
              {editingId ? 'Edit Contact' : 'New Contact'}
            </p>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Role *</label>
              <Select value={form.contact_role} onValueChange={(v) => setForm((f) => ({ ...f, contact_role: v as CarrierContactRole }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Label</label>
              <Input className="h-8 text-xs" placeholder="e.g. My Region Rep" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Contact Name</label>
              <Input className="h-8 text-xs" placeholder="John Smith" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Phone</label>
              <Input className="h-8 text-xs" placeholder="(555) 123-4567" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Email</label>
            <Input className="h-8 text-xs" placeholder="broker@carrier.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>

          {/* Credentials section */}
          <div className="pt-2 border-t border-teal-200/50 dark:border-teal-700/30">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
              Credentials & Links
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Agent ID</label>
                <Input className="h-8 text-xs" placeholder="AG-12345" value={form.agent_id} onChange={(e) => setForm((f) => ({ ...f, agent_id: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Username</label>
                <Input className="h-8 text-xs" placeholder="portal username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Password</label>
                <Input className="h-8 text-xs" type="password" placeholder="••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Portal URL</label>
                <Input className="h-8 text-xs" placeholder="https://portal.carrier.com" value={form.portal_url} onChange={(e) => setForm((f) => ({ ...f, portal_url: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Secure email & custom link */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Secure Email User</label>
              <Input className="h-8 text-xs" value={form.secure_email_user} onChange={(e) => setForm((f) => ({ ...f, secure_email_user: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Secure Email Address</label>
              <Input className="h-8 text-xs" value={form.secure_email_addr} onChange={(e) => setForm((f) => ({ ...f, secure_email_addr: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Custom Link</label>
              <Input className="h-8 text-xs" placeholder="https://..." value={form.custom_link} onChange={(e) => setForm((f) => ({ ...f, custom_link: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Link Label</label>
              <Input className="h-8 text-xs" placeholder="Broker Custom Link" value={form.custom_link_label} onChange={(e) => setForm((f) => ({ ...f, custom_link_label: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Notes</label>
            <Input className="h-8 text-xs" placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }} className="h-7 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {/* Contact list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center">
          <User className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No contacts added yet.</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Add broker support numbers, commissions contacts, agent IDs, and portal links.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => {
            const meta = ROLE_META[c.contact_role] || ROLE_META.general;
            const isExpanded = expandedIds.has(c.id);
            const hasCredentials = c.agent_id || c.username || c.password || c.portal_url || c.secure_email_addr || c.custom_link;

            return (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden"
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleExpand(c.id)}
                    className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', meta.color)}>
                        {meta.icon} {c.label || meta.label}
                      </Badge>
                      {c.contact_name && (
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {c.contact_name}
                        </span>
                      )}
                      {c.is_primary && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.phone && (
                        <CopyableField icon={Phone} value={c.phone} />
                      )}
                      {c.email && (
                        <CopyableField icon={Mail} value={c.email} />
                      )}
                      {hasCredentials && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> credentials
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                    {c.agent_id && (
                      <DetailRow label="Agent ID" value={c.agent_id} />
                    )}
                    {c.username && (
                      <DetailRow label="Username" value={c.username} />
                    )}
                    {c.password && (
                      <MaskedDetailRow label="Password" value={c.password} />
                    )}
                    {c.secure_email_user && (
                      <DetailRow label="Secure Email User" value={c.secure_email_user} />
                    )}
                    {c.secure_email_addr && (
                      <DetailRow label="Secure Email" value={c.secure_email_addr} />
                    )}
                    {c.portal_url && (
                      <LinkRow label="Broker Portal" url={c.portal_url} />
                    )}
                    {c.custom_link && (
                      <LinkRow label={c.custom_link_label || 'Custom Link'} url={c.custom_link} />
                    )}
                    {c.notes && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Notes</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.notes}</p>
                      </div>
                    )}
                    {!c.agent_id && !c.username && !c.password && !c.portal_url && !c.secure_email_addr && !c.custom_link && !c.notes && (
                      <p className="text-xs text-slate-400 italic">No additional details.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyableField({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600 transition-colors group"
      title={`Copy: ${value}`}
    >
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[140px]">{value}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider flex-shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 font-mono hover:text-teal-600 transition-colors"
      >
        {value}
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-300" />}
      </button>
    </div>
  );
}

function MaskedDetailRow({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
          {visible ? value : '••••••••'}
        </span>
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="text-slate-400 hover:text-slate-600 p-0.5"
          title={visible ? 'Hide' : 'Show'}
        >
          {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-slate-400 hover:text-teal-600 p-0.5"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider flex-shrink-0">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 hover:underline transition-colors"
      >
        <span className="truncate max-w-[200px]">{url.replace(/^https?:\/\//, '')}</span>
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>
    </div>
  );
}
