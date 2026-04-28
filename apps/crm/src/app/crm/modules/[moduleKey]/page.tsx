import { Suspense, type ComponentType } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
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
import { ModuleListClient } from './ModuleListClient';
import type { CrmModule, CrmField, CrmView, CrmRecord, ViewSort, ViewFilter, TreeGroupBy, CrmDealStage } from '@/lib/crm/types';
import { CRM_RECORD_PAGE_SIZES, parseCrmRecordPageSize } from '@/lib/crm/record-list-constants';

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

  const page = parseInt(pageStr || '1', 10);
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
  if (crmModule && crmModule.is_enabled === false) {
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
      if (sibling?.key) {
        redirect(`/crm/modules/${sibling.key}`);
      }
    } catch (err) {
      console.error('[ModulePage] Failed to resolve disabled module sibling:', err);
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

  // Resolve current view (sync — no extra await)
  let currentView: CrmView | null = null;
  if (viewId) {
    currentView = views.find(v => v.id === viewId) || null;
  }
  if (!currentView) {
    currentView = defaultView;
  }

  // Build sort: URL params override view defaults
  let sort: ViewSort[] = currentView?.sort || [];
  if (sortField) {
    sort = [{ field: sortField, direction: sortDirection || 'asc' }];
  }

  // Build filters: URL params override view defaults
  let filters: ViewFilter[] = currentView?.filters || [];
  if (filtersParam) {
    try {
      const parsed = JSON.parse(filtersParam);
      if (Array.isArray(parsed) && parsed.length > 0) {
        filters = parsed;
      }
    } catch {
      // Invalid JSON, fall back to view filters
    }
  }

  // Step 3: fetch records (needs resolved sort/filters from views)
  let recordsModuleId = crmModule.id;
  let records: CrmRecord[] = [];
  let total = 0;
  try {
    const result = await getRecords({
      moduleId: crmModule.id,
      orgId: crmModule.org_id,
      page,
      pageSize,
      search,
      filters,
      sort,
      scope: scope || 'all',
      territoryId: territoryId || undefined,
    });
    records = result.records;
    total = result.total;
  } catch (err) {
    console.error('[ModulePage] Failed to fetch records:', err);
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
          search,
          filters,
          sort,
          scope: scope || 'all',
          territoryId: territoryId || undefined,
        });

        if (fallback.total > 0) {
          recordsModuleId = membersModule.id;
          records = fallback.records;
          total = fallback.total;
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

  const buildListQuery = (overrides: { page?: number; pageSize?: number }) => {
    const p = overrides.page ?? page;
    const sz = overrides.pageSize ?? pageSize;
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('page_size', String(sz));
    if (viewId) params.set('view', viewId);
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (sortField) params.set('sortField', sortField);
    if (sortDirection) params.set('sortDirection', sortDirection);
    if (filtersParam) params.set('filters', filtersParam);
    if (territoryId) params.set('territory', territoryId);
    if (viewMode) params.set('viewMode', viewMode);
    if (treeGroupBy) params.set('treeGroupBy', treeGroupBy);
    return `/crm/modules/${moduleKey}?${params.toString()}`;
  };

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
      />

      {/* Pagination + page size */}
      {total > 0 && (
        <div className="w-full mt-3 glass-card rounded-lg p-3 border border-slate-200 dark:border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="text-slate-900 dark:text-white font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
            <span className="text-slate-900 dark:text-white font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="text-slate-900 dark:text-white font-medium">{total.toLocaleString()}</span> results
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">Per page</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                {CRM_RECORD_PAGE_SIZES.map((sz) => (
                  <Link
                    key={sz}
                    href={buildListQuery({ page: 1, pageSize: sz })}
                    prefetch={false}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      pageSize === sz
                        ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300'
                        : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {sz}
                  </Link>
                ))}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-lg border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                  disabled={page <= 1}
                  asChild
                >
                  <Link href={buildListQuery({ page: page - 1 })} prefetch={false}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Link>
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Link
                        key={pageNum}
                        href={buildListQuery({ page: pageNum })}
                        prefetch={false}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                          pageNum === page
                            ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-lg border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
                  disabled={page >= totalPages}
                  asChild
                >
                  <Link href={buildListQuery({ page: page + 1 })} prefetch={false}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
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
