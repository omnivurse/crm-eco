import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { 
  getCurrentProfile,
  getModuleByKey, 
  getFieldsForModule, 
  getViewsForModule,
  getDefaultView,
  getRecords,
} from '@/lib/crm/queries';
import { ModuleListClient } from './ModuleListClient';
import type { CrmModule, CrmField, CrmView, CrmRecord } from '@/lib/crm/types';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{
    view?: string;
    page?: string;
    search?: string;
  }>;
}

async function ModulePageContent({ params, searchParams }: PageProps) {
  const { moduleKey } = await params;
  const { page: pageStr, search, view: viewId } = await searchParams;
  
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const crmModule = await getModuleByKey(profile.organization_id, moduleKey);
  if (!crmModule) return notFound();

  const page = parseInt(pageStr || '1', 10);
  const pageSize = 25;

  const [fields, views] = await Promise.all([
    getFieldsForModule(crmModule.id),
    getViewsForModule(crmModule.id),
  ]);

  // Get current view
  let currentView: CrmView | null = null;
  if (viewId) {
    currentView = views.find(v => v.id === viewId) || null;
  }
  if (!currentView) {
    currentView = await getDefaultView(crmModule.id);
  }

  // Fetch records
  const { records, total } = await getRecords({
    moduleId: crmModule.id,
    page,
    pageSize,
    search,
    filters: currentView?.filters || [],
    sort: currentView?.sort || [],
  });

  const totalPages = Math.ceil(total / pageSize);

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
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="max-w-7xl mx-auto mt-4 glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing <span className="text-slate-900 dark:text-white font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
            <span className="text-slate-900 dark:text-white font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="text-slate-900 dark:text-white font-medium">{total.toLocaleString()}</span> results
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-50"
              disabled={page <= 1}
              asChild
            >
              <Link href={`/crm/modules/${crmModule.key}?page=${page - 1}`}>
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
                    href={`/crm/modules/${crmModule.key}?page=${pageNum}`}
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
              <Link href={`/crm/modules/${crmModule.key}?page=${page + 1}`}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
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
    <div className="max-w-7xl mx-auto space-y-4">
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
