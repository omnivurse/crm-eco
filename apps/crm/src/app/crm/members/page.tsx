import { Suspense } from 'react';
import { HeartPulse } from 'lucide-react';
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
            className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/50 p-6"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="h-11 w-11 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            </div>
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 p-6">
        <div className="space-y-4">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="space-y-3 mt-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"
              />
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
            Members
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 ml-12">
          View and manage health share members synced from the Admin Portal
        </p>
      </div>

      {/* Members Content */}
      <Suspense fallback={<MembersPageSkeleton />}>
        <MembersListClient />
      </Suspense>
    </div>
  );
}
