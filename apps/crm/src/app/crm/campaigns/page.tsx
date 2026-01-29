'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Mail,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Copy,
  Trash2,
  BarChart2,
  Send,
  Users,
  Eye,
  MousePointer,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@crm-eco/ui/components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@crm-eco/ui/components/table';
import { cn } from '@crm-eco/ui/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Type Definitions
// ============================================================================

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  sent_count: number;
  created_at: string;
  created_by: string | null;
}

interface CampaignStats {
  total: number;
  draft: number;
  scheduled: number;
  sending: number;
  sent: number;
}

// ============================================================================
// Components
// ============================================================================

const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  color
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    teal: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', colorClasses[color])}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {value.toLocaleString()}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
});

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const statusConfig: Record<Campaign['status'], { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    sending: { label: 'Sending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    sent: { label: 'Sent', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    paused: { label: 'Paused', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  };

  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

const CampaignRow = memo(function CampaignRow({ campaign, onAction }: { campaign: Campaign; onAction: (action: string, id: string) => void }) {
  const progress = campaign.total_recipients > 0
    ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
    : 0;

  return (
    <TableRow className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <TableCell>
        <div>
          <Link
            href={`/crm/campaigns/${campaign.id}`}
            className="font-medium text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400"
          >
            {campaign.name}
          </Link>
          <div className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">
            {campaign.subject}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={campaign.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {campaign.total_recipients.toLocaleString()}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {campaign.status === 'sending' ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-20">
              <div
                className="h-full bg-teal-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">{progress}%</span>
          </div>
        ) : campaign.status === 'sent' ? (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600 dark:text-green-400">
              {campaign.sent_count.toLocaleString()} sent
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="text-sm text-slate-500 dark:text-slate-400" suppressHydrationWarning>
          {campaign.scheduled_at
            ? formatDistanceToNow(new Date(campaign.scheduled_at), { addSuffix: true })
            : campaign.completed_at
              ? formatDistanceToNow(new Date(campaign.completed_at), { addSuffix: true })
              : formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })
          }
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/crm/campaigns/${campaign.id}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <BarChart2 className="w-4 h-4" />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {campaign.status === 'draft' && (
                <DropdownMenuItem onClick={() => onAction('send', campaign.id)}>
                  <Send className="w-4 h-4 mr-2" />
                  Send Now
                </DropdownMenuItem>
              )}
              {campaign.status === 'sending' && (
                <DropdownMenuItem onClick={() => onAction('pause', campaign.id)}>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}
              {campaign.status === 'paused' && (
                <DropdownMenuItem onClick={() => onAction('resume', campaign.id)}>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onAction('duplicate', campaign.id)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onAction('delete', campaign.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats>({ total: 0, draft: 0, scheduled: 0, sending: 0, sent: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('org_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) return;

      const campaignList = (data || []) as Campaign[];
      setCampaigns(campaignList);

      // Calculate stats
      setStats({
        total: campaignList.length,
        draft: campaignList.filter(c => c.status === 'draft').length,
        scheduled: campaignList.filter(c => c.status === 'scheduled').length,
        sending: campaignList.filter(c => c.status === 'sending').length,
        sent: campaignList.filter(c => c.status === 'sent').length,
      });
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }

  const handleAction = useCallback(async (action: string, campaignId: string) => {
    setActionLoading(campaignId);

    try {
      switch (action) {
        case 'send': {
          // Start sending the campaign
          const response = await fetch(`/api/campaigns/${campaignId}/send`, {
            method: 'POST',
          });
          if (!response.ok) throw new Error('Failed to send campaign');
          break;
        }
        case 'pause': {
          // Pause the campaign
          const { error } = await supabase
            .from('email_campaigns')
            .update({ status: 'paused' })
            .eq('id', campaignId);
          if (error) throw error;
          break;
        }
        case 'resume': {
          // Resume paused campaign
          const { error } = await supabase
            .from('email_campaigns')
            .update({ status: 'sending' })
            .eq('id', campaignId);
          if (error) throw error;
          break;
        }
        case 'duplicate': {
          // Get original campaign
          const { data: original, error: fetchError } = await supabase
            .from('email_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single();
          if (fetchError || !original) throw fetchError || new Error('Campaign not found');

          // Create duplicate
          const { error: insertError } = await supabase
            .from('email_campaigns')
            .insert({
              ...original,
              id: undefined,
              name: `${original.name} (Copy)`,
              status: 'draft',
              scheduled_at: null,
              started_at: null,
              completed_at: null,
              sent_count: 0,
              created_at: new Date().toISOString(),
            });
          if (insertError) throw insertError;
          break;
        }
        case 'delete': {
          if (!confirm('Are you sure you want to delete this campaign?')) {
            setActionLoading(null);
            return;
          }
          const { error } = await supabase
            .from('email_campaigns')
            .delete()
            .eq('id', campaignId);
          if (error) throw error;
          break;
        }
      }
      // Refresh campaigns list
      loadCampaigns();
    } catch {
      // Error handled silently - could add toast notification here
    } finally {
      setActionLoading(null);
    }
  }, [supabase]);

  const filteredCampaigns = useMemo(() => campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [campaigns, searchQuery, statusFilter]);

  if (loading) {
    return <CampaignsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl">
            <Mail className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Email Campaigns
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Create and manage mass email campaigns
            </p>
          </div>
        </div>

        <Link href="/crm/campaigns/new">
          <Button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Campaigns"
          value={stats.total}
          icon={<Mail className="w-5 h-5" />}
          color="slate"
        />
        <StatCard
          label="Drafts"
          value={stats.draft}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Scheduled"
          value={stats.scheduled}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Sending"
          value={stats.sending}
          icon={<Send className="w-5 h-5" />}
          color="teal"
        />
        <StatCard
          label="Sent"
          value={stats.sent}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="sending">Sending</option>
              <option value="sent">Sent</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-16">
            <Mail className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match your filters'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {campaigns.length === 0
                ? 'Create your first email campaign to reach your contacts'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {campaigns.length === 0 && (
              <Link href="/crm/campaigns/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onAction={handleAction}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function CampaignsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        ))}
      </div>

      <div className="bg-slate-200 dark:bg-slate-800 rounded-xl h-96" />
    </div>
  );
}
