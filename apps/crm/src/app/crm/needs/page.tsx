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
  AlertCircle,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { getCurrentProfile } from '@/lib/crm/queries';

// Need status configuration
const NEED_STATUSES = [
  { key: 'submitted', label: 'Submitted', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { key: 'in_review', label: 'In Review', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { key: 'pending_docs', label: 'Pending Docs', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  { key: 'approved', label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { key: 'paid', label: 'Paid', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  { key: 'denied', label: 'Denied', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
];

// Urgency levels
const URGENCY_LEVELS = [
  { key: 'low', label: 'Low', color: 'text-slate-400', bg: 'bg-slate-500/10' },
  { key: 'medium', label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'high', label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { key: 'urgent', label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/10' },
];

// Mock needs data
const MOCK_NEEDS = [
  { 
    id: '1', 
    memberName: 'Robert Williams', 
    memberId: 'MBR-001234',
    type: 'Medical',
    description: 'Emergency room visit',
    amount: 4500,
    status: 'in_review',
    urgency: 'high',
    submittedAt: '2026-01-09',
    slaDeadline: '2026-01-16',
  },
  { 
    id: '2', 
    memberName: 'Emily Davis', 
    memberId: 'MBR-001567',
    type: 'Prescription',
    description: 'Monthly medication',
    amount: 320,
    status: 'approved',
    urgency: 'medium',
    submittedAt: '2026-01-08',
    slaDeadline: '2026-01-15',
  },
  { 
    id: '3', 
    memberName: 'James Wilson', 
    memberId: 'MBR-000892',
    type: 'Procedure',
    description: 'Outpatient surgery',
    amount: 12000,
    status: 'pending_docs',
    urgency: 'medium',
    submittedAt: '2026-01-07',
    slaDeadline: '2026-01-14',
  },
  { 
    id: '4', 
    memberName: 'Lisa Anderson', 
    memberId: 'MBR-002341',
    type: 'Medical',
    description: 'Specialist consultation',
    amount: 850,
    status: 'submitted',
    urgency: 'low',
    submittedAt: '2026-01-10',
    slaDeadline: '2026-01-17',
  },
];

function NeedCard({ need }: { need: typeof MOCK_NEEDS[0] }) {
  const status = NEED_STATUSES.find(s => s.key === need.status) || NEED_STATUSES[0];
  const urgency = URGENCY_LEVELS.find(u => u.key === need.urgency) || URGENCY_LEVELS[0];
  
  const daysUntilSla = Math.ceil((new Date(need.slaDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilSla < 0;
  const isDueSoon = daysUntilSla <= 2 && daysUntilSla >= 0;
  
  return (
    <Link href={`/crm/needs/${need.id}`} className="block">
      <div className="glass-card rounded-xl border border-white/10 hover:border-teal-500/30 transition-all group overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-white font-medium group-hover:text-teal-400 transition-colors">
                  {need.memberName}
                </h4>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgency.bg} ${urgency.color}`}>
                  {urgency.label}
                </span>
              </div>
              <p className="text-slate-500 text-sm">{need.memberId} • {need.type}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.color} ${status.border}`}>
              {status.label}
            </span>
          </div>
          
          <p className="text-slate-300 text-sm mb-4">{need.description}</p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span className="text-xl font-bold text-white">${need.amount.toLocaleString()}</span>
            </div>
            
            <div className={`flex items-center gap-1 text-xs ${
              isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-slate-500'
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
        
        <div className="px-5 py-3 bg-slate-900/30 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Submitted {new Date(need.submittedAt).toLocaleDateString()}
          </span>
          <span className="h-7 text-xs text-teal-400 flex items-center gap-1">
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

  // Calculate stats
  const totalNeeds = MOCK_NEEDS.length;
  const pendingReview = MOCK_NEEDS.filter(n => ['submitted', 'in_review'].includes(n.status)).length;
  const approvedAmount = MOCK_NEEDS
    .filter(n => n.status === 'approved' || n.status === 'paid')
    .reduce((sum, n) => sum + n.amount, 0);
  const urgentNeeds = MOCK_NEEDS.filter(n => n.urgency === 'urgent' || n.urgency === 'high').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20">
              <HeartHandshake className="w-4 h-4 text-rose-400" />
            </div>
            <span className="text-rose-400 text-sm font-medium">Health Sharing</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Needs Management</h1>
          <p className="text-slate-400 mt-0.5">
            Process and track member health sharing needs
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button 
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white glow-sm hover:glow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Submit Need
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalNeeds}</p>
              <p className="text-slate-400 text-sm">Total Needs</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingReview}</p>
              <p className="text-slate-400 text-sm">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{urgentNeeds}</p>
              <p className="text-slate-400 text-sm">High Priority</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">${approvedAmount.toLocaleString()}</p>
              <p className="text-slate-400 text-sm">Approved This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search needs by member, type, or ID..."
            className="pl-11 h-11 rounded-xl bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {NEED_STATUSES.slice(0, 4).map((status) => (
            <button
              key={status.key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105 ${status.bg} ${status.color} ${status.border}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Needs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK_NEEDS.map((need) => (
          <NeedCard key={need.id} need={need} />
        ))}
      </div>

      {/* SLA Overview */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            SLA Performance
          </h3>
          <span className="text-sm text-slate-500">Last 30 days</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400 mb-1">94%</p>
            <p className="text-slate-400 text-sm">On-Time Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">3.2</p>
            <p className="text-slate-400 text-sm">Avg Days to Process</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-white mb-1">87%</p>
            <p className="text-slate-400 text-sm">Approval Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-400 mb-1">2</p>
            <p className="text-slate-400 text-sm">At Risk (SLA)</p>
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
          <div className="h-5 w-32 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-56 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-800/30 rounded-xl border border-white/5 animate-pulse" />
        ))}
      </div>
      
      {/* Content skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-slate-800/30 rounded-xl border border-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
