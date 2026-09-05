'use client';

import DOMPurify from 'dompurify';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@crm-eco/ui/components/button';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { cn } from '@crm-eco/ui/lib/utils';
import {
  Mail,
  ArrowLeft,
  Send,
  Pause,
  Play,
  Copy,
  Trash2,
  Users,
  Eye,
  MousePointer,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart2,
  Link as LinkIcon,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { promptDialog } from '@crm-eco/ui/components/prompt-dialog';
import { toastCopy } from '@/lib/crm/toast-copy';
import type { EmailCampaign } from '@crm-eco/lib/types';

// ============================================================================
// Types
// ============================================================================

type Campaign = Pick<EmailCampaign, 'id' | 'name' | 'subject' | 'body_html' | 'from_name' | 'from_email' | 'reply_to' | 'scheduled_at' | 'started_at' | 'completed_at' | 'total_recipients' | 'sent_count' | 'created_at'> & {
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled' | 'failed';
};

interface CampaignStats {
  total_recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  pending: number;
  failed: number;
}

interface CampaignRates {
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsubscribe_rate: number;
}

interface TopLink {
  url: string;
  clicks: number;
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  rate,
  icon,
  color,
}: {
  label: string;
  value: number;
  rate?: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          {icon}
        </div>
        {rate !== undefined && (
          <span className="text-sm font-medium text-slate-500">{rate}%</span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    sending: { label: 'Sending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    sent: { label: 'Sent', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    paused: { label: 'Paused', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  };

  // Fall back rather than crash on an unmapped status.
  const config = statusConfig[status] ?? {
    label: String(status),
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <Badge variant="secondary" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [rates, setRates] = useState<CampaignRates | null>(null);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch(`/api/campaigns/${id}/stats`);
      if (!response.ok) throw new Error('Failed to load campaign');

      const data = await response.json();
      setCampaign(data.campaign);
      setStats(data.stats);
      setRates(data.rates);
      setTopLinks(data.topLinks || []);
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSendCampaign() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        // `detail` carries the actionable half when bulk sending is gated off.
        throw new Error(error.detail || error.error || 'Failed to send campaign');
      }
      toast.success('Campaign sending started');
      loadData(true);
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send campaign');
    } finally {
      setActionLoading(false);
    }
  }

  /**
   * One message to one address, through the same code path a real send uses.
   * Deliberately available before bulk delivery is unlocked.
   */
  async function handleTestSend() {
    if (!campaign) return;

    const address = await promptDialog({
      title: 'Send a test',
      description: 'Delivers one copy of this campaign. Recipients are not touched.',
      label: 'Send to',
      inputType: 'email',
      placeholder: 'you@example.com',
      confirmLabel: 'Send test',
      validate: (value) => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) ? null : 'Enter a valid email address'),
    });
    if (!address) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_email: address.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'Failed to send the test');
      }
      toast.success(toastCopy.saved('test send'));
    } catch (error) {
      console.error('Error sending test:', error);
      toast.error(
        toastCopy.failed(
          'send the test',
          undefined,
          error instanceof Error ? error.message : undefined,
        ),
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePauseCampaign() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paused' }),
      });
      if (!response.ok) {
        throw new Error('Failed to pause campaign');
      }
      toast.success('Campaign paused');
      loadData(true);
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast.error('Failed to pause campaign');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResumeCampaign() {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sending' }),
      });
      if (!response.ok) {
        throw new Error('Failed to resume campaign');
      }
      toast.success('Campaign resumed');
      loadData(true);
    } catch (error) {
      console.error('Error resuming campaign:', error);
      toast.error('Failed to resume campaign');
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // Auto-refresh for sending campaigns
    const interval = setInterval(() => {
      if (campaign?.status === 'sending') {
        loadData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [id, campaign?.status]);

  if (loading) {
    return <CampaignDetailSkeleton />;
  }

  if (!campaign || !stats || !rates) {
    return (
      <div className="text-center py-16">
        <Mail className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Campaign not found
        </h2>
        <Button variant="outline" asChild>
          <Link href="/crm/campaigns">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const totalRecipients = campaign.total_recipients ?? 0;
  const sentCount = campaign.sent_count ?? 0;
  const progress = totalRecipients > 0
    ? Math.round((sentCount / totalRecipients) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full mt-1" asChild>
            <Link href="/crm/campaigns">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {campaign.name}
              </h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Subject: {campaign.subject}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              From: {campaign.from_name ? `${campaign.from_name} <${campaign.from_email}>` : campaign.from_email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          {(campaign.status === 'draft' || campaign.status === 'failed') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSend}
              disabled={actionLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              Send test
            </Button>
          )}
          {campaign.status === 'draft' && (
            <Button
              size="sm"
              className="bg-gradient-to-r from-teal-500 to-cyan-500"
              onClick={handleSendCampaign}
              disabled={actionLoading}
            >
              <Send className="w-4 h-4 mr-2" />
              {actionLoading ? 'Sending...' : 'Send Now'}
            </Button>
          )}
          {campaign.status === 'sending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePauseCampaign}
              disabled={actionLoading}
            >
              <Pause className="w-4 h-4 mr-2" />
              {actionLoading ? 'Pausing...' : 'Pause'}
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button
              size="sm"
              onClick={handleResumeCampaign}
              disabled={actionLoading}
            >
              <Play className="w-4 h-4 mr-2" />
              {actionLoading ? 'Resuming...' : 'Resume'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar (for sending campaigns) */}
      {campaign.status === 'sending' && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Sending in progress...
            </span>
            <span className="text-sm text-slate-500">
              {sentCount.toLocaleString()} / {totalRecipients.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Recipients"
          value={stats.total_recipients}
          icon={<Users className="w-5 h-5" />}
          color="slate"
        />
        <StatCard
          label="Sent"
          value={stats.sent}
          icon={<Send className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          rate={rates.delivery_rate}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Opened"
          value={stats.opened}
          rate={rates.open_rate}
          icon={<Eye className="w-5 h-5" />}
          color="teal"
        />
        <StatCard
          label="Clicked"
          value={stats.clicked}
          rate={rates.click_rate}
          icon={<MousePointer className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Bounced"
          value={stats.bounced}
          rate={rates.bounce_rate}
          icon={<XCircle className="w-5 h-5" />}
          color="red"
        />
      </div>

      {/* Details & Top Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Details */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            Campaign Details
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-slate-900 dark:text-white">
                {campaign.created_at ? format(new Date(campaign.created_at), 'MMM d, yyyy h:mm a') : '—'}
              </dd>
            </div>
            {campaign.scheduled_at && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Scheduled</dt>
                <dd className="text-slate-900 dark:text-white">
                  {format(new Date(campaign.scheduled_at), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
            )}
            {campaign.started_at && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Started</dt>
                <dd className="text-slate-900 dark:text-white">
                  {format(new Date(campaign.started_at), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
            )}
            {campaign.completed_at && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Completed</dt>
                <dd className="text-slate-900 dark:text-white">
                  {format(new Date(campaign.completed_at), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
            )}
            {campaign.reply_to && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Reply-To</dt>
                <dd className="text-slate-900 dark:text-white">{campaign.reply_to}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Top Clicked Links */}
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            Top Clicked Links
          </h3>
          {topLinks.length > 0 ? (
            <div className="space-y-3">
              {topLinks.map((link, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <LinkIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {link.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-sm font-medium text-teal-600 dark:text-teal-400">
                      {link.clicks} clicks
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No link clicks recorded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Email Preview */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
          Email Preview
        </h3>
        <div
          className="prose dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(campaign.body_html || '') }}
        />
      </div>
    </div>
  );
}

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div>
          <div className="h-7 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}
