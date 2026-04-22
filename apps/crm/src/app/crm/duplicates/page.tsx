import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { verifyCrmAccess, createClient } from '@/lib/supabase-server';
import { DuplicatesClient, type CrmModuleSummary } from './DuplicatesClient';

export const dynamic = 'force-dynamic';

/**
 * /crm/duplicates — Review Duplicates
 *
 * Central place for admins and managers to work through pairs of
 * records that the bulk auto-merge left alone because both sides had
 * real history. Each pair can be merged (keeper-wins with Active
 * override) or dismissed ("these really are two different people").
 *
 * Data source: the `crm_probable_duplicates` view, scoped per-org by
 * security_invoker.
 */

async function DuplicatesPageContent() {
  let user, profile;
  try {
    const access = await verifyCrmAccess();
    user = access.user;
    profile = access.profile;
  } catch (err) {
    console.error('[Duplicates] Failed to verify access:', err);
    redirect('/crm-login');
  }

  if (!user || !profile) {
    redirect('/crm-login');
  }

  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm?error=admin_only');
  }

  // Pull modules so the client can render a module filter with names
  // (view only carries module_id).
  let modules: CrmModuleSummary[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('crm_modules')
      .select('id, key, name')
      .eq('org_id', profile.organization_id)
      .eq('is_enabled', true)
      .order('display_order');
    modules = (data || []) as CrmModuleSummary[];
  } catch (err) {
    console.error('[Duplicates] Failed to load modules:', err);
  }

  return (
    <DuplicatesClient
      modules={modules}
      canBulkMerge={profile.crm_role === 'crm_admin'}
    />
  );
}

function DuplicatesSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-64 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-96 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="w-40 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
      <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}

export default function DuplicatesPage() {
  return (
    <Suspense fallback={<DuplicatesSkeleton />}>
      <DuplicatesPageContent />
    </Suspense>
  );
}
