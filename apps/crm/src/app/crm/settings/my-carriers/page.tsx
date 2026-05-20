'use client';

/**
 * My Carriers — per-advisor carrier list management.
 *
 * Each advisor curates their own subset of the org-shared
 * `insurance_carriers` directory, organised by carrier_type. Selected
 * carriers are what appear in the advisor-carrier dropdown on record forms
 * (e.g. Insurance Carrier, Health Share, Dental, Vision, Other, Life).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@crm-eco/ui/components/tabs';
import {
  Building2,
  Heart,
  Plus,
  Search,
  Shield,
  Smile,
  Sparkles,
  Trash2,
  Eye,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@crm-eco/ui/lib/utils';
import type {
  AdvisorCarrierWithCarrier,
  CarrierType,
  FieldCarrierType,
  InsuranceCarrier,
} from '@/lib/crm/types';
import { getCarrierTerms } from '@/components/crm/records/section-utils';

// ---------------------------------------------------------------------------
// Tab definitions — must match the carrier_type values in the DB
// ---------------------------------------------------------------------------
interface TabDef {
  value: FieldCarrierType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    value: 'insurance',
    label: 'Insurance',
    icon: Shield,
    accent: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    description: 'Major medical insurance carriers you write business with.',
  },
  {
    value: 'healthshare',
    label: 'Health Share',
    icon: Heart,
    accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    description: 'Health sharing ministries you represent (Sedera, Zion, MPB, …).',
  },
  {
    value: 'dental',
    label: 'Dental',
    icon: Smile,
    accent: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
    description: 'Dental insurance providers.',
  },
  {
    value: 'vision',
    label: 'Vision',
    icon: Eye,
    accent: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300',
    description: 'Vision insurance providers.',
  },
  {
    value: 'other',
    label: 'Other',
    icon: Sparkles,
    accent: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    description:
      'Health Access, indemnity plans, short-term medical, disability, accident, critical illness, …',
  },
  {
    value: 'life',
    label: 'Life',
    icon: Building2,
    accent: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    description: 'Life insurance carriers.',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyCarriersPage() {
  const [activeTab, setActiveTab] = useState<FieldCarrierType>('insurance');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-300 rounded-lg">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Carriers & Ministries</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Curate the carriers and ministries you actively write business with. The list you build here drives
              the dropdowns on every record (Lead, Contact, Member). Options come from the
              org&rsquo;s shared{' '}
              <Link href="/crm/settings/carriers" className="text-teal-600 hover:underline">
                Carrier & Ministry Directory
              </Link>{' '}
              directory.
            </p>
          </div>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FieldCarrierType)}
        className="w-full"
      >
        <TabsList className="flex flex-wrap gap-1 h-auto bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900"
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <CarrierTab tab={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tab content: list of advisor's carriers + "add new" search
// ---------------------------------------------------------------------------
interface CarrierTabProps {
  tab: TabDef;
}

function CarrierTab({ tab }: CarrierTabProps) {
  const terms = getCarrierTerms(tab.value);
  const [myList, setMyList] = useState<AdvisorCarrierWithCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchMyList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/advisor-carriers?carrier_type=${tab.value}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setMyList(json.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load your carriers');
    } finally {
      setLoading(false);
    }
  }, [tab.value]);

  useEffect(() => {
    fetchMyList();
  }, [fetchMyList]);

  const handleAdd = useCallback(
    async (carrier: InsuranceCarrier) => {
      setSavingId(carrier.id);
      try {
        const res = await fetch('/api/crm/advisor-carriers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrier_id: carrier.id,
            sort_order: myList.length,
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Failed');
        }
        toast.success(`${carrier.carrier_name} added to your list`);
        await fetchMyList();
      } catch (err) {
        console.error(err);
        toast.error('Failed to add carrier');
      } finally {
        setSavingId(null);
      }
    },
    [fetchMyList, myList.length],
  );

  const handleRemove = useCallback(
    async (row: AdvisorCarrierWithCarrier) => {
      setSavingId(row.carrier_id);
      try {
        const res = await fetch(`/api/crm/advisor-carriers?carrier_id=${row.carrier_id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'Failed');
        }
        toast.success('Removed from your list');
        await fetchMyList();
      } catch (err) {
        console.error(err);
        toast.error('Failed to remove carrier');
      } finally {
        setSavingId(null);
      }
    },
    [fetchMyList],
  );

  const myIds = useMemo(() => new Set(myList.map((r) => r.carrier_id)), [myList]);

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 p-6', tab.accent)}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{tab.label}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{tab.description}</p>
        </div>
        <Badge variant="secondary" className="self-start">
          {myList.length} active
        </Badge>
      </div>

      {/* Add new */}
      <CarrierTypeahead
        carrierType={tab.value}
        excludeIds={myIds}
        onPick={handleAdd}
        savingId={savingId}
      />

      {/* My list */}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-md bg-white/60 dark:bg-slate-900/40 animate-pulse"
              />
            ))}
          </div>
        ) : myList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center bg-white/60 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You haven&rsquo;t added any {terms.pluralLower} yet.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Search above to pick from the org directory.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {myList.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {row.carrier?.logo_url ? (
                    <img
                      src={row.carrier.logo_url}
                      alt=""
                      className="w-8 h-8 rounded object-contain bg-slate-100 dark:bg-slate-800"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <tab.icon className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {row.carrier?.carrier_name || 'Unknown carrier'}
                    </p>
                    {!row.carrier?.is_active && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Carrier archived in org directory
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(row)}
                  disabled={savingId === row.carrier_id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        {terms.singular} missing from the directory?{' '}
        <Link href="/crm/settings/carriers" className="text-teal-600 hover:underline">
          Open Carrier & Ministry Directory
        </Link>{' '}
        (admins can add new {terms.pluralLower}).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typeahead — searches /api/crm/carriers and lets the advisor add one
// ---------------------------------------------------------------------------
interface TypeaheadProps {
  carrierType: FieldCarrierType;
  excludeIds: Set<string>;
  onPick: (c: InsuranceCarrier) => void;
  savingId: string | null;
}

function CarrierTypeahead({ carrierType, excludeIds, onPick, savingId }: TypeaheadProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InsuranceCarrier[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          search: query.trim(),
          carrier_type: carrierType,
          limit: '20',
        });
        const res = await fetch(`/api/crm/carriers?${params.toString()}`);
        const json = await res.json();
        const data: InsuranceCarrier[] = Array.isArray(json) ? json : json.data || [];
        setResults(data.filter((c) => !excludeIds.has(c.id)));
        setOpen(true);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, carrierType, excludeIds]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder={`Search ${carrierType === 'healthshare' ? 'ministries' : carrierType + ' carriers'}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9 bg-white dark:bg-slate-900"
        />
      </div>

      {open && (results.length > 0 || searching) && (
        <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {searching && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">Searching…</div>
          ) : (
            <ul>
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPick(c);
                      setQuery('');
                      setOpen(false);
                    }}
                    disabled={savingId === c.id}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt=""
                          className="w-6 h-6 rounded object-contain bg-slate-100 dark:bg-slate-800"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800" />
                      )}
                      <span className="text-sm text-slate-900 dark:text-white truncate">
                        {c.carrier_name}
                      </span>
                      <CarrierTypeBadge type={c.carrier_type} />
                    </span>
                    <Plus className="w-4 h-4 text-teal-600" />
                  </button>
                </li>
              ))}
              {results.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No matching carriers.</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CarrierTypeBadge({ type }: { type: CarrierType | string }) {
  return (
    <Badge variant="outline" className="text-[10px]">
      {type}
    </Badge>
  );
}
