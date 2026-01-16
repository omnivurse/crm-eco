import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  TrendingUp, 
  Filter,
  Settings2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { getCurrentProfile, getModuleByKey, getRecords, getDealStages } from '@/lib/crm/queries';
import { PipelineClient } from './PipelineClient';
import type { CrmRecord, CrmDealStage } from '@/lib/crm/types';

async function PipelineContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  // Get deals module and stages
  const dealsModule = await getModuleByKey(profile.organization_id, 'deals');
  
  let deals: CrmRecord[] = [];
  let stages: CrmDealStage[] = [];
  let totalDeals = 0;
  
  if (dealsModule) {
    const [result, stagesResult] = await Promise.all([
      getRecords({
        moduleId: dealsModule.id,
        page: 1,
        pageSize: 100,
        filters: [],
        sort: [{ field: 'created_at', direction: 'desc' }],
      }),
      getDealStages(profile.organization_id),
    ]);
    
    deals = result.records;
    totalDeals = result.total;
    stages = stagesResult;
  }

  // If no stages exist, show a message to configure them
  if (stages.length === 0) {
    // Use default stages for display
    stages = [
      { id: '1', org_id: profile.organization_id, key: 'qualification', name: 'Qualification', color: '#8b5cf6', probability: 10, is_won: false, is_lost: false, display_order: 1, is_active: true, created_at: '', updated_at: '' },
      { id: '2', org_id: profile.organization_id, key: 'needs_analysis', name: 'Needs Analysis', color: '#6366f1', probability: 25, is_won: false, is_lost: false, display_order: 2, is_active: true, created_at: '', updated_at: '' },
      { id: '3', org_id: profile.organization_id, key: 'proposal', name: 'Proposal', color: '#3b82f6', probability: 50, is_won: false, is_lost: false, display_order: 3, is_active: true, created_at: '', updated_at: '' },
      { id: '4', org_id: profile.organization_id, key: 'negotiation', name: 'Negotiation', color: '#0ea5e9', probability: 75, is_won: false, is_lost: false, display_order: 4, is_active: true, created_at: '', updated_at: '' },
      { id: '5', org_id: profile.organization_id, key: 'closed_won', name: 'Closed Won', color: '#22c55e', probability: 100, is_won: true, is_lost: false, display_order: 5, is_active: true, created_at: '', updated_at: '' },
      { id: '6', org_id: profile.organization_id, key: 'closed_lost', name: 'Closed Lost', color: '#ef4444', probability: 0, is_won: false, is_lost: true, display_order: 6, is_active: true, created_at: '', updated_at: '' },
    ];
  }

  // Calculate stats
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.key] = deals.filter(d => d.stage === stage.key);
    return acc;
  }, {} as Record<string, CrmRecord[]>);

  const totalPipelineValue = deals
    .filter(d => {
      const stage = stages.find(s => s.key === d.stage);
      return stage && !stage.is_won && !stage.is_lost;
    })
    .reduce((sum, d) => sum + (Number(d.data?.amount) || 0), 0);

  const wonValue = deals
    .filter(d => {
      const stage = stages.find(s => s.key === d.stage);
      return stage?.is_won;
    })
    .reduce((sum, d) => sum + (Number(d.data?.amount) || 0), 0);

  const activeDeals = deals.filter(d => {
    const stage = stages.find(s => s.key === d.stage);
    return stage && !stage.is_won && !stage.is_lost;
  }).length;

  const wonDeals = deals.filter(d => {
    const stage = stages.find(s => s.key === d.stage);
    return stage?.is_won;
  }).length;

  const negotiationDeals = dealsByStage['negotiation']?.length || 0;
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Sales Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Deal Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
            Drag deals between stages to update their status
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button 
            variant="outline" 
            className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Customize
          </Button>
          <Button 
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-sm hover:shadow-md"
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
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Pipeline</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">${totalPipelineValue.toLocaleString()}</p>
          <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {activeDeals} active deals
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Won This Month</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${wonValue.toLocaleString()}</p>
          <p className="text-slate-500 text-xs mt-1">
            {wonDeals} deals closed
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">In Negotiation</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {negotiationDeals}
          </p>
          <p className="text-slate-500 text-xs mt-1">Ready to close</p>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {winRate}%
          </p>
          <p className="text-slate-500 text-xs mt-1">All time</p>
        </div>
      </div>

      {/* Pipeline Board with Drag & Drop */}
      <div className="flex-1 overflow-x-auto pb-4">
        <PipelineClient deals={deals} stages={stages} />
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
