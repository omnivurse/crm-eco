import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Filter, 
  Download, 
  Upload, 
  MoreHorizontal, 
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Users,
  UserPlus,
  DollarSign,
  Building2,
} from 'lucide-react';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
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

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <Users className="w-6 h-6" />,
  leads: <UserPlus className="w-6 h-6" />,
  deals: <DollarSign className="w-6 h-6" />,
  accounts: <Building2 className="w-6 h-6" />,
};

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  contacts: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  leads: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/30' },
  deals: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  accounts: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

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
  const icon = MODULE_ICONS[module.key] || <Users className="w-6 h-6" />;
  const colors = MODULE_COLORS[module.key] || MODULE_COLORS.contacts;
  
  // Map field keys to field objects for display
  const fieldMap = new Map(fields.map(f => [f.key, f]));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${colors.bg} ${colors.text}`}>
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{module.name_plural || module.name}</h1>
            <p className="text-slate-400 mt-0.5">
              {total.toLocaleString()} {total === 1 ? 'record' : 'records'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            asChild
          >
            <Link href={`/crm/import?module=${module.key}`}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="glass border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white glow-sm hover:glow-md transition-all"
            asChild
          >
            <Link href={`/crm/modules/${module.key}/new`}>
              <Plus className="w-4 h-4 mr-2" />
              New {module.name}
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="search"
              placeholder={`Search ${module.name_plural?.toLowerCase() || 'records'}...`}
              className="pl-11 h-10 rounded-xl bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500 focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 hidden sm:inline">View:</span>
              <select 
                className="h-10 px-3 rounded-xl bg-slate-900/50 border border-white/10 text-sm text-white focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                defaultValue={currentView?.id || ''}
              >
                {views.length > 0 ? (
                  views.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))
                ) : (
                  <option value="">All {module.name_plural || 'Records'}</option>
                )}
              </select>
            </div>

            {/* Filters */}
            <Button 
              variant="outline" 
              className="h-10 px-3 rounded-xl bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>

            {/* View Toggle */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-slate-900/50 border border-white/10">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-md text-white hover:bg-white/10"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-md text-slate-500 hover:text-white hover:bg-white/10"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>

            {/* More Options */}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>
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
        <div className="glass-card rounded-xl p-4 border border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing <span className="text-white font-medium">{((page - 1) * pageSize) + 1}</span> to{' '}
            <span className="text-white font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="text-white font-medium">{total.toLocaleString()}</span> results
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-lg bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-50"
              disabled={page <= 1}
              asChild
            >
              <Link href={`/crm/modules/${module.key}?page=${page - 1}`}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Link>
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Page numbers */}
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
                    href={`/crm/modules/${module.key}?page=${pageNum}`}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                      pageNum === page
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
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
              className="h-9 px-3 rounded-lg bg-slate-900/50 border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-50"
              disabled={page >= totalPages}
              asChild
            >
              <Link href={`/crm/modules/${module.key}?page=${page + 1}`}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-800/50 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
            <div className="h-4 w-24 bg-slate-800/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-slate-800/50 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-800/50 rounded-lg animate-pulse" />
        </div>
      </div>
      
      {/* Toolbar skeleton */}
      <div className="h-16 bg-slate-800/30 rounded-2xl animate-pulse border border-white/5" />
      
      {/* Table skeleton */}
      <div className="bg-slate-800/30 rounded-2xl border border-white/5 overflow-hidden">
        <div className="h-12 bg-slate-800/50 border-b border-white/5" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 border-b border-white/5 flex items-center px-4 gap-4 animate-pulse">
            <div className="w-5 h-5 bg-slate-700 rounded" />
            <div className="flex-1 h-4 bg-slate-700 rounded" />
            <div className="w-24 h-4 bg-slate-700 rounded" />
            <div className="w-20 h-4 bg-slate-700 rounded" />
            <div className="w-16 h-4 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
