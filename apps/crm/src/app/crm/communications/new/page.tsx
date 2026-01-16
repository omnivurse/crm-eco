'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  Send,
  Paperclip,
  Users,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type Channel = 'email' | 'sms';

interface Template {
  id: string;
  name: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function NewCommunicationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Pre-fill from URL params
  const prefillTo = searchParams.get('to') || '';
  const prefillChannel = (searchParams.get('channel') as Channel) || 'email';
  const prefillContactId = searchParams.get('contact_id') || '';
  const prefillLeadId = searchParams.get('lead_id') || '';
  const prefillDealId = searchParams.get('deal_id') || '';
  
  // Form state
  const [channel, setChannel] = useState<Channel>(prefillChannel);
  const [to, setTo] = useState(prefillTo);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  
  // Status
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Fetch templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/comms/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      }
    }
    fetchTemplates();
  }, []);
  
  // Apply template
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      if (template.subject) setSubject(template.subject);
      if (template.body_html) setBodyHtml(template.body_html);
      if (template.body_text) setBodyText(template.body_text);
    }
  };
  
  // Send
  const handleSend = async () => {
    setError(null);
    setSending(true);
    
    try {
      const payload: Record<string, unknown> = {
        channel,
        to: channel === 'email' ? to.split(',').map(e => e.trim()) : to,
      };
      
      if (channel === 'email') {
        payload.subject = subject;
        payload.body_html = bodyHtml || undefined;
        payload.body_text = bodyText || (bodyHtml ? undefined : 'No content');
        if (cc) payload.cc = cc.split(',').map(e => e.trim());
        if (bcc) payload.bcc = bcc.split(',').map(e => e.trim());
      } else {
        payload.body = bodyText;
      }
      
      // Add CRM links
      if (prefillContactId) payload.linked_contact_id = prefillContactId;
      if (prefillLeadId) payload.linked_lead_id = prefillLeadId;
      if (prefillDealId) payload.linked_deal_id = prefillDealId;
      
      const response = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send');
      }
      
      setSent(true);
      
      // Redirect after success
      setTimeout(() => {
        router.push('/crm/inbox');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
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
          {channel === 'email' ? 'Email' : 'SMS'} Sent Successfully
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Redirecting to inbox...
        </p>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm/inbox"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            New Communication
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Send an email or SMS
          </p>
        </div>
      </div>
      
      {/* Channel Selector */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setChannel('email')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            channel === 'email'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        <button
          onClick={() => setChannel('sms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            channel === 'sms'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          SMS
        </button>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800 dark:text-red-300">Failed to send</h4>
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5 text-red-500" />
          </button>
        </div>
      )}
      
      {/* Form */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        {/* Template Selector (Email only) */}
        {channel === 'email' && templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Template (Optional)
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* To */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            To {channel === 'email' ? '(Email addresses, comma-separated)' : '(Phone number)'}
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={channel === 'email' ? 'john@example.com, jane@example.com' : '+1234567890'}
            required
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        
        {/* CC/BCC (Email only) */}
        {channel === 'email' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                CC
              </label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                BCC
              </label>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
        
        {/* Subject (Email only) */}
        {channel === 'email' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        )}
        
        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {channel === 'email' ? 'Message' : 'Message (160 char limit recommended)'}
          </label>
          {channel === 'email' ? (
            <textarea
              value={bodyHtml || bodyText}
              onChange={(e) => {
                setBodyHtml(e.target.value);
                setBodyText(e.target.value.replace(/<[^>]*>/g, ''));
              }}
              placeholder="Write your message..."
              rows={8}
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          ) : (
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              maxLength={320}
              required
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
            />
          )}
          {channel === 'sms' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {bodyText.length} / 320 characters ({Math.ceil(bodyText.length / 160)} SMS segment{Math.ceil(bodyText.length / 160) !== 1 ? 's' : ''})
            </p>
          )}
        </div>
        
        {/* CRM Links Info */}
        {(prefillContactId || prefillLeadId || prefillDealId) && (
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              This message will be linked to your CRM record
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Attach file (coming soon)"
              disabled
            >
              <Paperclip className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/crm/inbox"
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Link>
            <button
              onClick={handleSend}
              disabled={sending || !to || (channel === 'email' ? !subject : !bodyText)}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
