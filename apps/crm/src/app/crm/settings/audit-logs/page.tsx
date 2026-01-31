import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { AuditLogsClient } from './client';

export const dynamic = 'force-dynamic';

async function getAuditData() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/crm-login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id, crm_role, full_name, email')
    .eq('user_id', user.id)
    .single() as { data: { id: string; organization_id: string; crm_role: string | null; full_name: string; email: string } | null };

  if (!profile) {
    redirect('/crm-login');
  }

  // Only admin and manager can view audit logs
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm/settings');
  }

  // Fetch initial audit logs
  const { data: initialLogs } = await supabase
    .from('unified_audit_logs')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Fetch users for filter dropdown
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', profile.organization_id)
    .eq('is_active', true)
    .order('full_name') as { data: { id: string; full_name: string; email: string }[] | null };

  return {
    profile,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialLogs: (initialLogs || []) as any[],
    users: users || [],
  };
}

function AuditLogsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
          <div className="space-y-2">
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-48 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-24 h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Filters Skeleton */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-white/10">
        <div className="flex-1 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="w-40 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="w-40 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="w-32 h-9 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900">
          <div className="w-9" />
          <div className="flex-1 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 dark:border-white/5"
          >
            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="w-48 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
            <div className="w-24 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-16 h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AuditLogsPage() {
  const { profile, initialLogs, users } = await getAuditData();

  return (
    <Suspense fallback={<AuditLogsSkeleton />}>
      <AuditLogsClient
        initialLogs={initialLogs}
        users={users}
        profile={profile}
      />
    </Suspense>
  );
}
