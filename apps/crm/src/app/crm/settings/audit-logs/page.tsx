import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { verifyCrmAccess, createClient } from '@/lib/supabase-server';
import { AuditLogsClient } from './client';

export const dynamic = 'force-dynamic';

async function AuditLogsContent() {
  let user, profile;
  try {
    const access = await verifyCrmAccess();
    user = access.user;
    profile = access.profile;
  } catch (err) {
    console.error('[AuditLogs] Failed to verify access:', err);
    redirect('/crm-login');
  }

  if (!user || !profile) {
    redirect('/crm-login');
  }

  // Only admin and manager can view audit logs
  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    redirect('/crm/settings');
  }

  // Get Supabase client for queries (also request-scoped cached)
  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    console.error('[AuditLogs] Failed to create client:', err);
    redirect('/crm-login');
  }

  // Fetch initial audit logs
  let initialLogs: any[] = [];
  try {
    const { data } = await supabase
      .from('unified_audit_logs')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(100);
    initialLogs = (data || []) as any[];
  } catch (err) {
    console.error('[AuditLogs] Failed to fetch logs:', err);
  }

  // Fetch users for filter dropdown
  let users: { id: string; full_name: string; email: string }[] = [];
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .order('full_name') as { data: { id: string; full_name: string; email: string }[] | null };
    users = data || [];
  } catch (err) {
    console.error('[AuditLogs] Failed to fetch users:', err);
  }

  // Extend profile with email from auth user for client component
  const extendedProfile = {
    ...profile,
    full_name: profile.full_name || '',
    email: user.email || '',
  };

  return (
    <AuditLogsClient
      initialLogs={initialLogs}
      users={users}
      profile={extendedProfile}
    />
  );
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

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<AuditLogsSkeleton />}>
      <AuditLogsContent />
    </Suspense>
  );
}
