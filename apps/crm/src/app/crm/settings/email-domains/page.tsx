'use client';

import { useState, useEffect } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@crm-eco/ui/components/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@crm-eco/ui/components/accordion';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Globe,
  Plus,
  Check,
  X,
  RefreshCw,
  Copy,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX';
  name: string;
  value: string;
  purpose: string;
  verified: boolean;
}

interface EmailDomain {
  id: string;
  domain: string;
  status: 'pending' | 'verifying' | 'verified' | 'failed';
  dkim_selector: string;
  dkim_verified: boolean;
  spf_verified: boolean;
  dmarc_verified: boolean;
  mx_verified: boolean;
  verification_token: string;
  last_verified_at: string | null;
  error_message: string | null;
  created_at: string;
  sender_addresses?: SenderAddress[];
}

interface SenderAddress {
  id: string;
  email: string;
  name: string | null;
  is_default: boolean;
  is_verified: boolean;
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: EmailDomain['status'] }) {
  const config = {
    pending: { label: 'Pending Setup', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', icon: Clock },
    verifying: { label: 'Verifying...', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: RefreshCw },
    verified: { label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: AlertCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <Badge variant="secondary" className={cn('font-medium gap-1', color)}>
      <Icon className={cn('w-3 h-3', status === 'verifying' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

function DnsRecordRow({ record, onCopy }: { record: DnsRecord; onCopy: (text: string) => void }) {
  return (
    <div className="flex items-start gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="flex-shrink-0 pt-1">
        {record.verified ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Clock className="w-5 h-5 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="font-mono text-xs">
            {record.type}
          </Badge>
          <span className="text-sm text-slate-500">{record.purpose}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Host:</span>
            <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">
              {record.name}
            </code>
            <button
              onClick={() => onCopy(record.name)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              <Copy className="w-3 h-3 text-slate-400" />
            </button>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-400 pt-0.5">Value:</span>
            <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-mono break-all flex-1">
              {record.value}
            </code>
            <button
              onClick={() => onCopy(record.value)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded flex-shrink-0"
            >
              <Copy className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DomainCard({
  domain,
  onVerify,
  onDelete,
  onAddSender,
}: {
  domain: EmailDomain;
  onVerify: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddSender: (domainId: string, email: string, name: string) => Promise<void>;
}) {
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const loadDnsRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/email-domains/${domain.id}`);
      const data = await response.json();
      if (data.dnsRecords) {
        setDnsRecords(data.dnsRecords);
      }
    } catch (error) {
      console.error('Error loading DNS records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await onVerify(domain.id);
      await loadDnsRecords();
    } finally {
      setVerifying(false);
    }
  };

  const handleAddSender = async () => {
    if (!newSenderEmail) return;
    setAddingSender(true);
    try {
      await onAddSender(domain.id, newSenderEmail, newSenderName);
      setNewSenderEmail('');
      setNewSenderName('');
    } finally {
      setAddingSender(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-500/20 rounded-lg">
              <Globe className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {domain.domain}
              </h3>
              <p className="text-sm text-slate-500">
                Added {new Date(domain.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={domain.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-1.5">Verify</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(domain.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Verification Status */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: 'DKIM', verified: domain.dkim_verified },
            { label: 'SPF', verified: domain.spf_verified },
            { label: 'DMARC', verified: domain.dmarc_verified },
            { label: 'MX', verified: domain.mx_verified },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
                item.verified
                  ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              )}
            >
              {item.verified ? (
                <Check className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="dns" className="border-0">
          <AccordionTrigger
            onClick={loadDnsRecords}
            className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="w-4 h-4" />
              DNS Records
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 mb-4">
                  Add these DNS records to your domain to verify ownership and enable email sending.
                </p>
                {dnsRecords.map((record, index) => (
                  <DnsRecordRow
                    key={index}
                    record={record}
                    onCopy={copyToClipboard}
                  />
                ))}
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-700 dark:text-blue-300">
                    DNS changes can take up to 48 hours to propagate. Click "Verify" after adding records.
                  </p>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="senders" className="border-0 border-t border-slate-200 dark:border-slate-700">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="w-4 h-4" />
              Sender Addresses ({domain.sender_addresses?.length || 0})
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-3">
              {domain.sender_addresses?.map((sender) => (
                <div
                  key={sender.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {sender.name || sender.email}
                    </p>
                    <p className="text-sm text-slate-500">{sender.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sender.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                    {sender.is_verified ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              ))}

              {domain.status === 'verified' && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <Label className="text-sm font-medium mb-2 block">Add Sender Address</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={`sender@${domain.domain}`}
                      value={newSenderEmail}
                      onChange={(e) => setNewSenderEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Display Name"
                      value={newSenderName}
                      onChange={(e) => setNewSenderName(e.target.value)}
                      className="w-40"
                    />
                    <Button
                      onClick={handleAddSender}
                      disabled={!newSenderEmail || addingSender}
                    >
                      {addingSender ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {domain.status !== 'verified' && (
                <p className="text-sm text-slate-500 italic">
                  Verify domain to add sender addresses
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

// Domain validation regex (must match server-side validation)
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain) return { valid: false, error: 'Domain is required' };

  // Clean up common mistakes
  const cleaned = domain.trim().toLowerCase();

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return { valid: false, error: 'Remove http:// or https:// from the domain' };
  }

  if (cleaned.startsWith('www.')) {
    return { valid: false, error: 'Remove www. prefix from the domain' };
  }

  if (cleaned.includes('/')) {
    return { valid: false, error: 'Domain should not include paths (remove everything after /)' };
  }

  if (cleaned.includes(' ')) {
    return { valid: false, error: 'Domain should not contain spaces' };
  }

  if (!DOMAIN_REGEX.test(cleaned)) {
    return { valid: false, error: 'Invalid domain format. Example: example.com' };
  }

  return { valid: true };
}

export default function EmailDomainsPage() {
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadDomains();
  }, []);

  async function loadDomains() {
    try {
      const response = await fetch('/api/settings/email-domains');
      const data = await response.json();
      setDomains(data.domains || []);
    } catch (error) {
      console.error('Error loading domains:', error);
      toast.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  }

  function handleDomainChange(value: string) {
    setNewDomain(value);
    // Clear error when user starts typing again
    if (domainError) {
      setDomainError(null);
    }
  }

  async function handleAddDomain() {
    const cleaned = newDomain.trim().toLowerCase();
    const validation = validateDomain(cleaned);

    if (!validation.valid) {
      setDomainError(validation.error || 'Invalid domain');
      return;
    }

    setAddingDomain(true);

    try {
      const response = await fetch('/api/settings/email-domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleaned }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add domain');
      }

      toast.success('Domain added successfully');
      setNewDomain('');
      setDomainError(null);
      setDialogOpen(false);
      await loadDomains();
    } catch (error) {
      console.error('Error adding domain:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add domain';
      setDomainError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleVerifyDomain(id: string) {
    try {
      const response = await fetch(`/api/settings/email-domains/${id}/verify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.verification?.allVerified) {
        toast.success('Domain verified successfully!');
      } else {
        toast.info('Some DNS records are still pending verification');
      }

      await loadDomains();
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Verification failed');
    }
  }

  async function handleDeleteDomain(id: string) {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
      await fetch(`/api/settings/email-domains/${id}`, { method: 'DELETE' });
      toast.success('Domain deleted');
      await loadDomains();
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast.error('Failed to delete domain');
    }
  }

  async function handleAddSender(domainId: string, email: string, name: string) {
    try {
      const response = await fetch(`/api/settings/email-domains/${domainId}/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, isDefault: false }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add sender address');
      }

      toast.success('Sender address added');
      await loadDomains();
    } catch (error) {
      console.error('Error adding sender address:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add sender address');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Email Domains
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure custom domains for sending emails
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setNewDomain('');
            setDomainError(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Email Domain</DialogTitle>
              <DialogDescription>
                Add a custom domain to send emails from your own address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain Name</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  className={domainError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {domainError ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {domainError}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Enter your domain without http:// or www
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                setNewDomain('');
                setDomainError(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddDomain} disabled={!newDomain.trim() || addingDomain}>
                {addingDomain ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domains List */}
      {domains.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <Globe className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            No domains configured
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Add a custom domain to send emails from your own address
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Domain
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              onVerify={handleVerifyDomain}
              onDelete={handleDeleteDomain}
              onAddSender={handleAddSender}
            />
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
          How Domain Verification Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
              1
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Add your domain</p>
              <p className="text-slate-500">Enter your domain name to get started</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
              2
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Configure DNS</p>
              <p className="text-slate-500">Add the required DNS records to your domain</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
              3
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Verify & Send</p>
              <p className="text-slate-500">Once verified, start sending from your domain</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
