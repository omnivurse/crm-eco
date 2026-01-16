import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { 
  getCurrentProfile,
  getModuleByKey, 
  getFieldsForModule, 
  getDefaultLayout,
} from '@/lib/crm/queries';
import { createRecord, type CreateRecordInput } from '@/lib/crm/mutations';
import { DynamicRecordForm } from '@/components/crm/records/DynamicRecordForm';

interface PageProps {
  params: Promise<{ moduleKey: string }>;
}

async function NewRecordContent({ params }: PageProps) {
  const { moduleKey } = await params;
  
  const profile = await getCurrentProfile();
  if (!profile) return notFound();

  // Check permission
  if (!profile.crm_role || profile.crm_role === 'crm_viewer') {
    redirect(`/crm/modules/${moduleKey}?error=no_create_permission`);
  }

  const module = await getModuleByKey(profile.organization_id, moduleKey);
  if (!module) return notFound();

  const [fields, layout] = await Promise.all([
    getFieldsForModule(module.id),
    getDefaultLayout(module.id),
  ]);

  async function handleSubmit(formData: FormData) {
    'use server';
    
    const profile = await getCurrentProfile();
    if (!profile) throw new Error('Not authenticated');

    const module = await getModuleByKey(profile.organization_id, moduleKey);
    if (!module) throw new Error('Module not found');

    const data: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key !== '_action' && value !== '') {
        data[key] = value;
      }
    });

    const input: CreateRecordInput = {
      org_id: profile.organization_id,
      module_id: module.id,
      owner_id: profile.id,
      data,
    };

    const record = await createRecord(input);
    redirect(`/crm/r/${record.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/crm/modules/${moduleKey}`}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New {module.name}</h1>
          <p className="text-slate-400 mt-1">
            Create a new {module.name.toLowerCase()} record
          </p>
        </div>
      </div>

      {/* Form */}
      <form action={handleSubmit} className="space-y-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <DynamicRecordForm
            fields={fields}
            layout={layout || undefined}
            readOnly={false}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/crm/modules/${moduleKey}`}
            className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Create {module.name}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewRecordPage(props: PageProps) {
  return (
    <Suspense fallback={<NewRecordSkeleton />}>
      <NewRecordContent {...props} />
    </Suspense>
  );
}

function NewRecordSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-40 bg-slate-800 rounded" />
          <div className="h-4 w-60 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
