import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, GripVertical, Pencil, Trash2, Star, AlertCircle } from 'lucide-react';
import { getCurrentProfile, getAllModules, getFieldsForModule } from '@/lib/crm/queries';
import type { CrmModule, CrmField } from '@/lib/crm/types';

interface PageProps {
  searchParams: Promise<{
    module?: string;
  }>;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  date: 'Date',
  datetime: 'Date & Time',
  select: 'Dropdown',
  multiselect: 'Multi-Select',
  boolean: 'Checkbox',
  email: 'Email',
  phone: 'Phone',
  url: 'URL',
  currency: 'Currency',
  lookup: 'Lookup',
  user: 'User',
};

function FieldRow({ field }: { field: CrmField }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg group">
      <button className="text-slate-500 hover:text-white cursor-grab">
        <GripVertical className="w-4 h-4" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{field.label}</span>
          {field.required && (
            <Star className="w-3 h-3 text-amber-400 fill-current" />
          )}
          {field.is_system && (
            <span className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded">
              System
            </span>
          )}
        </div>
        <span className="text-sm text-slate-500">{field.key}</span>
      </div>

      <span className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded">
        {FIELD_TYPE_LABELS[field.type] || field.type}
      </span>

      <span className="text-sm text-slate-400 w-24 text-right">
        {field.section}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!field.is_system && (
          <>
            <button className="p-1.5 text-slate-400 hover:text-white transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

async function FieldsContent({ searchParams }: PageProps) {
  const { module: moduleId } = await searchParams;
  
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  if (profile.crm_role !== 'crm_admin') {
    redirect('/crm/settings?error=admin_only');
  }

  const modules = await getAllModules(profile.organization_id);
  const selectedModule = moduleId 
    ? modules.find(m => m.id === moduleId) 
    : modules[0];
  
  const fields = selectedModule 
    ? await getFieldsForModule(selectedModule.id)
    : [];

  // Group fields by section
  const fieldsBySection = fields.reduce((acc, field) => {
    const section = field.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, CrmField[]>);

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
            <h1 className="text-2xl font-bold text-white">Fields</h1>
            <p className="text-slate-400 mt-1">
              Customize fields for each module
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          New Field
        </button>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {modules.map((module) => (
          <Link
            key={module.id}
            href={`/crm/settings/fields?module=${module.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedModule?.id === module.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {module.name}
          </Link>
        ))}
      </div>

      {/* Fields List */}
      {selectedModule ? (
        <div className="space-y-6">
          {Object.entries(fieldsBySection).map(([section, sectionFields]) => (
            <div key={section} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white capitalize">
                  {section} ({sectionFields.length})
                </h2>
              </div>
              <div className="p-3 space-y-1">
                {sectionFields.map((field) => (
                  <FieldRow key={field.id} field={field} />
                ))}
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-xl">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No fields configured for this module</p>
              <button className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
                Add the first field
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-800/50 border border-slate-700 rounded-xl">
          <p className="text-slate-400">Select a module to manage its fields</p>
        </div>
      )}
    </div>
  );
}

export default function FieldsPage(props: PageProps) {
  return (
    <Suspense fallback={<FieldsSkeleton />}>
      <FieldsContent {...props} />
    </Suspense>
  );
}

function FieldsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-800 rounded-lg" />
          <div className="space-y-2">
            <div className="h-8 w-24 bg-slate-800 rounded" />
            <div className="h-4 w-48 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-10 w-32 bg-slate-800 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 w-24 bg-slate-800 rounded-lg" />
        ))}
      </div>
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
