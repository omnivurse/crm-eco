'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Label } from '@crm-eco/ui/components/label';
import { Switch } from '@crm-eco/ui/components/switch';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@crm-eco/ui/components/card';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  ArrowLeft,
  Mail,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  Eye,
  MousePointer2,
  FileSignature,
  Globe,
  Settings,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface SenderAddress {
  id: string;
  email: string;
  name: string;
  domain: string;
  is_default: boolean;
  is_verified: boolean;
}

interface EmailSignature {
  id: string;
  name: string;
  is_default: boolean;
}

interface UserEmailSettings {
  id?: string;
  default_sender_address_id: string | null;
  default_signature_id: string | null;
  default_reply_to: string | null;
  default_cc: string[];
  default_bcc: string[];
  track_opens: boolean;
  track_clicks: boolean;
  preferred_send_time: string | null;
  timezone: string;
  daily_send_limit: number;
  emails_sent_today: number;
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (AZ)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
];

export default function UserEmailSettingsPage() {
  const [settings, setSettings] = useState<UserEmailSettings>({
    default_sender_address_id: null,
    default_signature_id: null,
    default_reply_to: null,
    default_cc: [],
    default_bcc: [],
    track_opens: true,
    track_clicks: true,
    preferred_send_time: null,
    timezone: 'America/New_York',
    daily_send_limit: 500,
    emails_sent_today: 0,
  });

  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Temporary input states for CC/BCC
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch user email settings, sender addresses, and signatures in parallel
      const [settingsRes, addressesRes, signaturesRes] = await Promise.all([
        fetch('/api/email/settings'),
        fetch('/api/email/sender-addresses'),
        fetch('/api/email/signatures'),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.settings) {
          setSettings(settingsData.settings);
        }
      }

      if (addressesRes.ok) {
        const addressesData = await addressesRes.json();
        setSenderAddresses(addressesData.addresses || []);
      }

      if (signaturesRes.ok) {
        const signaturesData = await signaturesRes.json();
        setSignatures(signaturesData.signatures || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/email/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Email settings saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCC = () => {
    if (ccInput && !settings.default_cc.includes(ccInput)) {
      setSettings((prev) => ({
        ...prev,
        default_cc: [...prev.default_cc, ccInput],
      }));
      setCcInput('');
    }
  };

  const handleRemoveCC = (email: string) => {
    setSettings((prev) => ({
      ...prev,
      default_cc: prev.default_cc.filter((e) => e !== email),
    }));
  };

  const handleAddBCC = () => {
    if (bccInput && !settings.default_bcc.includes(bccInput)) {
      setSettings((prev) => ({
        ...prev,
        default_bcc: [...prev.default_bcc, bccInput],
      }));
      setBccInput('');
    }
  };

  const handleRemoveBCC = (email: string) => {
    setSettings((prev) => ({
      ...prev,
      default_bcc: prev.default_bcc.filter((e) => e !== email),
    }));
  };

  const selectedSender = senderAddresses.find(
    (a) => a.id === settings.default_sender_address_id
  );

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/crm/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Email Settings
            </h1>
            <p className="text-sm text-slate-500">
              Configure your personal email sending preferences
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Default Sender Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-500/20">
              <Send className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <CardTitle>Default Sender</CardTitle>
              <CardDescription>
                Choose your default sender address for outgoing emails
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Sender Address</Label>
            <Select
              value={settings.default_sender_address_id || ''}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, default_sender_address_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a sender address">
                  {selectedSender ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>
                        {selectedSender.name
                          ? `${selectedSender.name} <${selectedSender.email}>`
                          : selectedSender.email}
                      </span>
                    </div>
                  ) : (
                    'Select a sender address'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {senderAddresses.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-slate-500 text-center">
                    No sender addresses configured.
                    <Link href="/crm/settings/email-domains" className="text-teal-600 block mt-1">
                      Add a domain first
                    </Link>
                  </div>
                ) : (
                  senderAddresses.map((addr) => (
                    <SelectItem
                      key={addr.id}
                      value={addr.id}
                      disabled={!addr.is_verified}
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          {addr.name ? `${addr.name} <${addr.email}>` : addr.email}
                        </span>
                        {addr.is_default && (
                          <Star className="w-3 h-3 text-amber-500 fill-current" />
                        )}
                        {!addr.is_verified && (
                          <Badge variant="outline" className="text-xs">
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reply-to">Default Reply-To</Label>
            <Input
              id="reply-to"
              type="email"
              placeholder="replies@yourcompany.com"
              value={settings.default_reply_to || ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, default_reply_to: e.target.value || null }))
              }
            />
            <p className="text-xs text-slate-500">
              Optional: Replies will be sent to this address instead of the sender
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CC/BCC Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Default CC/BCC</CardTitle>
              <CardDescription>
                Automatically include these addresses on all outgoing emails
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CC */}
          <div className="space-y-2">
            <Label>Default CC</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCC())}
              />
              <Button type="button" variant="outline" onClick={handleAddCC}>
                Add
              </Button>
            </div>
            {settings.default_cc.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {settings.default_cc.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveCC(email)}
                      className="ml-1 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* BCC */}
          <div className="space-y-2">
            <Label>Default BCC</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBCC())}
              />
              <Button type="button" variant="outline" onClick={handleAddBCC}>
                Add
              </Button>
            </div>
            {settings.default_bcc.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {settings.default_bcc.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveBCC(email)}
                      className="ml-1 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Signature Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20">
              <FileSignature className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle>Email Signature</CardTitle>
              <CardDescription>
                Select your default signature for outgoing emails
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Signature</Label>
            <Select
              value={settings.default_signature_id || ''}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, default_signature_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a signature">
                  {signatures.find((s) => s.id === settings.default_signature_id)?.name ||
                    'Select a signature'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No signature</SelectItem>
                {signatures.map((sig) => (
                  <SelectItem key={sig.id} value={sig.id}>
                    <div className="flex items-center gap-2">
                      <span>{sig.name}</span>
                      {sig.is_default && (
                        <Star className="w-3 h-3 text-amber-500 fill-current" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              <Link href="/crm/settings/signatures" className="text-teal-600 hover:underline">
                Manage your signatures
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tracking Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>Email Tracking</CardTitle>
              <CardDescription>
                Configure tracking for opens and link clicks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Track Email Opens</Label>
              <p className="text-sm text-slate-500">
                Receive notifications when recipients open your emails
              </p>
            </div>
            <Switch
              checked={settings.track_opens}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, track_opens: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Track Link Clicks</Label>
              <p className="text-sm text-slate-500">
                Track when recipients click links in your emails
              </p>
            </div>
            <Switch
              checked={settings.track_clicks}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, track_clicks: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20">
              <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>Scheduling Preferences</CardTitle>
              <CardDescription>
                Configure your timezone and preferred sending times
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) =>
                setSettings((prev) => ({ ...prev, timezone: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-time">Preferred Send Time</Label>
            <Input
              id="send-time"
              type="time"
              value={settings.preferred_send_time || ''}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  preferred_send_time: e.target.value || null,
                }))
              }
            />
            <p className="text-xs text-slate-500">
              Scheduled emails will be sent around this time when possible
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sending Limits Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <CardTitle>Sending Limits</CardTitle>
              <CardDescription>
                View your daily email sending limits and usage
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Daily Send Limit</p>
                <p className="text-sm text-slate-500">Maximum emails you can send per day</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {settings.daily_send_limit}
                </p>
                <p className="text-sm text-slate-500">emails/day</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Today's Usage</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {settings.emails_sent_today} / {settings.daily_send_limit}
                </span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    settings.emails_sent_today / settings.daily_send_limit > 0.9
                      ? 'bg-red-500'
                      : settings.emails_sent_today / settings.daily_send_limit > 0.7
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                  )}
                  style={{
                    width: `${Math.min((settings.emails_sent_today / settings.daily_send_limit) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {settings.daily_send_limit - settings.emails_sent_today} emails remaining today
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Related Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href="/crm/settings/signatures"
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-colors"
            >
              <FileSignature className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Manage Signatures
              </span>
            </Link>
            <Link
              href="/crm/settings/email-domains"
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-colors"
            >
              <Globe className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email Domains
              </span>
            </Link>
            <Link
              href="/crm/settings/templates"
              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-500 transition-colors"
            >
              <Mail className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email Templates
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
