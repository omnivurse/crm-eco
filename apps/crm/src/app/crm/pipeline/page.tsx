import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Info } from 'lucide-react';
import { getCurrentProfile, getModuleByKey, getRecords, getDealStages } from '@/lib/crm/queries';
import { PipelineClient } from './PipelineClient';
import { PipelineToolbar } from './PipelineToolbar';
import type { CrmRecord, CrmDealStage, CrmModule, ViewFilter } from '@/lib/crm/types';

/** Batch size for pipeline board hydration (org-scoped `crm_records`). */
const PIPELINE_DEAL_PAGE_SIZE = 500;
/** Safety cap so one request cannot load unbounded rows into memory. */
const MAX_PIPELINE_DEALS_LOADED = 5000;

function parsePipelineRecordFilters(raw: string | undefined): ViewFilter[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is ViewFilter =>
        f != null &&
        typeof f === 'object' &&
        typeof (f as ViewFilter).field === 'string' &&
        typeof (f as ViewFilter).operator === 'string'
    );
  } catch {
    return [];
  }
}

function buildDealsModuleHref(q: {
  search?: string;
  filters?: string;
  scope?: string;
}): string {
  const p = new URLSearchParams();
  p.set('page', '1');
  if (q.search?.trim()) p.set('search', q.search.trim());
  if (q.filters) p.set('filters', q.filters);
  if (q.scope && (q.scope === 'mine' || q.scope === 'downline')) p.set('scope', q.scope);
  const qs = p.toString();
  return qs ? `/crm/modules/deals?${qs}` : '/crm/modules/deals';
}

/**
 * Loads deals for the kanban: pages through `getRecords` until exhausted or cap,
 * with an accurate `total` from the first page (`includeCount`).
 */
async function loadDealsForPipelineBoard(
  dealsModule: CrmModule,
  query: {
    filters: ViewFilter[];
    search?: string;
    scope?: 'all' | 'mine' | 'downline';
  }
): Promise<{
  deals: CrmRecord[];
  totalInDatabase: number;
  pipelineTruncated: boolean;
}> {
  const { filters, search, scope = 'all' } = query;
  const deals: CrmRecord[] = [];
  let totalInDatabase = 0;
  let page = 1;

  while (deals.length < MAX_PIPELINE_DEALS_LOADED) {
    const result = await getRecords({
      moduleId: dealsModule.id,
      orgId: dealsModule.org_id,
      page,
      pageSize: PIPELINE_DEAL_PAGE_SIZE,
      filters,
      search,
      scope,
      sort: [{ field: 'created_at', direction: 'desc' }],
      includeCount: page === 1,
    });

    if (page === 1) {
      totalInDatabase = result.total;
    }

    deals.push(...result.records);

    if (result.records.length < PIPELINE_DEAL_PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  const pipelineTruncated = totalInDatabase > deals.length;

  return { deals, totalInDatabase, pipelineTruncated };
}

interface PipelinePageSearchParams {
  search?: string;
  filters?: string;
  scope?: string;
}

async function PipelineContent({
  searchParams,
}: {
  searchParams: Promise<PipelinePageSearchParams>;
}) {
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[Pipeline] Failed to get profile:', err);
    redirect('/crm-login');
  }
  if (!profile) {
    redirect('/crm-login');
  }

  const sp = await searchParams;
  const recordFilters = parsePipelineRecordFilters(sp.filters);
  const search = sp.search?.trim() || undefined;
  const scopeRaw = sp.scope;
  const scope: 'all' | 'mine' | 'downline' =
    scopeRaw === 'mine' || scopeRaw === 'downline' ? scopeRaw : 'all';

  // Get deals module and stages
  let dealsModule;
  try {
    dealsModule = await getModuleByKey(profile.organization_id, 'deals');
  } catch (err) {
    console.error('[Pipeline] Failed to get deals module:', err);
  }

  let deals: CrmRecord[] = [];
  let stages: CrmDealStage[] = [];
  let totalDealsInDb = 0;
  let pipelineTruncated = false;

  if (dealsModule) {
    try {
      const [loadResult, stagesResult] = await Promise.all([
        loadDealsForPipelineBoard(dealsModule, {
          filters: recordFilters,
          search,
          scope,
        }),
        getDealStages(profile.organization_id),
      ]);

      deals = loadResult.deals;
      totalDealsInDb = loadResult.totalInDatabase;
      pipelineTruncated = loadResult.pipelineTruncated;
      stages = stagesResult;
    } catch (err) {
      console.error('[Pipeline] Failed to fetch deals/stages:', err);
    }
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

  // Surface stage values that exist on records but aren't in the configured
  // stage set. The "deals" module is repurposed as "Members" with enrollment
  // stages (Application / Under Review / Approved / Active / Terminated) that
  // don't match the classic deal stages, so those records would otherwise be
  // grouped into a column that's never rendered and vanish from the board.
  // Append a lightweight column for each unconfigured stage so nothing is lost.
  {
    const knownKeys = new Set(stages.map((s) => s.key));
    const seen = new Set<string>();
    for (const deal of deals) {
      const key = deal.stage;
      if (key && !knownKeys.has(key) && !seen.has(key)) {
        seen.add(key);
        stages.push({
          id: `derived-${key}`,
          org_id: profile.organization_id,
          key,
          name: key,
          color: '#94a3b8',
          probability: 0,
          is_won: false,
          is_lost: false,
          display_order: stages.length + 1,
          is_active: true,
          created_at: '',
          updated_at: '',
        });
      }
    }
  }

  // Create stage lookup map for O(1) access
  const stageMap = stages.reduce((acc, stage) => {
    acc[stage.key] = stage;
    return acc;
  }, {} as Record<string, CrmDealStage>);

  // Single-pass calculation for all stats (O(n) instead of O(n*m) with multiple filter/find operations)
  const stats = deals.reduce((acc, deal) => {
    const stage = stageMap[deal.stage || ''];
    const amount = Number(deal.data?.amount) || 0;

    // Group by stage
    if (deal.stage) {
      if (!acc.dealsByStage[deal.stage]) {
        acc.dealsByStage[deal.stage] = [];
      }
      acc.dealsByStage[deal.stage].push(deal);
    }

    if (stage) {
      if (stage.is_won) {
        acc.wonValue += amount;
        acc.wonDeals++;
      } else if (!stage.is_lost) {
        acc.totalPipelineValue += amount;
        acc.activeDeals++;
      }
    }

    return acc;
  }, {
    dealsByStage: {} as Record<string, CrmRecord[]>,
    totalPipelineValue: 0,
    wonValue: 0,
    activeDeals: 0,
    wonDeals: 0,
  });

  const { dealsByStage, totalPipelineValue, wonValue, activeDeals, wonDeals } = stats;
  const negotiationDeals = dealsByStage['negotiation']?.length || 0;
  /** When the board is partial, win rate is computed on loaded rows only so we do not imply org-wide accuracy. */
  const winRateDenominator = pipelineTruncated ? deals.length : totalDealsInDb;
  const winRate =
    winRateDenominator > 0 ? Math.round((wonDeals / winRateDenominator) * 100) : 0;
  const canEditStages =
    profile.crm_role === 'crm_admin' || profile.crm_role === 'crm_manager';
  const hasAnyLimit = stages.some((s) => s.wip_limit != null);
  const dealsModuleHref = buildDealsModuleHref({
    search: sp.search,
    filters: sp.filters,
    scope: sp.scope,
  });
  const stageOptions = stages
    .filter((s) => s.is_active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((s) => ({ key: s.key, name: s.name }));

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

        <PipelineToolbar stages={stageOptions} canEditStages={canEditStages} />
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
          <p className="text-slate-500 text-xs mt-1">
            {pipelineTruncated
              ? `Based on ${deals.length.toLocaleString()} newest loaded deals`
              : 'All deals in this org'}
          </p>
        </div>
      </div>

      {pipelineTruncated && dealsModule && (
        <div
          className="mb-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          role="status"
        >
          Showing the first{' '}
          <span className="font-semibold">{deals.length.toLocaleString()}</span> of{' '}
          <span className="font-semibold">{totalDealsInDb.toLocaleString()}</span>{' '}
          deals (newest first). Stats above reflect only these deals.{' '}
          <Link
            href={dealsModuleHref}
            className="font-medium underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
          >
            Open Deals
          </Link>{' '}
          to filter or export the full list.
        </div>
      )}

      {/* How it works — plain-English */}
      <div className="mb-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p>
              Each column below is a step in your sales process. Drag a deal
              card from one column to the next as it moves forward.
            </p>
            <p>
              {canEditStages ? (
                <>
                  Want a reminder when a column gets too full? Click the gear
                  icon on any column header and set an optional <em>limit</em>.
                  When the column reaches the limit the count turns
                  <span className="mx-1 px-1.5 py-0.5 rounded text-amber-700 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400 text-xs font-medium">amber</span>
                  ; if it goes over, it turns
                  <span className="mx-1 px-1.5 py-0.5 rounded text-red-700 bg-red-100 dark:bg-red-500/20 dark:text-red-400 text-xs font-medium">red</span>
                  . Limits are off by default — set one on a column only if you want it. Use the gear&rsquo;s &ldquo;Turn off&rdquo; button to remove a limit.
                </>
              ) : (
                <>
                  {hasAnyLimit
                    ? 'A column count turns amber when it reaches its limit and red if it goes over — that’s a cue that the team has too many deals in that stage.'
                    : 'Stage limits (the cap on how many deals a column should hold at once) can be set by an admin.'}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Board with Drag & Drop */}
      <div className="flex-1 overflow-x-auto pb-4">
        <PipelineClient deals={deals} stages={stages} canEditStages={canEditStages} />
      </div>
    </div>
  );
}

export default function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<PipelinePageSearchParams>;
}) {
  return (
    <Suspense fallback={<PipelineSkeleton />}>
      <PipelineContent searchParams={searchParams} />
    </Suspense>
  );
}

function PipelineSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 animate-pulse" />
        ))}
      </div>

      {/* Kanban skeleton */}
      <div className="flex gap-4 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="w-[300px] flex-shrink-0">
            <div className="h-16 bg-slate-100 dark:bg-slate-800/30 rounded-t-xl border border-slate-200 dark:border-white/5 animate-pulse" />
            <div className="h-[400px] bg-slate-50 dark:bg-slate-800/20 rounded-b-xl border border-slate-200 dark:border-white/5 border-t-0 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
