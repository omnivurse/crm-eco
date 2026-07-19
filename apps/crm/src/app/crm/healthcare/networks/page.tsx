'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Shield,
  Building2,
  MapPin,
  Search,
} from 'lucide-react';

interface Network {
  id: string;
  network_code: string;
  network_name: string;
  network_type: string;
  description: string | null;
  coverage_states: string[];
  is_active: boolean;
  insurance_carriers: { id: string; carrier_name: string; carrier_type: string } | null;
}

const TYPE_BADGES: Record<string, string> = {
  ppo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  hmo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  epo: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  pos: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  preferred: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  open: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  custom: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

export default function NetworksExplorerPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    async function fetchNetworks() {
      try {
        const params = new URLSearchParams({ active: 'true' });
        if (typeFilter) params.set('type', typeFilter);
        const res = await fetch(`/api/healthcare/networks?${params}`);
        if (res.ok) {
          const json = await res.json();
          setNetworks(json.networks || []);
        }
      } catch (err) {
        console.error('Failed to fetch networks:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNetworks();
  }, [typeFilter]);

  const filtered = networks.filter((n) =>
    !search || n.network_name.toLowerCase().includes(search.toLowerCase()) ||
    n.network_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/crm"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Provider Networks
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Manage provider networks, tiers, and coverage
              </p>
            </div>
          </div>
          <Link
            href="/crm/healthcare/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            Provider Search
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/20">
              <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {networks.length}
              </p>
              <p className="text-xs text-slate-500">Active Networks</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {new Set(networks.flatMap((n) => n.coverage_states)).size}
              </p>
              <p className="text-xs text-slate-500">States Covered</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {new Set(networks.map((n) => n.network_type)).size}
              </p>
              <p className="text-xs text-slate-500">Network Types</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search networks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Types</option>
          <option value="ppo">PPO</option>
          <option value="hmo">HMO</option>
          <option value="epo">EPO</option>
          <option value="pos">POS</option>
          <option value="preferred">Preferred</option>
          <option value="open">Open</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Network Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 mb-4" />
              <div className="h-20 bg-slate-50 dark:bg-slate-800/50 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No networks found</p>
          <p className="text-sm">
            {search ? 'Try a different search term' : 'Create your first provider network to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((network) => (
            <Link
              key={network.id}
              href={`/crm/healthcare/networks/${network.id}`}
              className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-teal-500/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {network.network_name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {network.network_code}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGES[network.network_type] || TYPE_BADGES.custom}`}>
                  {network.network_type.toUpperCase()}
                </span>
              </div>
              {network.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                  {network.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {network.insurance_carriers && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {network.insurance_carriers.carrier_name}
                  </span>
                )}
                {network.coverage_states.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {network.coverage_states.join(', ')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
