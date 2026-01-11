import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileSpreadsheet, Database, Sparkles, Users, UserPlus } from 'lucide-react';
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/crm"
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
              <Upload className="w-4 h-4 text-teal-400" />
            </div>
            <span className="text-teal-400 text-sm font-medium">Import</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Import Data</h1>
          <p className="text-slate-400 mt-1">
            Import records from CSV files into your CRM
          </p>
        </div>
      </div>

      {/* Quick Import Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link 
          href="/crm/import?module=contacts"
          className="glass-card rounded-xl p-5 border border-white/10 hover:border-teal-500/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 group-hover:bg-teal-500/20 transition-colors">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Contacts</h3>
              <p className="text-slate-500 text-xs">Members & customers</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Import contact records with full member details.
          </p>
        </Link>

        <Link 
          href="/crm/import?module=leads"
          className="glass-card rounded-xl p-5 border border-white/10 hover:border-violet-500/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
              <UserPlus className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Leads</h3>
              <p className="text-slate-500 text-xs">Potential customers</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Import leads and prospects for follow-up.
          </p>
        </Link>

        <div className="glass-card rounded-xl p-5 border border-white/10 hover:border-amber-500/30 transition-all group cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Smart Import</h3>
              <p className="text-slate-500 text-xs">AI-powered</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Auto-detect module and map fields intelligently.
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-800/50 rounded-lg animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-24 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-8 w-40 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 w-60 bg-slate-800/50 rounded animate-pulse" />
        </div>
      </div>
      
      {/* Quick options skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-800/30 rounded-xl border border-white/5 animate-pulse" />
        ))}
      </div>
      
      {/* Wizard skeleton */}
      <div className="h-[500px] bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse" />
    </div>
  );
}
