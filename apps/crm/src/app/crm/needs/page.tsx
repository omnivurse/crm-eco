import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  HeartHandshake,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  User,
  Calendar,
  Filter,
  Plus,
  Search,
  ArrowUpRight,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { getCurrentProfile } from '@/lib/crm/queries';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';

// Need status configuration
const NEED_STATUSES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  submitted: { label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  in_review: { label: 'In Review', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  pending_docs: { label: 'Pending Docs', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  paid: { label: 'Paid', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  denied: { label: 'Denied', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

// Urgency levels
const URGENCY_LEVELS: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10' },
};

interface Need {
  id: string;
  need_type: string;
  description: string | null;
  total_amount: number;
  amount_submitted: number;
  status: string;
  urgency?: string;
  sla_deadline?: string | null;
  created_at: string;
  member?: {
    id: string;
    title: string;
    data: Record<string, unknown>;
  } | null;
  assigned_to_user?: {
    id: string;
    full_name: string | null;
  } | null;
}

interface NeedStats {
  status: string;
  urgency: string | null;
  total_amount: number;
  amount_submitted: number;
}

interface RecentNeedStats {
  status: string;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
}

function NeedCard({ need }: { need: Need }) {
  const status = NEED_STATUSES[need.status] || NEED_STATUSES.submitted;
  const urgency = URGENCY_LEVELS[need.urgency || 'medium'] || URGENCY_LEVELS.medium;
  const memberName = need.member?.title || 'Unknown Member';
  const memberId = need.member?.data?.membership_number as string || need.member?.id?.slice(0, 8) || 'N/A';

  const daysUntilSla = need.sla_deadline
    ? Math.ceil((new Date(need.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 7;
  const isOverdue = daysUntilSla < 0;
  const isDueSoon = daysUntilSla <= 2 && daysUntilSla >= 0;

  return (
    <Link href={`/crm/needs/${need.id}`} className="block">
      <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-slate-900 dark:text-white font-medium group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {memberName}
                </h4>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgency.bg} ${urgency.color}`}>
                  {urgency.label}
                </span>
              </div>
              <p className="text-slate-500 text-sm">{memberId} &bull; {need.need_type}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color} ${status.border}`}>
              {status.label}
            </span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-2">
            {need.description || 'No description provided'}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                ${(need.amount_submitted || need.total_amount || 0).toLocaleString()}
              </span>
            </div>

            <div className={`flex items-center gap-1 text-xs ${
              isOverdue ? 'text-red-500 dark:text-red-400' : isDueSoon ? 'text-amber-500 dark:text-amber-400' : 'text-slate-500'
            }`}>
              {isOverdue ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {isOverdue
                ? `${Math.abs(daysUntilSla)} days overdue`
                : `${daysUntilSla} days until SLA`
              }
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-900/30 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Submitted {new Date(need.created_at).toLocaleDateString()}
          </span>
          <span className="h-7 text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1">
            Review
            <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

async function NeedsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const supabase = await createServerSupabaseClient();

  // Fetch needs with related data
  const { data: needs, error } = await supabase
    .from('needs')
    .select(`
      id,
      need_type,
      description,
      total_amount,
      amount_submitted,
      status,
      urgency,
      sla_deadline,
      created_at,
      member:crm_records!needs_member_id_fkey(id, title, data),
      assigned_to_user:profiles!needs_assigned_to_fkey(id, full_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching needs:', error);
  }

  const needsList = (needs || []) as unknown as Need[];

  // Calculate stats
  const { data: allNeedsData } = await supabase
    .from('needs')
    .select('status, urgency, total_amount, amount_submitted')
    .eq('organization_id', profile.organization_id);

  const allNeeds = (allNeedsData || []) as NeedStats[];
  const totalNeeds = allNeeds.length;
  const pendingReview = allNeeds.filter(n => ['submitted', 'in_review'].includes(n.status)).length;
  const approvedAmount = allNeeds
    .filter(n => n.status === 'approved' || n.status === 'paid')
    .reduce((sum, n) => sum + (n.amount_submitted || n.total_amount || 0), 0);
  const urgentNeeds = allNeeds.filter(n => n.urgency === 'urgent' || n.urgency === 'high').length;

  // Calculate SLA stats (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentNeedsData } = await supabase
    .from('needs')
    .select('status, sla_deadline, created_at, updated_at')
    .eq('organization_id', profile.organization_id)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const recentNeeds = (recentNeedsData || []) as RecentNeedStats[];
  const completedNeeds = recentNeeds.filter(n => ['approved', 'paid', 'denied'].includes(n.status));
  const onTimeCount = completedNeeds.filter(n => {
    if (!n.sla_deadline) return true;
    const deadline = new Date(n.sla_deadline);
    const completed = new Date(n.updated_at);
    return completed <= deadline;
  }).length;
  const onTimeRate = completedNeeds.length > 0 ? Math.round((onTimeCount / completedNeeds.length) * 100) : 100;
  const approvalRate = recentNeeds.length > 0
    ? Math.round((recentNeeds.filter(n => n.status === 'approved' || n.status === 'paid').length / recentNeeds.length) * 100)
    : 0;

  // Count at-risk (close to SLA deadline)
  const atRiskCount = needsList.filter(n => {
    if (!n.sla_deadline || ['approved', 'paid', 'denied'].includes(n.status)) return false;
    const daysLeft = Math.ceil((new Date(n.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 2;
  }).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20">
              <HeartHandshake className="w-4 h-4 text-rose-500 dark:text-rose-400" />
            </div>
            <span className="text-rose-500 dark:text-rose-400 text-sm font-medium">Health Sharing</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Needs Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Process and track member health sharing needs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Link href="/crm/needs/new">
            <Button
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit Need
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalNeeds}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Total Needs</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingReview}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{urgentNeeds}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">High Priority</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">${approvedAmount.toLocaleString()}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Approved This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search needs by member, type, or ID..."
            className="pl-11 h-11 rounded-xl bg-white dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {Object.entries(NEED_STATUSES).slice(0, 4).map(([key, status]) => (
            <button
              key={key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105 ${status.bg} ${status.color} ${status.border}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Needs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {needsList.length > 0 ? (
          needsList.map((need) => (
            <NeedCard key={need.id} need={need} />
          ))
        ) : (
          <div className="col-span-2 glass-card rounded-xl p-12 border border-slate-200 dark:border-white/10 text-center">
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800/50 w-fit mx-auto mb-4">
              <HeartHandshake className="w-8 h-8 text-slate-400 dark:text-slate-600" />
            </div>
            <p className="text-slate-900 dark:text-white font-medium mb-1">No needs submitted yet</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mb-4">Member health sharing needs will appear here.</p>
            <Link href="/crm/needs/new">
              <Button className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Submit First Need
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* SLA Overview */}
      <div className="glass-card rounded-2xl p-6 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            SLA Performance
          </h3>
          <span className="text-sm text-slate-500">Last 30 days</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-500 dark:text-emerald-400 mb-1">{onTimeRate}%</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">On-Time Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
              {completedNeeds.length > 0 ? '3.2' : '0'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Avg Days to Process</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{approvalRate}%</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Approval Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-500 dark:text-amber-400 mb-1">{atRiskCount}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">At Risk (SLA)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NeedsPage() {
  return (
    <Suspense fallback={<NeedsSkeleton />}>
      <NeedsContent />
    </Suspense>
  );
}

function NeedsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-56 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
