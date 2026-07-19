'use client';

import { MagnifyingGlass, SlidersHorizontal, X } from '@phosphor-icons/react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Button, Input } from '@crm-eco/ui';
import { Combobox, type ComboboxOption } from '@crm-eco/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { createClient } from '@crm-eco/lib/supabase/client';
import { SavedViewsMenu } from './SavedViewsMenu';

interface Advisor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

interface MemberFiltersProps {
  orgId: string;
}

export function MemberFilters({ orgId }: MemberFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);

  // Read initial values from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [advisorId, setAdvisorId] = useState(searchParams.get('advisor') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [marketType, setMarketType] = useState(searchParams.get('market_type') || '');

  const supabase = createClient();

  // Fetch advisors on mount
  useEffect(() => {
    async function fetchAdvisors() {
      const { data } = await supabase
        .from('advisors')
        .select('id, first_name, last_name, email')
        .eq('organization_id', orgId)
        .eq('status', 'active')
        .order('first_name');
      setAdvisors(data ?? []);
      setLoading(false);
    }
    fetchAdvisors();
  }, [orgId, supabase]);

  // Push filters to URL search params
  const applyFilters = useCallback(
    (overrides: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      const values = {
        search,
        advisor: advisorId,
        status,
        market_type: marketType,
        ...overrides,
      };
      if (values.search) params.set('search', values.search);
      if (values.advisor) params.set('advisor', values.advisor);
      if (values.status) params.set('status', values.status);
      if (values.market_type) params.set('market_type', values.market_type);
      // Reset to page 1 when filters change
      router.push(`/members?${params.toString()}`);
    },
    [search, advisorId, status, marketType, router]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const handleAdvisorChange = (value: string) => {
    setAdvisorId(value);
    applyFilters({ advisor: value });
  };

  const handleStatusChange = (value: string) => {
    const newVal = value === 'all' ? '' : value;
    setStatus(newVal);
    applyFilters({ status: newVal });
  };

  const handleMarketTypeChange = (value: string) => {
    setMarketType(value);
    applyFilters({ market_type: value });
  };

  const clearFilter = (key: string) => {
    if (key === 'search') setSearch('');
    if (key === 'advisor') setAdvisorId('');
    if (key === 'status') setStatus('');
    if (key === 'market_type') setMarketType('');
    applyFilters({ [key]: '' });
  };

  const clearAll = () => {
    setSearch('');
    setAdvisorId('');
    setStatus('');
    setMarketType('');
    router.push('/members');
  };

  // Build active filter chips
  const activeFilters: ActiveFilter[] = [];
  if (search) {
    activeFilters.push({ key: 'search', label: 'MagnifyingGlass', value: search, displayValue: `"${search}"` });
  }
  if (advisorId) {
    const adv = advisors.find((a) => a.id === advisorId);
    activeFilters.push({
      key: 'advisor',
      label: 'Advisor',
      value: advisorId,
      displayValue: adv ? `${adv.first_name} ${adv.last_name}` : advisorId,
    });
  }
  if (status) {
    activeFilters.push({
      key: 'status',
      label: 'Status',
      value: status,
      displayValue: status.charAt(0).toUpperCase() + status.slice(1),
    });
  }
  if (marketType) {
    const marketTypeLabels: Record<string, string> = {
      healthshare: 'HealthShare',
      traditional_insurance: 'Insurance',
    };
    activeFilters.push({
      key: 'market_type',
      label: 'Market Type',
      value: marketType,
      displayValue: marketTypeLabels[marketType] || marketType,
    });
  }

  const advisorOptions: ComboboxOption[] = advisors.map((a) => ({
    value: a.id,
    label: `${a.first_name} ${a.last_name}`,
    subtext: a.email,
  }));

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Market type quick-filter pills */}
        <div className="flex items-center gap-1.5">
          {([
            { value: '', label: 'All' },
            { value: 'healthshare', label: 'HealthShare' },
            { value: 'traditional_insurance', label: 'Insurance' },
          ] as const).map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => handleMarketTypeChange(pill.value)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                marketType === pill.value
                  ? 'bg-slate-800 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-sm">
          <MagnifyingGlass weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="MagnifyingGlass members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </form>

        <div className="w-52">
          <Combobox
            options={advisorOptions}
            value={advisorId}
            onValueChange={handleAdvisorChange}
            placeholder="Filter by Advisor"
            searchPlaceholder="MagnifyingGlass advisors..."
            emptyText="No advisors found."
            disabled={loading}
            clearable
            triggerClassName="h-9"
          />
        </div>

        <Select value={status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>

        <SavedViewsMenu
          orgId={orgId}
          currentFilters={{ search, advisor: advisorId, status, market_type: marketType }}
        />
      </div>

      {/* Filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal weight="light" className="w-3.5 h-3.5 text-slate-400" />
          {activeFilters.map((f) => (
            <Badge
              key={f.key}
              variant="secondary"
              className="pl-2.5 pr-1 py-1 gap-1.5 text-xs font-normal"
            >
              <span className="text-slate-500">{f.label}:</span>
              <span className="font-medium">{f.displayValue}</span>
              <button
                onClick={() => clearFilter(f.key)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-slate-300/50"
              >
                <X weight="light" className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
