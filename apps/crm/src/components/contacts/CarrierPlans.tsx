'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Loader2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { toast } from 'sonner';

interface Carrier {
  id: string;
  carrier_name: string;
  carrier_type: string;
  naic_code: string | null;
  website: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

interface Plan {
  id: string;
  carrier_id: string;
  plan_name: string;
  plan_type: string;
  metal_level: string | null;
  base_premium: number | null;
  deductible: number | null;
  max_oop: number | null;
  is_active: boolean;
}

const CARRIER_TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  healthshare: 'Healthshare',
  medicaid: 'Medicaid',
  short_term: 'Short-Term',
};

const CARRIER_TYPE_COLORS: Record<string, string> = {
  insurance: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  healthshare: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  medicaid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  short_term: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const METAL_COLORS: Record<string, string> = {
  bronze: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  silver: 'bg-slate-300/20 text-slate-600 dark:text-slate-300',
  gold: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  platinum: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  catastrophic: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function CarrierPlans() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expandedCarrier, setExpandedCarrier] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan[]>>({});
  const [loadingPlans, setLoadingPlans] = useState<string | null>(null);

  async function fetchCarriers() {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (typeFilter) params.set('carrier_type', typeFilter);
      const res = await fetch(`/api/crm/carriers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCarriers(json.data || []);
      } else {
        toast.error('Failed to load carriers');
      }
    } catch {
      toast.error('Failed to load carriers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCarriers();
  }, []);

  function handleSearch() {
    setLoading(true);
    fetchCarriers();
  }

  async function handleExpand(carrierId: string) {
    if (expandedCarrier === carrierId) {
      setExpandedCarrier(null);
      return;
    }
    setExpandedCarrier(carrierId);

    // If we already fetched plans for this carrier, skip
    if (plans[carrierId]) return;

    setLoadingPlans(carrierId);
    try {
      // Use the search API with no state filter to get plans for this carrier
      // We fetch from the carriers/search endpoint which returns plans
      const res = await fetch(`/api/crm/carriers/search?state=*`);
      if (res.ok) {
        const json = await res.json();
        const carrierPlans = (json.data || []).filter((p: Plan) => p.carrier_id === carrierId);
        setPlans((prev) => ({ ...prev, [carrierId]: carrierPlans }));
      } else {
        // Fallback: just set empty
        setPlans((prev) => ({ ...prev, [carrierId]: [] }));
      }
    } catch {
      setPlans((prev) => ({ ...prev, [carrierId]: [] }));
    } finally {
      setLoadingPlans(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Carrier Plans</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Browse insurance carriers and their available plans
          </p>
        </div>
        <Button onClick={() => { setLoading(true); fetchCarriers(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <Card className="glass-card border-slate-200 dark:border-white/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Search carriers by name..."
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              <option value="insurance">Insurance</option>
              <option value="healthshare">Healthshare</option>
              <option value="medicaid">Medicaid</option>
              <option value="short_term">Short-Term</option>
            </select>
            <Button onClick={handleSearch} size="sm">
              <Search className="w-4 h-4 mr-2" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Carriers List */}
      {carriers.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No carriers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {carriers.map((carrier) => {
            const isExpanded = expandedCarrier === carrier.id;
            const carrierPlans = plans[carrier.id];
            const isLoadingPlans = loadingPlans === carrier.id;

            return (
              <Card
                key={carrier.id}
                className="glass-card border-slate-200 dark:border-white/10 overflow-hidden"
              >
                <CardContent className="py-0">
                  {/* Carrier Row */}
                  <button
                    type="button"
                    onClick={() => handleExpand(carrier.id)}
                    className="w-full flex items-center justify-between py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors -mx-6 px-6"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center shrink-0">
                        {carrier.logo_url ? (
                          <img
                            src={carrier.logo_url}
                            alt={carrier.carrier_name}
                            className="w-8 h-8 rounded object-contain"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                          {carrier.carrier_name}
                        </h3>
                        <div className="flex items-center gap-3 text-sm mt-0.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${CARRIER_TYPE_COLORS[carrier.carrier_type] || CARRIER_TYPE_COLORS.insurance}`}
                          >
                            {CARRIER_TYPE_LABELS[carrier.carrier_type] || carrier.carrier_type}
                          </span>
                          {carrier.naic_code && (
                            <span className="text-slate-500 dark:text-slate-400 text-xs">
                              NAIC: {carrier.naic_code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {carrier.website && (
                        <Globe className="w-4 h-4 text-slate-400" />
                      )}
                      {carrier.phone && (
                        <Phone className="w-4 h-4 text-slate-400" />
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Plans */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-white/10 py-4 -mx-6 px-6">
                      {/* Carrier Details */}
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-4">
                        {carrier.website && (
                          <a
                            href={carrier.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400"
                          >
                            <Globe className="w-4 h-4" /> Website
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {carrier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {carrier.phone}
                          </span>
                        )}
                        {carrier.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" /> {carrier.email}
                          </span>
                        )}
                      </div>

                      {/* Plans */}
                      {isLoadingPlans ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                          <span className="ml-2 text-sm text-slate-500">Loading plans...</span>
                        </div>
                      ) : carrierPlans && carrierPlans.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Available Plans ({carrierPlans.length})
                          </h4>
                          {carrierPlans.map((plan) => (
                            <div
                              key={plan.id}
                              className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {plan.plan_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                    {plan.plan_type}
                                  </span>
                                  {plan.metal_level && (
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full capitalize ${METAL_COLORS[plan.metal_level] || 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                                    >
                                      {plan.metal_level}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-sm shrink-0 ml-4">
                                {plan.base_premium != null && (
                                  <div className="text-right">
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      ${plan.base_premium.toLocaleString()}/mo
                                    </p>
                                    <p className="text-xs text-slate-500">Premium</p>
                                  </div>
                                )}
                                {plan.deductible != null && (
                                  <div className="text-right">
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      ${plan.deductible.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-500">Deductible</p>
                                  </div>
                                )}
                                {plan.max_oop != null && (
                                  <div className="text-right">
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      ${plan.max_oop.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-500">Max OOP</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-6 text-sm">
                          No plans loaded for this carrier. Use the carrier search to find plans by state.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
