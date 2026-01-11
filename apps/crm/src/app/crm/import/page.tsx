import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet, Database } from 'lucide-react';
import { getCurrentProfile, getModules } from '@/lib/crm/queries';
import { ImportWizard } from './import-wizard';

interface PageProps {
  searchParams: Promise<{
    module?: string;
  }>;
}

async function ImportPageContent({ searchParams }: PageProps) {
  const { module: preselectedModule } = await searchParams;
  
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect('/crm-login');
  }

  // Check permission
  if (!profile.crm_role || !['crm_admin', 'crm_manager'].includes(profile.crm_role)) {
    redirect('/crm?error=no_import_permission');
  }

  const modules = await getModules(profile.organization_id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm"
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Import Data</h1>
          <p className="text-slate-400 mt-1">
            Import records from CSV files or paste data directly
          </p>
        </div>
      </div>

      {/* Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">CSV Import</h3>
              <p className="text-sm text-slate-400">Upload a CSV file</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Import records from a CSV file with column mapping and validation.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Database className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Paste Data</h3>
              <p className="text-sm text-slate-400">Copy & paste from spreadsheet</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Paste data directly from Excel or Google Sheets.
          </p>
        </div>
      </div>

      {/* Import Wizard */}
      <ImportWizard
        modules={modules}
        organizationId={profile.organization_id}
        preselectedModule={preselectedModule}
      />
    </div>
  );
}

export default function ImportPage(props: PageProps) {
  return (
    <Suspense fallback={<ImportSkeleton />}>
      <ImportPageContent {...props} />
    </Suspense>
  );
}

function ImportSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-800 rounded-lg" />
        <div className="space-y-2">
          <div className="h-8 w-40 bg-slate-800 rounded" />
          <div className="h-4 w-60 bg-slate-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-40 bg-slate-800/50 rounded-xl" />
        <div className="h-40 bg-slate-800/50 rounded-xl" />
      </div>
      <div className="h-96 bg-slate-800/50 rounded-xl" />
    </div>
  );
}
