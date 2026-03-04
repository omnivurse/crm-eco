'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  MapPin,
  Phone,
  DollarSign,
  Shield,
  Building2,
  ArrowRightLeft,
} from 'lucide-react';

interface Network {
  id: string;
  network_name: string;
  network_type: string;
}

interface SearchResult {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  network_tier: string;
  tier_discount_pct: number;
  specialty_tags: string[];
  accepting_new_patients: boolean;
  distance_miles: number | null;
  source_table: string;
}

interface CheapestResult {
  provider_location_id: string;
  provider_name: string;
  city: string;
  state: string;
  zip: string;
  distance_miles: number | null;
  network_tier: string;
  cash_price: number;
  effective_price: number;
  savings_vs_cash: number;
  rating: number | null;
}

interface CompareResult {
  network_id: string;
  network_name: string;
  network_type: string;
  carrier_name: string | null;
  total_providers: number;
  preferred_providers: number;
  coverage_score: number;
  coverage_grade: string;
  avg_tier_discount: number;
}

type Mode = 'search' | 'cheapest' | 'compare';

const TIER_BADGES: Record<string, string> = {
  in_network_preferred: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  in_network: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  out_of_network: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function ProviderSearchClient() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [mode, setMode] = useState<Mode>('search');
  const [networkId, setNetworkId] = useState('');
  const [zip, setZip] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [radius, setRadius] = useState(50);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [cheapestResults, setCheapestResults] = useState<CheapestResult[]>([]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [compareNetworkIds, setCompareNetworkIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    async function fetchNetworks() {
      try {
        const res = await fetch('/api/healthcare/networks?active=true');
        if (res.ok) {
          const json = await res.json();
          setNetworks(json.networks || []);
        }
      } catch (err) {
        console.error('Failed to fetch networks:', err);
      }
    }
    fetchNetworks();
  }, []);

  async function handleSearch() {
    if (!networkId || !zip) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        network_id: networkId,
        zip,
        radius: String(radius),
      });
      if (serviceCategory) params.set('service_category', serviceCategory);
      const res = await fetch(`/api/healthcare/networks/search?${params}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.providers || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheapest() {
    if (!networkId || !zip) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        network_id: networkId,
        zip,
        radius: String(radius),
        // Use first available procedure for demo (in production, user selects)
        procedure_id: '',
      });
      const res = await fetch(`/api/healthcare/networks/cheapest?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCheapestResults(json.providers || []);
      }
    } catch (err) {
      console.error('Cheapest search error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare() {
    if (compareNetworkIds.length < 2 || !zip) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        network_ids: compareNetworkIds.join(','),
        zip,
      });
      const res = await fetch(`/api/healthcare/networks/compare?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCompareResults(json.networks || []);
      }
    } catch (err) {
      console.error('Compare error:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleCompareNetwork(id: string) {
    setCompareNetworkIds((prev) =>
      prev.includes(id)
        ? prev.filter((n) => n !== id)
        : prev.length < 5
        ? [...prev, id]
        : prev
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/crm/healthcare/networks"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Networks
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Provider Search
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
          Find in-network providers, compare costs, and evaluate network coverage
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'search' as Mode, label: 'Provider Search', icon: Search },
          { id: 'cheapest' as Mode, label: 'Find Cheapest', icon: DollarSign },
          { id: 'compare' as Mode, label: 'Compare Networks', icon: ArrowRightLeft },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setSearched(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Search Form */}
      <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mode !== 'compare' ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Network
              </label>
              <select
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="">Select network...</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.network_name} ({n.network_type.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Select Networks to Compare (2-5)
              </label>
              <div className="flex flex-wrap gap-2">
                {networks.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => toggleCompareNetwork(n.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      compareNetworkIds.includes(n.id)
                        ? 'bg-teal-100 border-teal-300 text-teal-700 dark:bg-teal-900/30 dark:border-teal-700 dark:text-teal-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-300'
                    }`}
                  >
                    {n.network_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              ZIP Code
            </label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="33609"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>

          {mode === 'search' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Service Category
              </label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                <option value="">All Categories</option>
                <option value="primary_care">Primary Care</option>
                <option value="specialist">Specialist</option>
                <option value="urgent_care">Urgent Care</option>
                <option value="imaging">Imaging</option>
                <option value="lab">Lab</option>
                <option value="telehealth">Telehealth</option>
                <option value="pharmacy">Pharmacy</option>
              </select>
            </div>
          )}

          {mode !== 'compare' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Radius: {radius} miles
              </label>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={() => {
              if (mode === 'search') handleSearch();
              else if (mode === 'cheapest') handleCheapest();
              else handleCompare();
            }}
            disabled={loading || (mode !== 'compare' ? !networkId || !zip : compareNetworkIds.length < 2 || !zip)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : mode === 'search' ? 'Search Providers' : mode === 'cheapest' ? 'Find Cheapest' : 'Compare Networks'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {mode === 'search' && searched && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            {searchResults.length} Provider{searchResults.length !== 1 ? 's' : ''} Found
          </h3>
          <div className="space-y-3">
            {searchResults.map((r) => (
              <div
                key={r.provider_id}
                className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10 hover:border-teal-500/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {r.provider_name}
                      </h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGES[r.network_tier]}`}>
                        {r.network_tier.replace(/_/g, ' ')}
                      </span>
                      {r.accepting_new_patients && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                          Accepting patients
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {r.address ? `${r.address}, ` : ''}{r.city}, {r.state} {r.zip}
                      </span>
                      {r.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {r.phone}
                        </span>
                      )}
                    </div>
                    {r.specialty_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.specialty_tags.map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {r.distance_miles != null && (
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        {r.distance_miles} mi
                      </p>
                      <p className="text-xs text-slate-500">distance</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {searchResults.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No providers found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cheapest Results */}
      {mode === 'cheapest' && searched && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            {cheapestResults.length} Cost-Optimized Option{cheapestResults.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {cheapestResults.map((r, i) => (
              <div
                key={r.provider_location_id}
                className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-400">#{i + 1}</span>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{r.provider_name}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGES[r.network_tier]}`}>
                        {r.network_tier.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {r.city}, {r.state} {r.zip}
                      {r.distance_miles != null && ` · ${r.distance_miles} mi`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      ${r.effective_price.toFixed(2)}
                    </p>
                    {r.savings_vs_cash > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Save ${r.savings_vs_cash.toFixed(0)} vs ${r.cash_price.toFixed(0)} cash
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {cheapestResults.length === 0 && !loading && (
              <div className="text-center py-12 text-slate-500">
                <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No pricing data available for this search</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Results */}
      {mode === 'compare' && searched && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Network Comparison for ZIP {zip}
          </h3>
          {compareResults.length === 0 && !loading ? (
            <div className="text-center py-12 text-slate-500">
              <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No comparison data available</p>
            </div>
          ) : (
            <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Network</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Carrier</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Grade</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Score</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Providers</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Preferred</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Avg Discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {compareResults.map((r) => (
                    <tr key={r.network_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 dark:text-white">{r.network_name}</span>
                        <span className="text-xs text-slate-400 ml-2">{r.network_type.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.carrier_name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${GRADE_COLORS[r.coverage_grade]}`}>
                          {r.coverage_grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{r.coverage_score}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{r.total_providers}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{r.preferred_providers}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{r.avg_tier_discount}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
