'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Send,
  Save,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Paperclip,
  FileSignature,
  Loader2,
  Star,
  Mail,
} from 'lucide-react';
import { EmailEditor } from './EmailEditor';
import { EmailAttachments, EmailAttachment } from './EmailAttachments';
import { SenderSelector } from './SenderSelector';
import { toast } from 'sonner';

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailSignature {
  id: string;
  name: string;
  content_html: string;
  is_default: boolean;
}

interface EmailComposerProps {
  // Initial values
  initialTo?: EmailRecipient[];
  initialCc?: EmailRecipient[];
  initialBcc?: EmailRecipient[];
  initialSubject?: string;
  initialBody?: string;
  initialAttachments?: EmailAttachment[];

  // Callbacks
  onSend?: (data: EmailComposerData) => Promise<void>;
  onSave?: (data: EmailComposerData) => Promise<void>;
  onSchedule?: (data: EmailComposerData, scheduledAt: Date) => Promise<void>;
  onCancel?: () => void;

  // Configuration
  showSchedule?: boolean;
  showSave?: boolean;
  showAttachments?: boolean;
  showSignatures?: boolean;
  disabled?: boolean;
  className?: string;

  // Merge field data for preview
  previewData?: Record<string, string>;

  // Campaign/Template context
  campaignId?: string;
  templateId?: string;
}

export interface EmailComposerData {
  sender_address_id?: string;
  to: EmailRecipient[];
  cc: EmailRecipient[];
  bcc: EmailRecipient[];
  subject: string;
  body_html: string;
  body_text?: string;
  signature_id?: string;
  attachments: EmailAttachment[];
  track_opens?: boolean;
  track_clicks?: boolean;
}

export function EmailComposer({
  initialTo = [],
  initialCc = [],
  initialBcc = [],
  initialSubject = '',
  initialBody = '',
  initialAttachments = [],
  onSend,
  onSave,
  onSchedule,
  onCancel,
  showSchedule = true,
  showSave = true,
  showAttachments = true,
  showSignatures = true,
  disabled = false,
  className,
  previewData = {},
  campaignId,
  templateId,
}: EmailComposerProps) {
  // Form state
  const [senderAddressId, setSenderAddressId] = useState<string>('');
  const [to, setTo] = useState<EmailRecipient[]>(initialTo);
  const [cc, setCc] = useState<EmailRecipient[]>(initialCc);
  const [bcc, setBcc] = useState<EmailRecipient[]>(initialBcc);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [signatureId, setSignatureId] = useState<string>('');
  const [attachments, setAttachments] = useState<EmailAttachment[]>(initialAttachments);

  // UI state
  const [showCcBcc, setShowCcBcc] = useState(initialCc.length > 0 || initialBcc.length > 0);
  const [showAttachmentsPanel, setShowAttachmentsPanel] = useState(initialAttachments.length > 0);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Data state
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loadingSignatures, setLoadingSignatures] = useState(true);

  // Temporary input states for recipients
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  // Load signatures
  useEffect(() => {
    async function loadSignatures() {
      try {
        const response = await fetch('/api/email/signatures');
        if (response.ok) {
          const data = await response.json();
          setSignatures(data.signatures || []);

          // Auto-select default signature
          const defaultSig = data.signatures?.find((s: EmailSignature) => s.is_default);
          if (defaultSig) {
            setSignatureId(defaultSig.id);
          }
        }
      } catch (error) {
        console.error('Failed to load signatures:', error);
      } finally {
        setLoadingSignatures(false);
      }
    }

    if (showSignatures) {
      loadSignatures();
    } else {
      setLoadingSignatures(false);
    }
  }, [showSignatures]);

  // Build full body with signature
  const getFullBody = useCallback(() => {
    if (!signatureId) return body;

    const signature = signatures.find(s => s.id === signatureId);
    if (!signature) return body;

    return `${body}<br/><br/>--<br/>${signature.content_html}`;
  }, [body, signatureId, signatures]);

  // Get composer data
  const getComposerData = useCallback((): EmailComposerData => ({
    sender_address_id: senderAddressId || undefined,
    to,
    cc,
    bcc,
    subject,
    body_html: getFullBody(),
    signature_id: signatureId || undefined,
    attachments: attachments.filter(a => !a.is_uploading && !a.error),
  }), [senderAddressId, to, cc, bcc, subject, getFullBody, signatureId, attachments]);

  // Add recipient helper
  const addRecipient = (
    input: string,
    setInput: (value: string) => void,
    recipients: EmailRecipient[],
    setRecipients: (recipients: EmailRecipient[]) => void
  ) => {
    const email = input.trim();
    if (!email) return;

    // Basic email validation
    if (!email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (recipients.some(r => r.email.toLowerCase() === email.toLowerCase())) {
      toast.error('This email is already added');
      return;
    }

    setRecipients([...recipients, { email }]);
    setInput('');
  };

  // Remove recipient helper
  const removeRecipient = (
    email: string,
    recipients: EmailRecipient[],
    setRecipients: (recipients: EmailRecipient[]) => void
  ) => {
    setRecipients(recipients.filter(r => r.email !== email));
  };

  // Handle send
  const handleSend = async () => {
    if (to.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please add a subject');
      return;
    }

    if (!onSend) return;

    setIsSending(true);
    try {
      await onSend(getComposerData());
      toast.success('Email sent successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(getComposerData());
      toast.success('Draft saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedSignature = signatures.find(s => s.id === signatureId);
  const uploadingCount = attachments.filter(a => a.is_uploading).length;
  const attachmentCount = attachments.filter(a => !a.error).length;

  return (
    <div className={cn('email-composer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden', className)}>
      {/* Header Section */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-4 space-y-4">
        {/* From */}
        <div className="flex items-center gap-4">
          <Label className="w-16 text-sm font-medium text-slate-500">From</Label>
          <div className="flex-1">
            <SenderSelector
              value={senderAddressId}
              onChange={(id) => setSenderAddressId(id)}
              disabled={disabled}
            />
          </div>
        </div>

        {/* To */}
        <div className="flex items-start gap-4">
          <Label className="w-16 text-sm font-medium text-slate-500 pt-2">To</Label>
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Input
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRecipient(toInput, setToInput, to, setTo);
                  }
                }}
                placeholder="Enter recipient email"
                disabled={disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addRecipient(toInput, setToInput, to, setTo)}
                disabled={disabled || !toInput}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-slate-500"
              >
                {showCcBcc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Cc/Bcc
              </Button>
            </div>
            {to.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {to.map((recipient) => (
                  <Badge key={recipient.email} variant="secondary" className="gap-1 py-1">
                    {recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email}
                    <button
                      type="button"
                      onClick={() => removeRecipient(recipient.email, to, setTo)}
                      className="ml-1 hover:text-red-500"
                      disabled={disabled}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CC/BCC */}
        {showCcBcc && (
          <div className="space-y-4">
            {/* CC */}
            <div className="flex items-start gap-4">
              <Label className="w-16 text-sm font-medium text-slate-500 pt-2">Cc</Label>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRecipient(ccInput, setCcInput, cc, setCc);
                      }
                    }}
                    placeholder="Enter CC email"
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRecipient(ccInput, setCcInput, cc, setCc)}
                    disabled={disabled || !ccInput}
                  >
                    Add
                  </Button>
                </div>
                {cc.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cc.map((recipient) => (
                      <Badge key={recipient.email} variant="secondary" className="gap-1 py-1">
                        {recipient.email}
                        <button
                          type="button"
                          onClick={() => removeRecipient(recipient.email, cc, setCc)}
                          className="ml-1 hover:text-red-500"
                          disabled={disabled}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BCC */}
            <div className="flex items-start gap-4">
              <Label className="w-16 text-sm font-medium text-slate-500 pt-2">Bcc</Label>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRecipient(bccInput, setBccInput, bcc, setBcc);
                      }
                    }}
                    placeholder="Enter BCC email"
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRecipient(bccInput, setBccInput, bcc, setBcc)}
                    disabled={disabled || !bccInput}
                  >
                    Add
                  </Button>
                </div>
                {bcc.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bcc.map((recipient) => (
                      <Badge key={recipient.email} variant="secondary" className="gap-1 py-1">
                        {recipient.email}
                        <button
                          type="button"
                          onClick={() => removeRecipient(recipient.email, bcc, setBcc)}
                          className="ml-1 hover:text-red-500"
                          disabled={disabled}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-4">
          <Label className="w-16 text-sm font-medium text-slate-500">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject"
            disabled={disabled}
            className="flex-1"
          />
        </div>
      </div>

      {/* Editor Section */}
      <EmailEditor
        content={body}
        onChange={setBody}
        placeholder="Start typing your email..."
        minHeight={300}
        editable={!disabled}
        previewData={previewData}
        className="border-0 rounded-none"
      />

      {/* Attachments Section */}
      {showAttachments && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setShowAttachmentsPanel(!showAttachmentsPanel)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Paperclip className="w-4 h-4" />
              Attachments
              {attachmentCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {attachmentCount}
                </Badge>
              )}
              {uploadingCount > 0 && (
                <Loader2 className="w-3 h-3 animate-spin text-teal-500" />
              )}
            </div>
            {showAttachmentsPanel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {showAttachmentsPanel && (
            <div className="px-4 pb-4">
              <EmailAttachments
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {/* Footer Section */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        {/* Left side - Signature selector */}
        <div className="flex items-center gap-3">
          {showSignatures && (
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-slate-400" />
              <Select
                value={signatureId}
                onValueChange={setSignatureId}
                disabled={disabled || loadingSignatures}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="No signature">
                    {loadingSignatures ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading...
                      </span>
                    ) : selectedSignature ? (
                      <span className="flex items-center gap-1">
                        {selectedSignature.name}
                        {selectedSignature.is_default && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                      </span>
                    ) : (
                      'No signature'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No signature</SelectItem>
                  {signatures.map((sig) => (
                    <SelectItem key={sig.id} value={sig.id}>
                      <span className="flex items-center gap-1">
                        {sig.name}
                        {sig.is_default && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSending || isSaving}
            >
              Cancel
            </Button>
          )}

          {showSave && onSave && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={disabled || isSending || isSaving}
              className="gap-1"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </Button>
          )}

          {showSchedule && onSchedule && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isSending || isSaving || uploadingCount > 0}
              className="gap-1"
            >
              <Clock className="w-4 h-4" />
              Schedule
            </Button>
          )}

          {onSend && (
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={disabled || isSending || isSaving || uploadingCount > 0 || to.length === 0}
              className="gap-1"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailComposer;
