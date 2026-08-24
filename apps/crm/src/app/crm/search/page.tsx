import { Suspense } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, User, UserPlus, Building2, DollarSign } from 'lucide-react';
import { getCurrentProfile } from '@/lib/crm/queries';
import { createClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { moduleChipClass } from '@/components/crm/records/v2/tokens';
import {
  resolveSearchRows,
  searchRowDisplayTitle,
  type GlobalSearchRow,
} from '@/lib/crm/record-search';
import { getRecordSearchMatches } from '@/lib/crm/search-match';
import { SearchMatchChips } from '@/components/crm/records/SearchMatchChips';

interface PageProps {
  searchParams: Promise<{ q?: string; module?: string }>;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  contacts: <User className="w-4 h-4" />,
  leads: <UserPlus className="w-4 h-4" />,
  accounts: <Building2 className="w-4 h-4" />,
  deals: <DollarSign className="w-4 h-4" />,
};


/** Same cap as the palette API's default so "View all results" never shows fewer. */
const PAGE_RESULT_LIMIT = 50;

async function SearchResults({ query, moduleFilter }: { query: string; moduleFilter?: string }) {
  let profile;
  try {
    profile = await getCurrentProfile();
  } catch (err) {
    console.error('[Search] Failed to get profile:', err);
    return notFound();
  }
  if (!profile) return notFound();

  const supabase = await createClient();

  // NV-4: the SAME resolver the ⌘K palette uses (/api/crm/search) — phone
  // format variants, member #, typo-tolerant names — scoped by the same
  // profile.organization_id, so "View all results" lists the same people.
  let results: GlobalSearchRow[];
  try {
    results = await resolveSearchRows(supabase, profile.organization_id, {
      query,
      moduleFilter: moduleFilter?.trim() || null,
      limit: PAGE_RESULT_LIMIT,
    });
  } catch (err) {
    console.error('[Search] resolveSearchRows failed:', err);
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Search failed. Please try a different query.</p>
      </div>
    );
  }

  // Group by module (rank order preserved within each group)
  const grouped: Record<string, GlobalSearchRow[]> = {};
  for (const r of results) {
    const key = r.module_key || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          No results found
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No records matching &ldquo;{query}&rdquo; were found. Try a different search term.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Found <span className="font-medium text-slate-700 dark:text-slate-200">{results.length}</span> results
        for &ldquo;<span className="font-medium text-slate-700 dark:text-slate-200">{query}</span>&rdquo;
      </p>

      {Object.entries(grouped).map(([moduleKey, moduleRecords]) => {
        const mod = moduleRecords[0];
        const moduleName = mod?.module_name_plural || mod?.module_name || moduleKey;
        const colorClass = moduleChipClass(moduleKey);
        const icon = MODULE_ICONS[moduleKey] || <Search className="w-4 h-4" />;

        return (
          <div key={moduleKey} className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-white/5 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colorClass}`}>
                {icon}
                {moduleName}
              </span>
              <span className="text-xs text-slate-400">{moduleRecords.length} results</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {moduleRecords.map((record) => {
                const data = record.data || {};
                const firstName = data.first_name as string || '';
                const lastName = data.last_name as string || '';
                const displayName = [firstName, lastName].filter(Boolean).join(' ') || searchRowDisplayTitle(record);
                const email = record.email || data.email as string || '';
                const phone = record.phone || data.phone as string || '';
                // Same "why did this match?" chips as the palette row.
                const matches = getRecordSearchMatches(
                  { title: record.title, email: record.email, phone: record.phone, status: record.status, data },
                  query,
                  { maxMatches: 3 },
                );

                return (
                  <Link
                    key={record.id}
                    href={`/crm/r/${record.id}`}
                    data-testid="crm-search-result"
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300 shrink-0">
                      {(firstName[0] || displayName[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {displayName}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        {email && <span className="truncate">{email}</span>}
                        {phone && <span>{phone}</span>}
                        {record.status && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {record.status}
                          </span>
                        )}
                      </div>
                      <SearchMatchChips matches={matches} className="mt-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/5 p-4">
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q?.trim() || '';
  const moduleFilter = resolvedSearchParams.module;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        {/*
          The dashboard is `/crm` (the command desk) — `/crm/dashboard` has
          never been a route, so this sent every "Back to Dashboard" click to
          the 404 page and made Next prefetch a missing route on every render of
          this page. It stayed invisible because `next dev` does not prefetch;
          only the production build asks for it, and only since the walk started
          grading one.
        */}
        <Link
          href="/crm"
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Search Results
            </h1>
            {query && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Searching for &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      {!query ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Enter a search term
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use the search bar above to find contacts, leads, and more.
          </p>
        </div>
      ) : (
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResults query={query} moduleFilter={moduleFilter} />
        </Suspense>
      )}
    </div>
  );
}
