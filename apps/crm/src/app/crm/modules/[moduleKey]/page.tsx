import { Suspense, type ComponentType } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronLeft } from 'lucide-react';
import {
  getCachedCurrentProfile,
  getModuleByKey,
  getFieldsForModule,
  getViewsForModule,
  getDefaultView,
  getRecords,
  getCachedTerritories,
  getAdvisorsForTree,
  getAgentTreeData,
  getDealStages,
  createCrmClient,
} from '@/lib/crm/queries';
import type { AdvisorTreeData, AgentTreeData } from '@/lib/crm/queries';
import { ModuleListClient, type ListPagerModel } from './ModuleListClient';
import type { CrmModule, CrmField, CrmView, CrmRecord, ViewSort, ViewFilter, TreeGroupBy, CrmDealStage } from '@/lib/crm/types';
import { parseCrmRecordPageSize } from '@/lib/crm/record-list-constants';
import { habitPreferredViewId, resolveListQueryState } from '@/lib/crm/list-query-resolve';

/* ---------- Contacts tab components (lazy-loaded) ---------- */
const ContactGroups = dynamic(() => import('@/components/contacts/ContactGroups'));
const ContactSegments = dynamic(() => import('@/components/contacts/ContactSegments'));
const ContactLifecycle = dynamic(() => import('@/components/contacts/ContactLifecycle'));
const ContactMedicaid = dynamic(() => import('@/components/contacts/ContactMedicaid'));
const CarrierPlans = dynamic(() => import('@/components/contacts/CarrierPlans'));
const PremiumCompare = dynamic(() => import('@/components/contacts/PremiumCompare'));

const contactsTabComponents: Record<string, ComponentType> = {
  segments: ContactSegments,
  lifecycle: ContactLifecycle,
  medicaid: ContactMedicaid,
  carriers: CarrierPlans,
  premiums: PremiumCompare,
};

interface PageProps {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{
    view?: string;
    page?: string;
    page_size?: string;
    search?: string;
    scope?: 'all' | 'mine' | 'downline';
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    filters?: string;
    territory?: string;
    viewMode?: string;
    treeGroupBy?: TreeGroupBy;
    tab?: string;
  }>;
}

async function ModulePageContent({ params, searchParams }: PageProps) {
  const { moduleKey } = await params;
  const { page: pageStr, page_size: pageSizeParam, search, view: viewId, scope, sortField, sortDirection, filters: filtersParam, territory: territoryId, viewMode, treeGroupBy, tab } = await searchParams;
  
  let profile;
  try {
    profile = await getCachedCurrentProfile();
  } catch (err) {
    console.error('[ModulePage] Failed to get profile:', err);
    return notFound();
  }
  if (!profile) return notFound();

  // `?page=abc` / `?page=0` / `?page=-3` all render page 1 (never NaN in the pager).
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
  const pageSize = parseCrmRecordPageSize(pageSizeParam);

  // Step 1: module + territories in parallel (both only need org_id)
  const [moduleResult, territoriesResult] = await Promise.allSettled([
    getModuleByKey(profile.organization_id, moduleKey),
    getCachedTerritories(profile.organization_id),
  ]);

  let crmModule = moduleResult.status === 'fulfilled' ? moduleResult.value : null;
  const territories = territoriesResult.status === 'fulfilled' ? territoriesResult.value : [];

  // Compatibility fallback:
  // Some production orgs have records under the "members" module while users navigate
  // to /crm/modules/contacts. If contacts is missing, use members as a source.
  if (!crmModule && moduleKey === 'contacts') {
    try {
      const membersModule = await getModuleByKey(profile.organization_id, 'members');
      if (membersModule) {
        crmModule = {
          ...membersModule,
          key: 'contacts',
          name: 'Contact',
          name_plural: 'Contacts',
        };
      }
    } catch (err) {
      console.error('[ModulePage] Failed to resolve contacts fallback module:', err);
    }
  }

  // If the module is disabled (e.g. PIFH's vestigial `deals` and `prospects`
  // duplicates), redirect to a sibling enabled module with the same display
  // name so old bookmarks and stale links don't dead-end on a 0-record page.
  //
  // NOTE: `redirect()` throws NEXT_REDIRECT, so it must be called OUTSIDE the
  // try/catch — otherwise the catch swallows it and the disabled module renders.
  if (crmModule && crmModule.is_enabled === false) {
    let siblingKey: string | null = null;
    try {
      const supabase = await createCrmClient();
      const { data: sibling } = await supabase
        .from('crm_modules')
        .select('key')
        .eq('org_id', profile.organization_id)
        .eq('is_enabled', true)
        .eq('name_plural', crmModule.name_plural ?? '')
        .neq('id', crmModule.id)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      siblingKey = sibling?.key ?? null;
    } catch (err) {
      console.error('[ModulePage] Failed to resolve disabled module sibling:', err);
    }
    if (siblingKey) {
      redirect(`/crm/modules/${siblingKey}`);
    }
  }

  if (!crmModule) return notFound();

  // ---- Contacts sub-tab: render dedicated component and skip record queries ----
  if (moduleKey === 'contacts' && tab === 'groups') {
    const canManageContactGroups = ['crm_admin', 'crm_manager'].includes(
      ((profile as { crm_role?: string | null }).crm_role || '')
    );
    return (
      <div className="w-full space-y-3">
        <Link
          href="/crm/modules/contacts"
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Contacts
        </Link>
        <ContactGroups canManageGroups={canManageContactGroups} />
      </div>
    );
  }

  if (moduleKey === 'contacts' && tab) {
    const TabComponent = contactsTabComponents[tab];
    if (TabComponent) {
      return (
        <div className="w-full space-y-3">
          <Link
            href="/crm/modules/contacts"
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Contacts
          </Link>
          <TabComponent />
        </div>
      );
    }
  }

  // Step 2: fields, views, defaultView in parallel (need module_id)
  const [fieldsResult, viewsResult, defaultViewResult] = await Promise.allSettled([
    getFieldsForModule(crmModule.id),
    getViewsForModule(crmModule.id),
    getDefaultView(crmModule.id),
  ]);

  const fields = fieldsResult.status === 'fulfilled' ? fieldsResult.value : [];
  const views = viewsResult.status === 'fulfilled' ? viewsResult.value : [];
  const defaultView = defaultViewResult.status === 'fulfilled' ? defaultViewResult.value : null;

  // Resolve current view + sort + filters (sync — no extra await). URL
  // ?view= wins, then the habit-preferred view, then the module default; URL
  // sort/filters override the view's. Shared with the ids-only "Select all N"
  // endpoint (lib/crm/list-query-resolve.ts) so both read the URL identically.
  const listState = resolveListQueryState({
    views,
    defaultView,
    habitViewId: habitPreferredViewId(profile.ui_preferences, moduleKey),
    url: { view: viewId, search, scope, sortField, sortDirection, filters: filtersParam, territory: territoryId },
  });
  const currentView: CrmView | null = listState.currentView;
  const sort: ViewSort[] = listState.sort;
  const filters: ViewFilter[] = listState.filters;

  // Step 3: fetch records (needs resolved sort/filters from views)
  let recordsModuleId = crmModule.id;
  let records: CrmRecord[] = [];
  let total = 0;
  // The rows query threw: zero rows then means "unknown", not "empty" — the
  // client renders "Couldn't load {noun}" + Try again instead of the Create CTA.
  let loadError = false;
  try {
    const result = await getRecords({
      moduleId: crmModule.id,
      orgId: crmModule.org_id,
      moduleKey,
      page,
      pageSize,
      search: listState.search,
      searchDataJsonKeys: fields.map((f) => f.key),
      filters,
      sort,
      scope: listState.scope,
      territoryId: listState.territoryId,
    });
    records = result.records;
    total = result.total;
  } catch (err) {
    console.error('[ModulePage] Failed to fetch records:', err);
    loadError = true;
  }

  // Compatibility fallback:
  // If contacts exists but has no rows, try reading from members records.
  if (moduleKey === 'contacts' && total === 0) {
    try {
      const membersModule = await getModuleByKey(profile.organization_id, 'members');
      if (membersModule && membersModule.id !== crmModule.id) {
        const fallback = await getRecords({
          moduleId: membersModule.id,
          orgId: membersModule.org_id,
          page,
          pageSize,
          search: listState.search,
          filters,
          sort,
          scope: listState.scope,
          territoryId: listState.territoryId,
        });

        if (fallback.total > 0) {
          recordsModuleId = membersModule.id;
          records = fallback.records;
          total = fallback.total;
          loadError = false;
          console.warn('[ModulePage] Using contacts fallback records from members module', {
            organizationId: profile.organization_id,
            membersModuleId: membersModule.id,
            contactsModuleId: crmModule.id,
            total: fallback.total,
          });
        }
      }
    } catch (err) {
      console.error('[ModulePage] Failed contacts->members record fallback:', err);
    }
  }

  // Step 4: fetch tree data when in tree view mode
  const role = (profile as any).role || '';
  const crmRole = (profile as any).crm_role || '';
  const isAdmin = ['owner', 'admin', 'super_admin', 'staff'].includes(role)
    || ['crm_admin', 'crm_manager'].includes(crmRole);
  const userAdvisorId = (profile as any).advisor_id || null;

  let advisorTreeData: AdvisorTreeData | null = null;
  let agentTreeData: AgentTreeData | null = null;

  if (viewMode === 'tree' && treeGroupBy === 'advisor') {
    try {
      advisorTreeData = await getAdvisorsForTree(
        profile.organization_id,
        recordsModuleId,
        userAdvisorId,
        isAdmin,
      );
    } catch (err) {
      console.error('[ModulePage] Failed to fetch advisor tree:', err);
    }
  }

  if (viewMode === 'tree' && treeGroupBy === 'agent') {
    try {
      agentTreeData = await getAgentTreeData(
        profile.organization_id,
        recordsModuleId,
        profile.id,
        userAdvisorId,
        isAdmin,
      );
    } catch (err) {
      console.error('[ModulePage] Failed to fetch agent tree:', err);
    }
  }

  // Deal stages power the kanban pipeline columns for the deals module. We
  // fetch them server-side so the first paint of the board has real stage
  // order / probability / color instead of inferring from record values.
  let dealStages: CrmDealStage[] = [];
  if (crmModule.key === 'deals') {
    try {
      dealStages = await getDealStages(profile.organization_id);
    } catch (err) {
      console.error('[ModulePage] Failed to fetch deal stages:', err);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  // Pager links carry every list param except paging itself (the client
  // ListPager writes page / page_size — same contract the old server links
  // used, and what `forwardListUrlQueryParams` / the ids endpoint read).
  const baseQuery: Record<string, string> = {};
  if (viewId) baseQuery.view = viewId;
  if (search) baseQuery.search = search;
  if (scope) baseQuery.scope = scope;
  if (sortField) baseQuery.sortField = sortField;
  if (sortDirection) baseQuery.sortDirection = sortDirection;
  if (filtersParam) baseQuery.filters = filtersParam;
  if (territoryId) baseQuery.territory = territoryId;
  if (viewMode) baseQuery.viewMode = viewMode;
  if (treeGroupBy) baseQuery.treeGroupBy = treeGroupBy;

  // One noun for the total — the same module noun the chips and the empty
  // state use ("Showing 1 to 25 of 35 contacts").
  const pager: ListPagerModel | null = total > 0
    ? {
        page,
        pageSize,
        total,
        totalPages,
        moduleKey,
        baseQuery,
        noun: {
          one: (crmModule.name || 'record').toLowerCase(),
          other: (crmModule.name_plural || 'records').toLowerCase(),
        },
      }
    : null;

  return (
    <>
      {/* Client-side interactive shell with drawer */}
      <ModuleListClient
        module={crmModule}
        records={records}
        fields={fields}
        views={views}
        activeViewId={currentView?.id}
        totalCount={total}
        userRole={(profile as any).role || null}
        territories={territories}
        advisorTreeData={advisorTreeData}
        agentTreeData={agentTreeData}
        treeGroupBy={treeGroupBy}
        dealStages={dealStages}
        moduleSearch={search ?? ''}
        pager={pager}
        loadError={loadError}
        viewerId={profile.id}
      />
    </>
  );
}

export default function ModulePage(props: PageProps) {
  return (
    <Suspense fallback={<ModuleSkeleton />}>
      <ModulePageContent {...props} />
    </Suspense>
  );
}

function ModuleSkeleton() {
  return (
    <div className="w-full space-y-3">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800/50 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="h-9 w-20 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800/50 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* Toolbar skeleton */}
      <div className="h-14 bg-slate-100 dark:bg-slate-800/30 rounded-xl animate-pulse border border-slate-200 dark:border-white/5" />
      
      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="h-11 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/5" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 border-b border-slate-100 dark:border-white/5 flex items-center px-4 gap-4 animate-pulse">
            <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
