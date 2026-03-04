'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  MapPin,
  Phone,
  ChevronRight,
  ChevronDown,
  Building2,
  Stethoscope,
  Zap,
  Brain,
  Eye,
  FlaskConical,
  Scan,
  Smile,
  Pill,
  Heart,
  Video,
  UserCheck,
  Loader2,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';

interface Service {
  service_id: string;
  service_code: string;
  service_name: string;
  service_category: string;
  description: string;
  provider_network: string;
  icon: string;
  color: string;
  coverage_level: string;
  location_count: number;
  nearest_location: Record<string, unknown> | null;
}

interface Location {
  location_id: string;
  name: string;
  location_type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  latitude: number;
  longitude: number;
  telehealth_capable: boolean;
  accepting_new_patients: boolean;
  services: Array<{ service_id: string; service_name: string; service_category: string }> | null;
}

const CATEGORY_CONFIG: Record<string, { label: string; Icon: typeof Stethoscope; color: string }> = {
  primary_care:    { label: 'Primary Care',     Icon: Stethoscope,  color: 'bg-blue-100 text-blue-700' },
  telehealth:      { label: 'Telehealth',       Icon: Video,        color: 'bg-purple-100 text-purple-700' },
  urgent_care:     { label: 'Urgent Care',      Icon: Zap,          color: 'bg-red-100 text-red-700' },
  specialist:      { label: 'Specialists',      Icon: UserCheck,    color: 'bg-indigo-100 text-indigo-700' },
  mental_health:   { label: 'Mental Health',    Icon: Brain,        color: 'bg-pink-100 text-pink-700' },
  dental:          { label: 'Dental',           Icon: Smile,        color: 'bg-cyan-100 text-cyan-700' },
  vision:          { label: 'Vision',           Icon: Eye,          color: 'bg-amber-100 text-amber-700' },
  pharmacy:        { label: 'Pharmacy',         Icon: Pill,         color: 'bg-green-100 text-green-700' },
  lab:             { label: 'Lab & Diagnostics', Icon: FlaskConical, color: 'bg-orange-100 text-orange-700' },
  imaging:         { label: 'Imaging',          Icon: Scan,         color: 'bg-teal-100 text-teal-700' },
  physical_therapy: { label: 'Physical Therapy', Icon: Activity,    color: 'bg-lime-100 text-lime-700' },
  wellness:        { label: 'Wellness',         Icon: Heart,        color: 'bg-rose-100 text-rose-700' },
};

const COVERAGE_COLORS: Record<string, string> = {
  full: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  referral_only: 'bg-blue-100 text-blue-700',
  telehealth_only: 'bg-purple-100 text-purple-700',
};

interface ServicesSearchProps {
  memberZip?: string;
}

export function ServicesSearch({ memberZip }: ServicesSearchProps) {
  const [zipCode, setZipCode] = useState(memberZip || '');
  const [services, setServices] = useState<Service[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Service[]>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  // Drill-down state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }
    setError('');
    setLoading(true);
    setSelectedService(null);
    setLocations([]);

    try {
      const res = await fetch(`/api/services?zip=${zipCode}`);
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      setServices(data.services || []);
      setByCategory(data.by_category || {});
      setSearched(true);
    } catch {
      setError('Unable to search services. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [zipCode]);

  const handleServiceClick = useCallback(async (service: Service) => {
    if (selectedService?.service_id === service.service_id) {
      setSelectedService(null);
      setLocations([]);
      return;
    }
    setSelectedService(service);
    setLocationsLoading(true);
    try {
      const res = await fetch(`/api/services/locations?zip=${zipCode}&service_id=${service.service_id}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setLocations(data.locations || []);
    } catch {
      setLocations([]);
    } finally {
      setLocationsLoading(false);
    }
  }, [zipCode, selectedService]);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Enter ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
                maxLength={5}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="gap-2"
              style={{ backgroundColor: '#047474' }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      )}

      {!loading && searched && services.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Services Found</h3>
            <p className="text-slate-500">
              No healthcare services are currently available for ZIP code {zipCode}.
              Try a nearby ZIP code.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && searched && Object.keys(byCategory).length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {services.length} service{services.length !== 1 ? 's' : ''} available near {zipCode}
          </p>

          {Object.entries(byCategory).map(([cat, catServices]) => {
            const config = CATEGORY_CONFIG[cat] || { label: cat.replace(/_/g, ' '), Icon: Building2, color: 'bg-slate-100 text-slate-700' };
            const CategoryIcon = config.Icon;

            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className={cn('inline-flex items-center justify-center w-8 h-8 rounded-lg', config.color)}>
                      <CategoryIcon className="h-4 w-4" />
                    </span>
                    {config.label}
                    <Badge variant="secondary" className="ml-auto">{catServices.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {catServices.map((svc) => {
                    const isExpanded = selectedService?.service_id === svc.service_id;

                    return (
                      <div key={svc.service_id}>
                        <button
                          type="button"
                          onClick={() => handleServiceClick(svc)}
                          className={cn(
                            'w-full text-left p-3 rounded-lg border transition-colors',
                            isExpanded
                              ? 'bg-teal-50 border-teal-200'
                              : 'bg-slate-50 border-transparent hover:bg-slate-100'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900">{svc.service_name}</p>
                              {svc.description && (
                                <p className="text-sm text-slate-500 truncate">{svc.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3 shrink-0">
                              {svc.coverage_level && (
                                <Badge className={COVERAGE_COLORS[svc.coverage_level] || 'bg-slate-100 text-slate-600'}>
                                  {svc.coverage_level.replace(/_/g, ' ')}
                                </Badge>
                              )}
                              <span className="text-xs text-slate-400">
                                {svc.location_count} location{svc.location_count !== 1 ? 's' : ''}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded locations */}
                        {isExpanded && (
                          <div className="mt-2 ml-4 space-y-2">
                            {locationsLoading ? (
                              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading locations...
                              </div>
                            ) : locations.length === 0 ? (
                              <p className="py-3 text-sm text-slate-500">No locations found for this service.</p>
                            ) : (
                              locations.map((loc) => (
                                <div
                                  key={loc.location_id}
                                  className="p-3 rounded-lg border bg-white"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-900">{loc.name}</p>
                                      <p className="text-sm text-slate-500">
                                        {loc.address && `${loc.address}, `}{loc.city}, {loc.state} {loc.zip}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1.5">
                                        {loc.phone && (
                                          <a
                                            href={`tel:${loc.phone.replace(/\D/g, '')}`}
                                            className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Phone className="h-3.5 w-3.5" />
                                            {loc.phone}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                      {loc.accepting_new_patients && (
                                        <Badge className="bg-green-100 text-green-700 text-xs">Accepting Patients</Badge>
                                      )}
                                      {loc.telehealth_capable && (
                                        <Badge className="bg-purple-100 text-purple-700 text-xs">Telehealth</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
