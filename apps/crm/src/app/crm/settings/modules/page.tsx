import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, GripVertical, ToggleLeft, ToggleRight, Pencil, Trash2 } from 'lucide-react';
import { getCurrentProfile, getAllModules } from '@/lib/crm/queries';
import type { CrmModule } from '@/lib/crm/types';

function ModuleRow({ module }: { module: CrmModule }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-lg group border border-slate-200 dark:border-transparent">
      <button className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-grab">
        <GripVertical className="w-5 h-5" />
      </button>
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 dark:text-white font-medium">{module.name}</span>
          {module.is_system && (
            <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
              System
            </span>
          )}
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{module.description || module.key}</span>
      </div>

      <div className="flex items-center gap-3">
        <button className={`${module.is_enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {module.is_enabled ? (
            <ToggleRight className="w-8 h-8" />
          ) : (
            <ToggleLeft className="w-8 h-8" />
          )}
        </button>
        
        <Link
          href={`/crm/settings/fields?module=${module.id}`}
          className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Edit Fields"
        >
          <Pencil className="w-4 h-4" />
        </Link>
        
        {!module.is_system && (
          <button
            className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete Module"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

async function ModulesContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const modules = await getAllModules(profile.organization_id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings"
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Modules</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Enable, disable, and configure CRM modules
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Module
        </button>
      </div>

      {/* Module List */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {modules.length} Modules
          </h2>
        </div>
        <div className="p-4 space-y-2">
          {modules.map((module) => (
            <ModuleRow key={module.id} module={module} />
          ))}
        </div>
      </div>

      {/* Help Text */}
      <div className="glass-card border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">Tip:</strong> System modules cannot be deleted, 
          but they can be disabled. Disabling a module hides it from the sidebar but 
          preserves all data.
        </p>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <Suspense fallback={<ModulesSkeleton />}>
      <ModulesContent />
    </Suspense>
  );
}

function ModulesSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-32 bg-slate-800 rounded" />
            <div className="h-4 w-48 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
