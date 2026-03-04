'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Building2,
  MapPin,
  Users,
  Star,
  Link2,
} from 'lucide-react';

interface NetworkDetail {
  id: string;
  network_code: string;
  network_name: string;
  network_type: string;
  description: string | null;
  coverage_states: string[];
  effective_date: string;
  end_date: string | null;
  is_active: boolean;
  insurance_carriers: { id: string; carrier_name: string; carrier_type: string } | null;
}

interface NetworkStats {
  total_providers: number;
  tier_breakdown: { in_network_preferred: number; in_network: number; out_of_network: number };
  linked_plans: number;
}

interface CoverageZip {
  zip_code: string;
  state: string;
  provider_count: number;
  coverage_score: number;
}

interface NetworkProvider {
  id: string;
  network_tier: string;
  specialty_tags: string[];
  tier_discount_pct: number;
  healthcare_locations: { id: string; name: string; location_type: string; city: string; state: string; zip: string } | null;
  provider_locations: { id: string; name: string; provider_type: string; city: string; state: string; zip: string } | null;
}

interface PlanLink {
  id: string;
  is_primary: boolean;
  insurance_plans: {
    id: string;
    plan_name: string;
    plan_type: string;
    metal_level: string | null;
    insurance_carriers: { carrier_name: string } | null;
  } | null;
}

type Tab = 'overview' | 'providers' | 'plans' | 'coverage';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  B: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  C: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  D: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  F: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

export default function NetworkDetailClient({ networkId }: { networkId: string }) {
  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [topZips, setTopZips] = useState<CoverageZip[]>([]);
  const [providers, setProviders] = useState<NetworkProvider[]>([]);
  const [plans, setPlans] = useState<PlanLink[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [providerPage, setProviderPage] = useState(1);
  const [providerTotal, setProviderTotal] = useState(0);

  useEffect(() => {
    async function fetchNetwork() {
      try {
        const res = await fetch(`/api/healthcare/networks/${networkId}`);
        if (res.ok) {
          const json = await res.json();
          setNetwork(json.network);
          setStats(json.stats);
          setTopZips(json.top_coverage_zips || []);
        }
      } catch (err) {
        console.error('Failed to fetch network:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNetwork();
  }, [networkId]);

  useEffect(() => {
    if (tab === 'providers') {
      fetchProviders();
    } else if (tab === 'plans') {
      fetchPlans();
    }
  }, [tab, providerPage]);

  async function fetchProviders() {
    try {
      const res = await fetch(
        `/api/healthcare/networks/${networkId}/providers?page=${providerPage}&per_page=20`
      );
      if (res.ok) {
        const json = await res.json();
        setProviders(json.providers || []);
        setProviderTotal(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  }

  async function fetchPlans() {
    try {
      const res = await fetch(`/api/healthcare/networks/${networkId}/plans`);
      if (res.ok) {
        const json = await res.json();
        setPlans(json.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!network) {
    return (
      <div className="max-w-7xl mx-auto text-center py-16">
        <p className="text-slate-500">Network not found</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'providers', label: `Providers (${stats?.total_providers || 0})`, icon: Building2 },
    { id: 'plans', label: `Plans (${stats?.linked_plans || 0})`, icon: Link2 },
    { id: 'coverage', label: 'Coverage', icon: MapPin },
  ];

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
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {network.network_name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-medium">
                {network.network_type.toUpperCase()}
              </span>
              <span className="text-xs text-slate-500">{network.network_code}</span>
              {network.insurance_carriers && (
                <span className="text-xs text-slate-500">
                  &middot; {network.insurance_carriers.carrier_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_providers}</p>
            <p className="text-xs text-slate-500">Total Providers</p>
          </div>
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.tier_breakdown.in_network_preferred}</p>
            <p className="text-xs text-slate-500">Preferred</p>
          </div>
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.tier_breakdown.in_network}</p>
            <p className="text-xs text-slate-500">In-Network</p>
          </div>
          <div className="glass-card rounded-xl p-4 border border-slate-200 dark:border-white/10">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.linked_plans}</p>
            <p className="text-xs text-slate-500">Linked Plans</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Network Info</h3>
            <dl className="space-y-2 text-sm">
              {network.description && (
                <div>
                  <dt className="text-slate-500">Description</dt>
                  <dd className="text-slate-900 dark:text-white">{network.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Coverage States</dt>
                <dd className="text-slate-900 dark:text-white">
                  {network.coverage_states.length > 0 ? network.coverage_states.join(', ') : 'None specified'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Effective Date</dt>
                <dd className="text-slate-900 dark:text-white">{network.effective_date}</dd>
              </div>
              {network.end_date && (
                <div>
                  <dt className="text-slate-500">End Date</dt>
                  <dd className="text-slate-900 dark:text-white">{network.end_date}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Top Coverage ZIPs</h3>
            {topZips.length === 0 ? (
              <p className="text-sm text-slate-500">No coverage data computed yet</p>
            ) : (
              <div className="space-y-2">
                {topZips.map((zip) => {
                  const grade = getGrade(zip.coverage_score);
                  return (
                    <div key={zip.zip_code} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{zip.zip_code}</span>
                        <span className="text-xs text-slate-500 ml-2">{zip.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{zip.provider_count} providers</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${GRADE_COLORS[grade]}`}>{grade}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'providers' && (
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Location</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Tier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Specialties</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {providers.map((p) => {
                const loc = p.healthcare_locations || p.provider_locations;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">{loc?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {loc ? `${loc.city}, ${loc.state} ${loc.zip}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.network_tier === 'in_network_preferred'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : p.network_tier === 'in_network'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {p.network_tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.specialty_tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {tag.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {p.specialty_tags.length > 3 && (
                          <span className="text-xs text-slate-400">+{p.specialty_tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                      {p.tier_discount_pct > 0 ? `${p.tier_discount_pct}%` : '-'}
                    </td>
                  </tr>
                );
              })}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No providers in this network yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {providerTotal > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500">
                Page {providerPage} of {Math.ceil(providerTotal / 20)}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={providerPage <= 1}
                  onClick={() => setProviderPage((p) => p - 1)}
                  className="px-3 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={providerPage >= Math.ceil(providerTotal / 20)}
                  onClick={() => setProviderPage((p) => p + 1)}
                  className="px-3 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'plans' && (
        <div className="glass-card rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Carrier</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Type</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Primary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plans.map((link) => (
                <tr key={link.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {link.insurance_plans?.plan_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {link.insurance_plans?.insurance_carriers?.carrier_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {link.insurance_plans?.plan_type || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {link.is_primary ? (
                      <Star className="w-4 h-4 text-amber-500 mx-auto" />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No plans linked to this network yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/10">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
            ZIP-Level Coverage Scores
          </h3>
          {topZips.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No coverage data computed. Add providers to this network to generate coverage scores.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {topZips.map((zip) => {
                const grade = getGrade(zip.coverage_score);
                return (
                  <div
                    key={zip.zip_code}
                    className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-teal-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${GRADE_COLORS[grade]}`}>
                          {grade}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{zip.zip_code}</p>
                          <p className="text-xs text-slate-500">{zip.state}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {zip.coverage_score}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          zip.coverage_score >= 70 ? 'bg-emerald-500' :
                          zip.coverage_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(zip.coverage_score, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {zip.provider_count} providers
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
