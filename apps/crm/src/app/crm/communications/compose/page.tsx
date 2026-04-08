'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@crm-eco/ui/lib/utils';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import { Card, CardContent } from '@crm-eco/ui/components/card';
import {
  Send,
  Save,
  X,
  Loader2,
  FileText,
  Search,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  MailPlus,
  ArrowLeft,
} from 'lucide-react';
import { LazyEmailEditor } from '@/components/email/LazyEmailEditor';
import { MERGE_FIELDS } from '@/components/email/types';
import { TemplatePicker } from '@/app/crm/inbox/_components/TemplatePicker';

// ============================================================================
// Types
// ============================================================================

interface Recipient {
  id: string | null;
  name: string | null;
  email: string;
  type: 'contact' | 'lead' | 'manual';
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  title_field?: string | null;
  phone?: string | null;
}

interface SearchResult {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  type: 'contact' | 'lead';
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  title_field: string | null;
}

interface CrmTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  channel: string;
  category: string | null;
}

// ============================================================================
// Recipient Autocomplete Component
// ============================================================================

function RecipientAutocomplete({
  recipients,
  onAdd,
  onRemove,
  disabled,
}: {
  recipients: Recipient[];
  onAdd: (r: Recipient) => void;
  onRemove: (email: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/crm/recipients/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already-added recipients
          const existing = new Set(recipients.map(r => r.email.toLowerCase()));
          const filtered = (data.recipients || []).filter(
            (r: SearchResult) => !existing.has(r.email.toLowerCase())
          );
          setResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch {
        console.error('Recipient search failed');
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, recipients]);

  const handleSelect = (result: SearchResult) => {
    onAdd({
      id: result.id,
      name: result.name,
      email: result.email,
      type: result.type,
      first_name: result.first_name,
      last_name: result.last_name,
      company: result.company,
      title_field: result.title_field,
      phone: result.phone,
    });
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  const handleManualAdd = () => {
    const email = query.trim();
    if (!email) return;

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check duplicates
    if (recipients.some(r => r.email.toLowerCase() === email.toLowerCase())) {
      toast.error('This email is already added');
      return;
    }

    onAdd({
      id: null,
      name: null,
      email,
      type: 'manual',
    });
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && showDropdown) {
        handleSelect(results[0]);
      } else {
        handleManualAdd();
      }
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            placeholder="Search contacts, leads, or type an email..."
            disabled={disabled}
            className="pl-9"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleManualAdd}
          disabled={disabled || !query.trim()}
          className="h-10"
        >
          Add
        </Button>
      </div>

      {/* Selected recipients */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {recipients.map((r) => (
            <Badge
              key={r.email}
              variant="secondary"
              className={cn(
                'gap-1.5 py-1 pl-2 pr-1',
                r.type === 'contact' && 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
                r.type === 'lead' && 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
                r.type === 'manual' && 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {r.type !== 'manual' && (
                <span className="text-[10px] font-semibold uppercase opacity-60">
                  {r.type === 'contact' ? 'C' : 'L'}
                </span>
              )}
              {r.name ? `${r.name} <${r.email}>` : r.email}
              <button
                type="button"
                onClick={() => onRemove(r.email)}
                className="ml-0.5 p-0.5 hover:bg-red-100 dark:hover:bg-red-500/20 rounded"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                result.type === 'contact'
                  ? 'bg-blue-100 dark:bg-blue-500/20'
                  : 'bg-amber-100 dark:bg-amber-500/20'
              )}>
                {result.type === 'contact' ? (
                  <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {result.name || result.email}
                </p>
                <p className="text-xs text-slate-500 truncate">{result.email}</p>
              </div>
              <Badge variant="outline" className="text-[10px] flex-shrink-0 capitalize">
                {result.type}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Template Selector Component (CRM Templates)
// ============================================================================

function CrmTemplateSelector({
  onSelect,
}: {
  onSelect: (template: CrmTemplate) => void;
}) {
  const [templates, setTemplates] = useState<CrmTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/templates?channel=email');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch {
        console.error('Failed to load CRM templates');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      t => t.name.toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
    );
  }, [templates, search]);

  if (loading || templates.length === 0) return null;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1.5 text-xs"
      >
        <FileText className="w-3.5 h-3.5" />
        CRM Templates
        <Badge variant="secondary" className="text-[10px] ml-1">{templates.length}</Badge>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-80 flex flex-col">
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No templates found</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelect(t);
                      setOpen(false);
                      setSearch('');
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.name}</p>
                    {t.subject && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">Subject: {t.subject}</p>
                    )}
                    {t.category && (
                      <Badge variant="outline" className="text-[10px] mt-1 capitalize">{t.category}</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Merge Field Resolution
// ============================================================================

function resolveMergeFields(
  content: string,
  recipient: Recipient | null,
): string {
  let result = content;

  // Build data map from recipient
  const data: Record<string, string> = {};

  if (recipient && recipient.type !== 'manual') {
    if (recipient.first_name) data['contact.first_name'] = recipient.first_name;
    if (recipient.last_name) data['contact.last_name'] = recipient.last_name;
    if (recipient.first_name || recipient.last_name) {
      data['contact.full_name'] = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ');
    }
    if (recipient.email) data['contact.email'] = recipient.email;
    if (recipient.phone) data['contact.phone'] = recipient.phone;
    if (recipient.title_field) data['contact.title'] = recipient.title_field;
    if (recipient.company) {
      data['contact.company'] = recipient.company;
      data['company.name'] = recipient.company;
    }
    if (recipient.name) data['contact.full_name'] = recipient.name;
  }

  // System fields
  data['system.today'] = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  data['system.current_year'] = new Date().getFullYear().toString();

  // Replace merge fields
  MERGE_FIELDS.forEach(field => {
    const regex = new RegExp(`\\{\\{\\s*${field.key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
    const value = data[field.key];
    if (value) {
      result = result.replace(regex, value);
    }
  });

  return result;
}

/**
 * Check for unresolved merge fields in content.
 * Returns list of unresolved field keys.
 */
function findUnresolvedMergeFields(content: string): string[] {
  const unresolved: string[] = [];
  const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    unresolved.push(match[1]);
  }
  return unresolved;
}

// ============================================================================
// Main Compose Page
// ============================================================================

export default function ComposePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL params for pre-fill
  const prefillTo = searchParams.get('to') || '';
  const prefillContactId = searchParams.get('contact_id') || '';
  const prefillLeadId = searchParams.get('lead_id') || '';
  const prefillSubject = searchParams.get('subject') || '';

  // State
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState(prefillSubject);
  const [bodyHtml, setBodyHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);

  // Auth state
  const [authProfile, setAuthProfile] = useState<{
    id: string;
    organization_id: string;
    full_name: string | null;
    email: string;
  } | null>(null);

  // Load auth profile
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, organization_id, full_name')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setAuthProfile({
          id: profile.id,
          organization_id: profile.organization_id,
          full_name: profile.full_name,
          email: user.email || '',
        });
      }
    }
    loadProfile();
  }, []);

  // Pre-fill recipient from URL params
  useEffect(() => {
    if (prefillTo && recipients.length === 0) {
      setRecipients([{
        id: prefillContactId || prefillLeadId || null,
        name: null,
        email: prefillTo,
        type: prefillContactId ? 'contact' : prefillLeadId ? 'lead' : 'manual',
      }]);
    }
  }, [prefillTo, prefillContactId, prefillLeadId, recipients.length]);

  // Pre-fill from contact/lead ID
  useEffect(() => {
    if ((prefillContactId || prefillLeadId) && !prefillTo && recipients.length === 0) {
      async function loadRecipient() {
        const recordId = prefillContactId || prefillLeadId;
        try {
          const res = await fetch(`/api/crm/recipients/search?q=${encodeURIComponent(recordId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.recipients?.[0]) {
              const r = data.recipients[0];
              setRecipients([{
                id: r.id,
                name: r.name,
                email: r.email,
                type: r.type,
                first_name: r.first_name,
                last_name: r.last_name,
                company: r.company,
                title_field: r.title_field,
                phone: r.phone,
              }]);
            }
          }
        } catch {
          console.error('Failed to load prefill recipient');
        }
      }
      loadRecipient();
    }
  }, [prefillContactId, prefillLeadId, prefillTo, recipients.length]);

  // Handlers
  const addRecipient = useCallback((r: Recipient) => {
    setRecipients(prev => {
      if (prev.some(existing => existing.email.toLowerCase() === r.email.toLowerCase())) {
        toast.error('This email is already added');
        return prev;
      }
      return [...prev, r];
    });
  }, []);

  const removeRecipient = useCallback((email: string) => {
    setRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  const addCcRecipient = useCallback((r: Recipient) => {
    setCcRecipients(prev => {
      if (prev.some(existing => existing.email.toLowerCase() === r.email.toLowerCase())) {
        return prev;
      }
      return [...prev, r];
    });
  }, []);

  const removeCcRecipient = useCallback((email: string) => {
    setCcRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  const addBccRecipient = useCallback((r: Recipient) => {
    setBccRecipients(prev => {
      if (prev.some(existing => existing.email.toLowerCase() === r.email.toLowerCase())) {
        return prev;
      }
      return [...prev, r];
    });
  }, []);

  const removeBccRecipient = useCallback((email: string) => {
    setBccRecipients(prev => prev.filter(r => r.email !== email));
  }, []);

  // Apply comms template (from TemplatePicker)
  const handleCommsTemplateSelect = useCallback((template: { subject: string; body_html: string }) => {
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setEditorKey(prev => prev + 1);
    toast.success('Template applied');
  }, []);

  // Apply CRM template
  const handleCrmTemplateSelect = useCallback((template: CrmTemplate) => {
    if (template.subject) setSubject(template.subject);
    setBodyHtml(template.body);
    setEditorKey(prev => prev + 1);
    toast.success(`Template "${template.name}" applied`);
  }, []);

  // Primary recipient for merge field resolution
  const primaryRecipient = recipients[0] || null;

  // Send handler
  const handleSend = async () => {
    // Validation
    if (recipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    if (!bodyHtml || bodyHtml === '<p></p>') {
      toast.error('Please enter a message body');
      return;
    }

    // Resolve merge fields
    const resolvedSubject = resolveMergeFields(subject, primaryRecipient);
    const resolvedBody = resolveMergeFields(bodyHtml, primaryRecipient);

    // Check for unresolved merge fields
    const unresolvedInSubject = findUnresolvedMergeFields(resolvedSubject);
    const unresolvedInBody = findUnresolvedMergeFields(resolvedBody);
    const allUnresolved = [...new Set([...unresolvedInSubject, ...unresolvedInBody])];

    if (allUnresolved.length > 0) {
      toast.error(`Unresolved merge fields: ${allUnresolved.join(', ')}. Please fill in or remove them.`);
      return;
    }

    setSending(true);

    try {
      const toEmails = recipients.map(r => r.email);
      const ccEmails = ccRecipients.map(r => r.email);
      const bccEmails = bccRecipients.map(r => r.email);

      // Determine linked record
      const linkedContactId = recipients.find(r => r.type === 'contact')?.id || undefined;
      const linkedLeadId = recipients.find(r => r.type === 'lead')?.id || undefined;

      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          to: toEmails,
          subject: resolvedSubject,
          body_html: resolvedBody,
          body_text: resolvedBody.replace(/<[^>]*>/g, ''),
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails.length > 0 ? bccEmails : undefined,
          from_name: authProfile?.full_name || authProfile?.email,
          linked_contact_id: linkedContactId,
          linked_lead_id: linkedLeadId,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      // Create inbox conversation + message for tracking
      if (authProfile) {
        const now = new Date().toISOString();
        const messageId = result.message_id
          ? `<${result.message_id}>`
          : `<${crypto.randomUUID()}@mail.doublehelixhub.com>`;

        const plainPreview = resolvedBody
          .replace(/<[^>]*>/g, '')
          .slice(0, 200);

        const { data: conv } = await supabase
          .from('inbox_conversations')
          .insert({
            org_id: authProfile.organization_id,
            channel: 'email',
            thread_id: messageId,
            subject: resolvedSubject || null,
            preview: plainPreview,
            contact_email: recipients[0].email,
            contact_name: recipients[0].name || null,
            contact_id: linkedContactId || null,
            linked_lead_id: linkedLeadId || null,
            status: 'open',
            priority: 'normal',
            assigned_to: authProfile.id,
            assigned_at: now,
            unread_count: 0,
            message_count: 1,
            last_message_at: now,
            first_message_at: now,
            tags: [],
            labels: [],
            metadata: {},
          })
          .select()
          .single();

        if (conv) {
          await supabase.from('inbox_messages').insert({
            org_id: authProfile.organization_id,
            conversation_id: conv.id,
            channel: 'email',
            direction: 'outbound',
            from_name: authProfile.full_name || authProfile.email,
            from_address: authProfile.email,
            to_address: recipients[0].email,
            to_name: recipients[0].name || null,
            subject: resolvedSubject || null,
            body_html: resolvedBody,
            body_text: resolvedBody.replace(/<[^>]*>/g, '') || null,
            cc_addresses: ccRecipients.map(r => ({ email: r.email, name: r.name })),
            bcc_addresses: bccRecipients.map(r => ({ email: r.email, name: r.name })),
            message_id: messageId,
            status: 'sent',
            sent_at: now,
            external_id: result.message_id || null,
            external_provider: result.provider || null,
            metadata: {},
          });
        }
      }

      setSent(true);
      setSentMessageId(result.message_id || null);
      toast.success('Email sent successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  // Success state
  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Email Sent Successfully
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
          Your email to {recipients.map(r => r.name || r.email).join(', ')} has been delivered.
        </p>
        {sentMessageId && (
          <p className="text-xs text-slate-400 mb-6">
            Message ID: {sentMessageId}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push('/crm/inbox')}>
            Go to Inbox
          </Button>
          <Button
            onClick={() => {
              setSent(false);
              setSentMessageId(null);
              setRecipients([]);
              setCcRecipients([]);
              setBccRecipients([]);
              setSubject('');
              setBodyHtml('');
              setEditorKey(prev => prev + 1);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            <MailPlus className="w-4 h-4 mr-2" />
            Compose Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MailPlus className="w-5 h-5 text-teal-600" />
              Compose Email
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Send to contacts, leads, or any email address
            </p>
          </div>
        </div>

        {/* Template buttons */}
        <div className="flex items-center gap-2">
          <CrmTemplateSelector onSelect={handleCrmTemplateSelect} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatePicker(true)}
            className="gap-1.5 text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            Email Templates
          </Button>
        </div>
      </div>

      {/* Compose Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Recipient Section */}
          <div className="border-b border-slate-200 dark:border-slate-700 p-4 space-y-3">
            {/* To */}
            <div className="flex items-start gap-3">
              <Label className="w-14 text-sm font-medium text-slate-500 pt-2.5 flex-shrink-0 text-right">To</Label>
              <div className="flex-1">
                <RecipientAutocomplete
                  recipients={recipients}
                  onAdd={addRecipient}
                  onRemove={removeRecipient}
                  disabled={sending}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-slate-500 text-xs h-10 flex-shrink-0"
              >
                {showCcBcc ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                Cc/Bcc
              </Button>
            </div>

            {/* CC / BCC */}
            {showCcBcc && (
              <>
                <div className="flex items-start gap-3">
                  <Label className="w-14 text-sm font-medium text-slate-500 pt-2.5 flex-shrink-0 text-right">Cc</Label>
                  <div className="flex-1">
                    <RecipientAutocomplete
                      recipients={ccRecipients}
                      onAdd={addCcRecipient}
                      onRemove={removeCcRecipient}
                      disabled={sending}
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Label className="w-14 text-sm font-medium text-slate-500 pt-2.5 flex-shrink-0 text-right">Bcc</Label>
                  <div className="flex-1">
                    <RecipientAutocomplete
                      recipients={bccRecipients}
                      onAdd={addBccRecipient}
                      onRemove={removeBccRecipient}
                      disabled={sending}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Subject */}
            <div className="flex items-center gap-3">
              <Label className="w-14 text-sm font-medium text-slate-500 flex-shrink-0 text-right">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                disabled={sending}
                className="flex-1"
              />
            </div>
          </div>

          {/* CRM Link Info */}
          {recipients.some(r => r.type !== 'manual') && (
            <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-500/5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                This email will be linked to:{' '}
                {recipients
                  .filter(r => r.type !== 'manual')
                  .map(r => `${r.name || r.email} (${r.type})`)
                  .join(', ')}
              </p>
            </div>
          )}

          {/* Email Editor */}
          <div className="min-h-[350px]">
            <LazyEmailEditor
              key={editorKey}
              content={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Start composing your email..."
              minHeight={350}
              editable={!sending}
              showSourceToggle={true}
              className="border-0 rounded-none"
            />
          </div>

          {/* Footer / Actions */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {primaryRecipient && primaryRecipient.type !== 'manual' && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Merge fields will resolve from {primaryRecipient.name || primaryRecipient.email}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={sending || recipients.length === 0}
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white min-w-[100px]"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merge Fields Reference */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <span className="text-xs text-slate-400 flex-shrink-0">Available merge fields:</span>
        {['contact.first_name', 'contact.last_name', 'contact.email', 'company.name', 'system.today'].map(f => (
          <code
            key={f}
            className="text-xs px-1.5 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded-full border border-teal-200 dark:border-teal-500/30 flex-shrink-0 whitespace-nowrap cursor-pointer hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(`{{${f}}}`);
              toast.success(`Copied {{${f}}} to clipboard`);
            }}
          >
            {`{{${f}}}`}
          </code>
        ))}
      </div>

      {/* Template Picker Panel (comms templates) */}
      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleCommsTemplateSelect}
      />
    </div>
  );
}
