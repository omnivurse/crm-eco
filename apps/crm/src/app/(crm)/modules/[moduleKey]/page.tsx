import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plus, Filter, Download, Upload, MoreHorizontal } from 'lucide-react';
import { 
  getCurrentProfile,
  getModuleByKey, 
  getFieldsForModule, 
  getViewsForModule,
  getDefaultView,
  getRecords,
} from '@/lib/crm/queries';
import { RecordTable } from '@/components/crm/records/RecordTable';
import type { CrmModule, CrmField, CrmView, CrmRecord } from '@/lib/crm/types';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
  searchParams: Promise<{
    view?: string;
    page?: string;
    search?: string;
  }>;
}

async function ModuleContent({ 
  module, 
  fields, 
  views,
  currentView,
  records,
  total,
  page,
  pageSize,
}: {
  module: CrmModule;
  fields: CrmField[];
  views: CrmView[];
  currentView: CrmView | null;
  records: CrmRecord[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const displayColumns = currentView?.columns || ['title', 'status', 'email', 'created_at'];
  
  // Map field keys to field objects for display
  const fieldMap = new Map(fields.map(f => [f.key, f]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{module.name_plural || module.name}</h1>
          <p className="text-slate-400 mt-1">
            {total.toLocaleString()} {total === 1 ? 'record' : 'records'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/crm/import?module=${module.key}`}
            className="inline-flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </Link>
          <button className="inline-flex items-center gap-2 px-3 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link
            href={`/crm/modules/${module.key}/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New {module.name}
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-4">
          {/* View Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">View:</span>
            <select 
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={currentView?.id || ''}
            >
              {views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Button */}
          <button className="inline-flex items-center gap-2 px-3 py-1.5 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg text-sm transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <button className="p-2 text-slate-400 hover:text-white transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Records Table */}
      <RecordTable
        records={records}
        fields={fields}
        displayColumns={displayColumns}
        moduleKey={module.key}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <p className="text-sm text-slate-400">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={`/crm/modules/${module.key}?page=${page - 1}`}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/crm/modules/${module.key}?page=${page + 1}`}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-slate-700 rounded-lg"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

async function ModulePageContent({ params, searchParams }: PageProps) {
  const { moduleKey } = await params;
  const { page: pageStr, search, view: viewId } = await searchParams;
  
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  const module = await getModuleByKey(profile.organization_id, moduleKey);
  if (!module) return notFound();

  const page = parseInt(pageStr || '1', 10);
  const pageSize = 25;

  const [fields, views] = await Promise.all([
    getFieldsForModule(module.id),
    getViewsForModule(module.id),
  ]);

  // Get current view
  let currentView: CrmView | null = null;
  if (viewId) {
    currentView = views.find(v => v.id === viewId) || null;
  }
  if (!currentView) {
    currentView = await getDefaultView(module.id);
  }

  // Fetch records
  const { records, total } = await getRecords({
    moduleId: module.id,
    page,
    pageSize,
    search,
    filters: currentView?.filters || [],
    sort: currentView?.sort || [],
  });

  return (
    <ModuleContent
      module={module}
      fields={fields}
      views={views}
      currentView={currentView}
      records={records}
      total={total}
      page={page}
      pageSize={pageSize}
    />
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
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-slate-800 rounded" />
          <div className="h-4 w-24 bg-slate-800 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-24 bg-slate-800 rounded-lg" />
          <div className="h-10 w-24 bg-slate-800 rounded-lg" />
          <div className="h-10 w-32 bg-slate-800 rounded-lg" />
        </div>
      </div>
      <div className="h-16 bg-slate-800/50 rounded-xl" />
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
