'use client';

import { useCallback, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { cn } from '@crm-eco/ui/lib/utils';
import { currentListReturnTo, withReturnTo } from '@/lib/crm/status-lanes';
import { toastCopy } from '@/lib/crm/toast-copy';
import { CRM_RECORD_PAGE_SIZES } from '@/lib/crm/record-list-constants';
import { ModuleShell, type ListPaneFooterContext } from '@/components/zoho/ModuleShell';
import { useModuleShellOptional } from '@/components/zoho/ModuleShellContext';
import { RecordTable } from '@/components/crm/records/RecordTable';
import { ListView } from '@/components/crm/views/ListView';
import { KanbanView } from '@/components/crm/views/KanbanView';
import { TimelineView } from '@/components/crm/views/TimelineView';
import { SplitView } from '@/components/crm/views/SplitView';
import { TreeView } from '@/components/crm/views/TreeView';
import { CalendarView } from '@/components/crm/views/CalendarView';
import type { CrmModule, CrmField, CrmView, CrmRecord, CrmTerritory, TreeGroupBy, CrmDealStage } from '@/lib/crm/types';
import type { AdvisorTreeData, AgentTreeData } from '@/lib/crm/queries';
import { pickDefaultListColumns } from '@/lib/crm/default-list-columns';

// Lazy-load ChartView (~150KB recharts) only when user switches to chart mode
const ChartView = dynamic(
  () => import('@/components/crm/views/ChartView').then(m => m.ChartView),
  { ssr: false }
);

interface ModuleListClientProps {
  module: CrmModule;
  records: CrmRecord[];
  fields: CrmField[];
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  userRole?: string | null;
  /** Available territories for territory filter */
  territories?: CrmTerritory[];
  /** Advisor tree data for tree view (advisor mode) */
  advisorTreeData?: AdvisorTreeData | null;
  /** Agent tree data for tree view (agent mode) */
  agentTreeData?: AgentTreeData | null;
  /** Which field the tree groups by */
  treeGroupBy?: TreeGroupBy;
  /** Deal stages — only provided for the deals module, powers kanban columns. */
  dealStages?: CrmDealStage[];
  /** Same as `?search=` / module toolbar — single source of truth for tree filtering */
  moduleSearch?: string;
  /** Pager model (server-computed); `null` when there are no rows. */
  pager?: ListPagerModel | null;
  /** The server query for rows threw — render the retry state, never the Create CTA (LS-2). */
  loadError?: boolean;
  /** Viewer's profile id — scopes remembered rail state / column widths (LS-8). */
  viewerId?: string | null;
  /**
   * `crm.lists.trim_surface` resolved server-side (LS-9 / decision D11).
   * `true` moves the Zoho-leftover related-module filters behind "Show all"
   * and the pipeline/schedule view modes behind "More views". Defaults to
   * `false` — the untrimmed surface — so nothing changes without the flag.
   */
  trimSurface?: boolean;
}

/* ---------- Pager (LS-7) ---------- */

export interface ListPagerModel {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  moduleKey: string;
  /** Every non-paging list param (view/search/scope/sort/filters/…) to carry on each link. */
  baseQuery: Record<string, string>;
  /** Module noun for "Showing X to Y of N {noun}" — one noun with the chips / empty state. */
  noun: { one: string; other: string };
}

function pagerHref(model: ListPagerModel, page: number, pageSize: number): string {
  const params = new URLSearchParams(model.baseQuery);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return `/crm/modules/${model.moduleKey}?${params.toString()}`;
}

/** Plain left-click → navigate inside the list transition; modified clicks keep Link semantics. */
function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/** Which page numbers the pager shows (at most five, centred on the current page). */
export function visiblePageNumbers(page: number, totalPages: number): number[] {
  const count = Math.min(5, totalPages);
  return Array.from({ length: count }, (_, i) => {
    if (totalPages <= 5 || page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });
}

export function ListPager({ model, navigate, isPending }: { model: ListPagerModel } & ListPaneFooterContext) {
  const { page, pageSize, total, totalPages } = model;
  const onLinkClick = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(e)) return;
    e.preventDefault();
    navigate(href);
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  const edgeLink = (disabled: boolean, href: string, testId: string, children: React.ReactNode) => (
    <Button
      variant="outline"
      size="sm"
      className="h-9 px-3 rounded-lg border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white aria-disabled:opacity-50 aria-disabled:pointer-events-none"
      asChild
    >
      <Link
        href={href}
        prefetch={false}
        data-testid={testId}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (e) => e.preventDefault() : onLinkClick(href)}
      >
        {children}
      </Link>
    </Button>
  );

  return (
    <nav
      aria-label="Pagination"
      aria-busy={isPending || undefined}
      data-testid="crm-pager"
      className="w-full glass-card rounded-lg p-2 border border-slate-200 dark:border-white/10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="crm-pager-showing" aria-live="polite">
        Showing <span className="text-slate-900 dark:text-white font-medium">{from.toLocaleString()}</span> to{' '}
        <span className="text-slate-900 dark:text-white font-medium">{to.toLocaleString()}</span> of{' '}
        <span className="text-slate-900 dark:text-white font-medium">{total.toLocaleString()}</span>{' '}
        {toastCopy.pluralize(model.noun, total)}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300" role="group" aria-label="Rows per page">
          <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">Per page</span>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            {CRM_RECORD_PAGE_SIZES.map((sz) => {
              const href = pagerHref(model, 1, sz);
              const selected = pageSize === sz;
              return (
                <Link
                  key={sz}
                  href={href}
                  prefetch={false}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`${sz} rows per page`}
                  data-testid="crm-pager-size"
                  data-size={sz}
                  onClick={onLinkClick(href)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300'
                      : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5',
                  )}
                >
                  {sz}
                </Link>
              );
            })}
          </div>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums" data-testid="crm-pager-page">
          Page {page.toLocaleString()} of {totalPages.toLocaleString()}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {edgeLink(prevDisabled, pagerHref(model, page - 1, pageSize), 'crm-pager-prev', (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" aria-hidden />
                Previous
              </>
            ))}

            <ol className="flex items-center gap-1 list-none m-0 p-0">
              {visiblePageNumbers(page, totalPages).map((pageNum) => {
                const href = pagerHref(model, pageNum, pageSize);
                const current = pageNum === page;
                return (
                  <li key={pageNum}>
                    <Link
                      href={href}
                      prefetch={false}
                      aria-current={current ? 'page' : undefined}
                      aria-label={`Page ${pageNum}`}
                      onClick={onLinkClick(href)}
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors',
                        current
                          ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5',
                      )}
                    >
                      {pageNum}
                    </Link>
                  </li>
                );
              })}
            </ol>

            {edgeLink(nextDisabled, pagerHref(model, page + 1, pageSize), 'crm-pager-next', (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
              </>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

// Inner component that consumes the ModuleShell context and renders the active view
function ModuleViewContent({
  records,
  fields,
  moduleKey,
  views,
  activeViewId,
  totalCount,
  advisorTreeData,
  agentTreeData,
  treeGroupBy,
  dealStages,
  moduleSearch,
  loadError,
  viewerId,
}: {
  records: CrmRecord[];
  fields: CrmField[];
  moduleKey: string;
  views: CrmView[];
  activeViewId?: string;
  totalCount: number;
  advisorTreeData?: AdvisorTreeData | null;
  agentTreeData?: AgentTreeData | null;
  treeGroupBy?: TreeGroupBy;
  dealStages?: CrmDealStage[];
  moduleSearch?: string;
  loadError?: boolean;
  viewerId?: string | null;
}) {
  const router = useRouter();
  const shellContext = useModuleShellOptional();

  // Row click carries the current list URL so the record page's Back returns
  // to the same filters/page (same as the title link).
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listReturnTo = currentListReturnTo(pathname, searchParams?.toString());
  const handleRowClick = useCallback((recordId: string) => {
    router.push(withReturnTo(`/crm/r/${recordId}`, listReturnTo));
  }, [router, listReturnTo]);

  // Use visibleColumns from context if available, otherwise fall back to the
  // active view's columns, then to a small identity-first default (never every
  // field — members has 91 and that produced a ~16k px wide table).
  const activeView = views.find(v => v.id === activeViewId);
  const viewColumns = activeView?.columns;
  // How many filters the active saved view applies — lets the empty state
  // say "No contacts match this saved view" (with a Leave-view action) only
  // when the view actually narrows the list, and use `totalCount` to tell a
  // page-out-of-range apart from a genuine no-match.
  const activeViewFilterCount = activeView ? (activeView.filters?.length ?? 0) : undefined;
  const displayColumns = shellContext?.visibleColumns ||
    (viewColumns && viewColumns.length > 0 ? viewColumns : undefined) ||
    pickDefaultListColumns(fields);

  // Use selection state from context if available
  const selectedIds = shellContext?.selectedIds || new Set<string>();
  const setSelectedIds = shellContext?.setSelectedIds || (() => {});

  // Wire sort from context to RecordTable
  const currentSort = shellContext?.sortField
    ? { field: shellContext.sortField, direction: shellContext.sortDirection }
    : undefined;
  const handleSort = shellContext?.handleSortChange;

  // Determine active view mode
  const viewMode = shellContext?.viewMode || 'table';

  switch (viewMode) {
    case 'list':
      return (
        <ListView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={handleRowClick}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          loadError={loadError}
          fillParent
        />
      );

    case 'kanban':
      return (
        <KanbanView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          stages={dealStages}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          loadError={loadError}
        />
      );

    case 'chart':
      return (
        <ChartView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
        />
      );

    case 'timeline':
      return (
        <TimelineView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
        />
      );

    case 'calendar':
      return (
        <CalendarView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          stages={dealStages}
        />
      );

    case 'split':
      return (
        <SplitView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          displayColumns={displayColumns}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onRowClick={handleRowClick}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          loadError={loadError}
          fillParent
        />
      );

    case 'tree':
      return (
        <TreeView
          records={records}
          fields={fields}
          moduleKey={moduleKey}
          moduleSearch={moduleSearch ?? ''}
          advisorTreeData={advisorTreeData}
          agentTreeData={agentTreeData}
          treeGroupBy={treeGroupBy}
          onRowClick={handleRowClick}
        />
      );

    case 'table':
    default:
      return (
        <RecordTable
          records={records}
          fields={fields}
          displayColumns={displayColumns}
          moduleKey={moduleKey}
          onRowClick={handleRowClick}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onSort={handleSort}
          currentSort={currentSort}
          onBulkDelete={shellContext?.requestDelete}
          totalCount={totalCount}
          activeViewFilterCount={activeViewFilterCount}
          loadError={loadError}
          viewerId={viewerId}
          fillParent
        />
      );
  }
}

function ModuleListContent({
  module,
  records,
  fields,
  views,
  activeViewId,
  totalCount,
  userRole,
  territories,
  advisorTreeData,
  agentTreeData,
  treeGroupBy,
  dealStages,
  moduleSearch,
  pager,
  loadError,
  viewerId,
  trimSurface = false,
}: ModuleListClientProps) {
  return (
    <ModuleShell
      key={module.key}
      module={module}
      records={records}
      fields={fields}
      views={views}
      activeViewId={activeViewId}
      totalCount={totalCount}
      userRole={userRole}
      territories={territories}
      viewerId={viewerId}
      trimSurface={trimSurface}
      paneFooter={pager ? (ctx) => <ListPager model={pager} {...ctx} /> : null}
    >
      <ModuleViewContent
        records={records}
        fields={fields}
        moduleKey={module.key}
        views={views}
        activeViewId={activeViewId}
        totalCount={totalCount}
        advisorTreeData={advisorTreeData}
        agentTreeData={agentTreeData}
        treeGroupBy={treeGroupBy}
        dealStages={dealStages}
        moduleSearch={moduleSearch}
        loadError={loadError}
        viewerId={viewerId}
      />
    </ModuleShell>
  );
}

export function ModuleListClient(props: ModuleListClientProps) {
  return <ModuleListContent {...props} />;
}
