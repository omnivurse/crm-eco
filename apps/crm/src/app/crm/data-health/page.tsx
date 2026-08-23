import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { verifyCrmAccess } from '@/lib/supabase-server';
import { CRM_GATE_REASON } from '@/lib/crm/gate-notice-copy';
import { DataHealthClient } from './DataHealthClient';

export const dynamic = 'force-dynamic';

/**
 * /crm/data-health — Data Health
 *
 * The data-quality twin of the walk report: eighteen deterministic checks
 * sweep the book (read-only, org-pinned) and roll up into one 0–100 score.
 * Rules DECIDE, nothing mutates records — every card links to the place
 * where a person can act on what it found.
 *
 * Gated exactly like /crm/duplicates: crm_admin | crm_manager only, and the
 * sidebar link carries the same predicate so nobody is offered a bounce.
 */

async function DataHealthPageContent() {
  let user, profile;
  try {
    const access = await verifyCrmAccess();
    user = access.user;
    profile = access.profile;
  } catch (err) {
    console.error('[DataHealth] Failed to verify access:', err);
    redirect('/crm-login');
  }

  if (!user || !profile) {
    redirect('/crm-login');
  }

  if (!['crm_admin', 'crm_manager'].includes(profile.crm_role || '')) {
    // Its OWN reason key, not Review Duplicates' — the bounced person must be
    // told about the page they actually clicked (lib/crm/gate-notice-copy.ts).
    redirect(`/crm?error=${CRM_GATE_REASON.dataHealthAdminOnly}`);
  }

  return <DataHealthClient />;
}

function DataHealthSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 w-full">
      <div className="space-y-2">
        <div className="w-56 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="w-96 max-w-full h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-36 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/50 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export default function DataHealthPage() {
  return (
    <Suspense fallback={<DataHealthSkeleton />}>
      <DataHealthPageContent />
    </Suspense>
  );
}
