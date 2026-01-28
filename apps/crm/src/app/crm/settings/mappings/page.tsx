import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileSpreadsheet, Trash2, Download, Calendar } from 'lucide-react';
import { getCurrentProfile, getAllModules, createCrmClient } from '@/lib/crm/queries';
import type { CrmModule, CrmImportMapping } from '@/lib/crm/types';

async function MappingsContent() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  const supabase = await createCrmClient();
  const modules = await getAllModules(profile.organization_id);

  // Fetch import mappings
  const { data: mappings } = await supabase
    .from('crm_import_mappings')
    .select('*')
    .eq('org_id', profile.organization_id)
    .order('created_at', { ascending: false });

  // Create module lookup
  const moduleMap = new Map(modules.map(m => [m.id, m]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/crm/settings"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Import Mappings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Saved column mapping templates for quick imports
            </p>
          </div>
        </div>
        <Link
          href="/crm/import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Import
        </Link>
      </div>

      {/* Mappings List */}
      {mappings && mappings.length > 0 ? (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {mappings.length} Saved Mappings
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {mappings.map((mapping: CrmImportMapping) => {
              const mappingModule = moduleMap.get(mapping.module_id);
              const fieldCount = Object.keys(mapping.mapping || {}).length;

              return (
                <div key={mapping.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900 dark:text-white font-medium">{mapping.name}</span>
                      {mapping.is_default && (
                        <span className="px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <span>{mappingModule?.name || 'Unknown Module'}</span>
                      <span>•</span>
                      <span>{fieldCount} fields mapped</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(mapping.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Use This Mapping">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <FileSpreadsheet className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">No saved import mappings</p>
          <p className="text-sm text-slate-500 mb-4">
            Mappings are saved automatically when you complete an import
          </p>
          <Link
            href="/crm/import"
            className="text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 text-sm"
          >
            Start an import
          </Link>
        </div>
      )}

      {/* Help */}
      <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong className="text-slate-700 dark:text-slate-300">Tip:</strong> Import mappings let you save
          column configurations for repeated imports. When you import from the same
          source (like Zoho CRM), your mappings will be applied automatically.
        </p>
      </div>
    </div>
  );
}

export default function MappingsPage() {
  return (
    <Suspense fallback={<MappingsSkeleton />}>
      <MappingsContent />
    </Suspense>
  );
}

function MappingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-40 bg-slate-800 rounded" />
            <div className="h-4 w-64 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>
      <div className="h-64 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
