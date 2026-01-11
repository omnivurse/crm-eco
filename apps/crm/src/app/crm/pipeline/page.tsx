import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight,
  MoreHorizontal,
  Calendar,
  User,
  Filter,
  Settings2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleByKey, getRecords } from '@/lib/crm/queries';
import type { CrmRecord } from '@/lib/crm/types';

// Pipeline stages configuration
const PIPELINE_STAGES = [
  { key: 'Qualification', label: 'Qualification', color: 'from-slate-500 to-slate-600' },
  { key: 'Needs Analysis', label: 'Needs Analysis', color: 'from-blue-500 to-cyan-500' },
  { key: 'Proposal', label: 'Proposal', color: 'from-violet-500 to-purple-500' },
  { key: 'Negotiation', label: 'Negotiation', color: 'from-amber-500 to-orange-500' },
  { key: 'Closed Won', label: 'Closed Won', color: 'from-emerald-500 to-green-500' },
  { key: 'Closed Lost', label: 'Closed Lost', color: 'from-red-500 to-rose-500' },
];

function DealCard({ deal }: { deal: CrmRecord }) {
  const amount = Number(deal.data?.amount) || 0;
  const probability = Number(deal.data?.probability) || 0;
  const expectedClose = deal.data?.expected_close_date as string | undefined;
  
  return (
    <Link 
      href={`/crm/r/${deal.id}`}
      className="block p-4 glass-card rounded-xl border border-white/10 hover:border-teal-500/30 transition-all hover:scale-[1.02] cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-white font-medium text-sm group-hover:text-teal-400 transition-colors line-clamp-2">
          {deal.title || String(deal.data?.deal_name || 'Untitled Deal')}
        </h4>
        <button className="p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-2">
        {amount > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-lg font-bold text-white">
              ${amount.toLocaleString()}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs">
          {probability > 0 && (
            <span className="text-slate-400">
              {probability}% likely
            </span>
          )}
          {expectedClose && (
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-3 h-3" />
              {new Date(expectedClose).toLocaleDateString()}
            </span>
          )}
        </div>
        
        {deal.owner_id && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
              <User className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-xs text-slate-500">Assigned</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function PipelineColumn({ 
  stage, 
  deals,
  totalValue,
}: { 
  stage: typeof PIPELINE_STAGES[0];
  deals: CrmRecord[];
  totalValue: number;
}) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className="glass-card rounded-t-xl p-4 border border-white/10 border-b-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${stage.color}`} />
            <h3 className="text-white font-semibold text-sm">{stage.label}</h3>
          </div>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400">
            {deals.length}
          </span>
        </div>
        <div className="text-sm text-emerald-400 font-medium">
          ${totalValue.toLocaleString()}
        </div>
      </div>
      
      {/* Cards Container */}
      <div className="flex-1 glass rounded-b-xl border border-white/10 border-t-0 p-3 space-y-3 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-slate-600 text-sm">No deals in this stage</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))
        )}
        
        {/* Add Deal Button */}
        <button className="w-full p-3 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/50 transition-all flex items-center justify-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Add Deal
        </button>
      </div>
    </div>
  );
}

async function PipelineContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  // Get deals module
  const dealsModule = await getModuleByKey(profile.organization_id, 'deals');
  
  let deals: CrmRecord[] = [];
  let totalDeals = 0;
  
  if (dealsModule) {
    const result = await getRecords({
      moduleId: dealsModule.id,
      page: 1,
      pageSize: 100,
      filters: [],
      sort: [{ field: 'created_at', direction: 'desc' }],
    });
    deals = result.records;
    totalDeals = result.total;
  }

  // Group deals by stage
  const dealsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = deals.filter(d => String(d.data?.stage) === stage.key);
    return acc;
  }, {} as Record<string, CrmRecord[]>);

  // Calculate totals
  const totalPipelineValue = deals
    .filter(d => !['Closed Won', 'Closed Lost'].includes(String(d.data?.stage || '')))
    .reduce((sum, d) => sum + (Number(d.data?.amount) || 0), 0);

  const wonValue = deals
    .filter(d => d.data?.stage === 'Closed Won')
    .reduce((sum, d) => sum + (Number(d.data?.amount) || 0), 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-emerald-400 text-sm font-medium">Sales Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-slate-400 mt-0.5">
            Track and manage your sales opportunities
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
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Customize
          </Button>
          <Button 
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white glow-sm hover:glow-md"
            asChild
          >
            <Link href="/crm/modules/deals/new">
              <Plus className="w-4 h-4 mr-2" />
              New Deal
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <p className="text-slate-400 text-sm mb-1">Total Pipeline</p>
          <p className="text-2xl font-bold text-white">${totalPipelineValue.toLocaleString()}</p>
          <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {deals.filter(d => !['Closed Won', 'Closed Lost'].includes(String(d.data?.stage || ''))).length} active deals
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <p className="text-slate-400 text-sm mb-1">Won This Month</p>
          <p className="text-2xl font-bold text-emerald-400">${wonValue.toLocaleString()}</p>
          <p className="text-slate-500 text-xs mt-1">
            {dealsByStage['Closed Won']?.length || 0} deals closed
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <p className="text-slate-400 text-sm mb-1">In Negotiation</p>
          <p className="text-2xl font-bold text-amber-400">
            {dealsByStage['Negotiation']?.length || 0}
          </p>
          <p className="text-slate-500 text-xs mt-1">Ready to close</p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-white/10">
          <p className="text-slate-400 text-sm mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-white">
            {totalDeals > 0 
              ? Math.round((dealsByStage['Closed Won']?.length || 0) / totalDeals * 100)
              : 0}%
          </p>
          <p className="text-slate-500 text-xs mt-1">All time</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {PIPELINE_STAGES.filter(s => s.key !== 'Closed Lost').map((stage) => {
            const stageDeals = dealsByStage[stage.key] || [];
            const totalValue = stageDeals.reduce((sum, d) => sum + (Number(d.data?.amount) || 0), 0);
            
            return (
              <PipelineColumn 
                key={stage.key} 
                stage={stage} 
                deals={stageDeals}
                totalValue={totalValue}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineSkeleton />}>
      <PipelineContent />
    </Suspense>
  );
}

function PipelineSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-48 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-800/30 rounded-xl border border-white/5 animate-pulse" />
        ))}
      </div>
      
      {/* Kanban skeleton */}
      <div className="flex gap-4 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-[300px] flex-shrink-0">
            <div className="h-16 bg-slate-800/30 rounded-t-xl border border-white/5 animate-pulse" />
            <div className="h-[400px] bg-slate-800/20 rounded-b-xl border border-white/5 border-t-0 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
