import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PipelineReportClient } from './client';

// Types
interface DealData {
  id: string;
  title: string;
  stage: string;
  data: {
    amount?: number;
    close_date?: string;
    probability?: number;
  } | null;
  stage_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StageHistoryData {
  id: string;
  record_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
}

interface PipelineStats {
  totalDeals: number;
  totalPipelineValue: number;
  avgDealSize: number;
  avgDaysInPipeline: number;
  winRate: number;
  avgDealVelocity: number;
}

interface StageData {
  stage: string;
  count: number;
  value: number;
  avgDaysInStage: number;
  conversionRate: number;
}

interface VelocityData {
  stage: string;
  avgDays: number;
}

interface AgingDeal {
  id: string;
  title: string;
  stage: string;
  value: number;
  daysInStage: number;
  risk: 'low' | 'medium' | 'high';
}

// Server-side calculations
function calculateStats(deals: DealData[]): PipelineStats {
  const now = new Date();
  const activeDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
  const closedWon = deals.filter(d => d.stage === 'Closed Won');
  const closedLost = deals.filter(d => d.stage === 'Closed Lost');

  const pipelineValue = activeDeals.reduce((sum, d) => sum + (d.data?.amount || 0), 0);
  const avgDealSize = deals.length > 0
    ? Math.round(deals.reduce((sum, d) => sum + (d.data?.amount || 0), 0) / deals.length)
    : 0;

  const daysInPipeline = activeDeals.map(d => {
    const created = new Date(d.created_at).getTime();
    return (now.getTime() - created) / (1000 * 60 * 60 * 24);
  });
  const avgDaysInPipeline = daysInPipeline.length > 0
    ? Math.round(daysInPipeline.reduce((a, b) => a + b, 0) / daysInPipeline.length)
    : 0;

  const totalClosed = closedWon.length + closedLost.length;
  const winRate = totalClosed > 0 ? Math.round((closedWon.length / totalClosed) * 100) : 0;

  const wonVelocities = closedWon.map(d => {
    const created = new Date(d.created_at).getTime();
    const closed = new Date(d.updated_at).getTime();
    return (closed - created) / (1000 * 60 * 60 * 24);
  });
  const avgVelocity = wonVelocities.length > 0
    ? Math.round(wonVelocities.reduce((a, b) => a + b, 0) / wonVelocities.length)
    : 0;

  return {
    totalDeals: deals.length,
    totalPipelineValue: pipelineValue,
    avgDealSize,
    avgDaysInPipeline,
    winRate,
    avgDealVelocity: avgVelocity,
  };
}

function calculateStageData(deals: DealData[], historyData: StageHistoryData[]): StageData[] {
  const now = new Date();
  const stageOrder = ['Qualification', 'Needs Analysis', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

  // Build stage map
  const stageMap = new Map<string, { deals: DealData[]; value: number }>();
  deals.forEach(deal => {
    const stage = deal.stage || 'Unknown';
    const existing = stageMap.get(stage) || { deals: [], value: 0 };
    existing.deals.push(deal);
    existing.value += deal.data?.amount || 0;
    stageMap.set(stage, existing);
  });

  // Build stage entry times from history
  const stageDurations = new Map<string, number[]>();
  const dealStageMap = new Map<string, { stage: string; entered: Date }[]>();

  historyData.forEach(h => {
    const dealHistory = dealStageMap.get(h.record_id) || [];
    dealHistory.push({
      stage: h.to_stage,
      entered: new Date(h.created_at),
    });
    dealStageMap.set(h.record_id, dealHistory);
  });

  // Calculate duration in each stage
  dealStageMap.forEach((history) => {
    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      const next = history[i + 1];
      const exitTime = next ? next.entered.getTime() : now.getTime();
      const duration = (exitTime - current.entered.getTime()) / (1000 * 60 * 60 * 24);

      const durations = stageDurations.get(current.stage) || [];
      durations.push(duration);
      stageDurations.set(current.stage, durations);
    }
  });

  return Array.from(stageMap.entries())
    .map(([stage, data]) => {
      const durations = stageDurations.get(stage) || [];
      const avgDaysInStage = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

      const nextStageIndex = stageOrder.indexOf(stage) + 1;
      let movedToNext = 0;
      if (nextStageIndex < stageOrder.length && stage !== 'Closed Won' && stage !== 'Closed Lost') {
        data.deals.forEach(deal => {
          const dealHistory = dealStageMap.get(deal.id) || [];
          const hasMovedForward = dealHistory.some(h => stageOrder.indexOf(h.stage) > stageOrder.indexOf(stage));
          if (hasMovedForward) movedToNext++;
        });
      }
      const conversionRate = data.deals.length > 0 ? Math.round((movedToNext / data.deals.length) * 100) : 0;

      return {
        stage,
        count: data.deals.length,
        value: data.value,
        avgDaysInStage,
        conversionRate: stage === 'Closed Won' || stage === 'Closed Lost' ? 0 : conversionRate,
      };
    })
    .sort((a, b) => {
      const aIdx = stageOrder.indexOf(a.stage);
      const bIdx = stageOrder.indexOf(b.stage);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
}

function calculateVelocityData(stageData: StageData[]): VelocityData[] {
  return stageData
    .filter(s => s.stage !== 'Closed Won' && s.stage !== 'Closed Lost')
    .map(s => ({
      stage: s.stage,
      avgDays: s.avgDaysInStage,
    }));
}

function calculateAgingDeals(deals: DealData[]): AgingDeal[] {
  const now = new Date();
  const activeDeals = deals.filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');

  return activeDeals
    .map(deal => {
      const stageUpdated = deal.stage_updated_at
        ? new Date(deal.stage_updated_at).getTime()
        : new Date(deal.created_at).getTime();
      const daysInStage = Math.floor((now.getTime() - stageUpdated) / (1000 * 60 * 60 * 24));

      let risk: 'low' | 'medium' | 'high' = 'low';
      if (daysInStage > 30) risk = 'high';
      else if (daysInStage > 14) risk = 'medium';

      return {
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        value: deal.data?.amount || 0,
        daysInStage,
        risk,
      };
    })
    .filter(d => d.daysInStage > 7)
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 5);
}

export default async function PipelineReportPage() {
  // Use cached profile lookup (single request, memoized)
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const supabase = await createServerSupabaseClient();

  // Get deals module
  const { data: dealsModuleData } = await supabase
    .from('crm_modules')
    .select('id')
    .eq('org_id', profile.organization_id)
    .eq('key', 'deals')
    .single();

  const dealsModuleId = (dealsModuleData as { id: string } | null)?.id;

  if (!dealsModuleId) {
    return (
      <PipelineReportClient
        stats={{
          totalDeals: 0,
          totalPipelineValue: 0,
          avgDealSize: 0,
          avgDaysInPipeline: 0,
          winRate: 0,
          avgDealVelocity: 0,
        }}
        stageData={[]}
        velocityData={[]}
        agingDeals={[]}
      />
    );
  }

  // Fetch deals
  const { data: dealsData } = await supabase
    .from('crm_records')
    .select('id, title, stage, data, stage_updated_at, created_at, updated_at')
    .eq('module_id', dealsModuleId)
    .order('created_at', { ascending: false });

  const deals = (dealsData || []) as unknown as DealData[];

  // Fetch stage history for velocity calculations (in parallel if deals exist)
  const dealIds = deals.map(d => d.id);
  let historyData: StageHistoryData[] = [];

  if (dealIds.length > 0) {
    const { data: stageHistory } = await supabase
      .from('crm_deal_stage_history')
      .select('id, record_id, from_stage, to_stage, created_at')
      .in('record_id', dealIds)
      .order('created_at', { ascending: true });

    historyData = (stageHistory || []) as StageHistoryData[];
  }

  // Calculate all data on the server
  const stats = calculateStats(deals);
  const stageData = calculateStageData(deals, historyData);
  const velocityData = calculateVelocityData(stageData);
  const agingDeals = calculateAgingDeals(deals);

  return (
    <PipelineReportClient
      stats={stats}
      stageData={stageData}
      velocityData={velocityData}
      agingDeals={agingDeals}
    />
  );
}
