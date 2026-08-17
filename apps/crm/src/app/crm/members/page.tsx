import { Suspense } from 'react';
import Link from 'next/link';
import { HeartPulse } from 'lucide-react';
import { Skeleton } from '@crm-eco/ui/components/skeleton';
import { MembersListClient } from '@/components/members/MembersListClient';

export const dynamic = 'force-dynamic';

function MembersPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl bg-card border border-border p-6"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted" />
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
          <div className="space-y-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrmMembersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-pink-400">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Member Roster (Admin Portal)
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-12">
          Health share members synced from the Admin Portal. For CRM member records, use{' '}
          <Link href="/crm/modules/members" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
            Members
          </Link>{' '}
          in the sidebar.
        </p>
      </div>

      {/* Members Content */}
      <Suspense fallback={<MembersPageSkeleton />}>
        <MembersListClient />
      </Suspense>
    </div>
  );
}
