import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Copy, Trash2, Layout as LayoutIcon, Check } from 'lucide-react';
import { getCurrentProfile, getAllModules, getLayoutsForModule } from '@/lib/crm/queries';
import type { CrmModule, CrmLayout } from '@/lib/crm/types';

interface PageProps {
  searchParams: Promise<{
    module?: string;
  }>;
}

function LayoutCard({ layout, moduleName }: { layout: CrmLayout; moduleName: string }) {
  const sections = layout.config?.sections || [];
  
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-medium">{layout.name}</h3>
          {layout.is_default && (
            <span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" />
              Default
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">{moduleName}</p>
      </div>
      
      <div className="p-4">
        <p className="text-xs text-slate-500 mb-2">Sections</p>
        <div className="space-y-1">
          {sections.slice(0, 4).map((section: { key: string; label: string; columns: number }) => (
            <div key={section.key} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-400/50" />
              <span className="text-slate-300">{section.label}</span>
              <span className="text-slate-500 text-xs">({section.columns} col)</span>
            </div>
          ))}
          {sections.length > 4 && (
            <p className="text-xs text-slate-500 mt-1">+{sections.length - 4} more</p>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-end gap-2">
        <button className="p-2 text-slate-400 hover:text-white transition-colors" title="Edit">
          <Pencil className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-400 hover:text-white transition-colors" title="Duplicate">
          <Copy className="w-4 h-4" />
        </button>
        {!layout.is_default && (
          <button className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

async function LayoutsContent({ searchParams }: PageProps) {
  const { module: moduleId } = await searchParams;
  
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const modules = await getAllModules(profile.organization_id);
  
  // Get layouts for all modules or selected module
  const layoutsWithModules: Array<{ layout: CrmLayout; moduleName: string }> = [];
  
  if (moduleId) {
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      const layouts = await getLayoutsForModule(moduleId);
      layouts.forEach(layout => {
        layoutsWithModules.push({ layout, moduleName: module.name });
      });
    }
  } else {
    for (const module of modules) {
      const layouts = await getLayoutsForModule(module.id);
      layouts.forEach(layout => {
        layoutsWithModules.push({ layout, moduleName: module.name });
      });
    }
  }

  const selectedModule = moduleId ? modules.find(m => m.id === moduleId) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Layouts</h1>
            <p className="text-slate-400 mt-1">
              Configure form layouts and section arrangements
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Layout
        </button>
      </div>

      {/* Module Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Link
          href="/crm/settings/layouts"
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            !moduleId
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          All Modules
        </Link>
        {modules.map((module) => (
          <Link
            key={module.id}
            href={`/crm/settings/layouts?module=${module.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              moduleId === module.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {module.name}
          </Link>
        ))}
      </div>

      {/* Layouts Grid */}
      {layoutsWithModules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layoutsWithModules.map(({ layout, moduleName }) => (
            <LayoutCard key={layout.id} layout={layout} moduleName={moduleName} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-xl">
          <LayoutIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            {selectedModule 
              ? `No layouts configured for ${selectedModule.name}`
              : 'No layouts configured'}
          </p>
          <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
            Create a layout
          </button>
        </div>
      )}
    </div>
  );
}

export default function LayoutsPage(props: PageProps) {
  return (
    <Suspense fallback={<LayoutsSkeleton />}>
      <LayoutsContent {...props} />
    </Suspense>
  );
}

function LayoutsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-24 bg-slate-800 rounded" />
            <div className="h-4 w-56 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-24 bg-slate-800 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-slate-800/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
