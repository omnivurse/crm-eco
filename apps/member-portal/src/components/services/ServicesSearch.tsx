'use client';

import { useState, useCallback } from 'react';
import {
  MagnifyingGlass,
  MapPin,
  Phone,
  CaretRight,
  CaretDown,
  Buildings,
  Stethoscope,
  Lightning,
  Brain,
  Eye,
  Flask,
  Scan,
  Smiley,
  Pill,
  Heart,
  VideoCamera,
  UserCheck,
  CircleNotch,
  Pulse,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import { cn } from '@crm-eco/ui/lib/utils';
import { Bezel } from '@/components/ui/Bezel';

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
  primary_care:    { label: 'Primary Care',     Icon: Stethoscope,  color: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)]' },
  telehealth:      { label: 'Telehealth',       Icon: VideoCamera,  color: 'bg-[rgba(14,140,154,0.12)] text-[var(--mp-teal-soft)]' },
  urgent_care:     { label: 'Urgent Care',      Icon: Lightning,    color: 'bg-red-50 text-red-700' },
  specialist:      { label: 'Specialists',      Icon: UserCheck,    color: 'bg-slate-100 text-slate-700' },
  mental_health:   { label: 'Mental Health',    Icon: Brain,        color: 'bg-rose-50 text-rose-700' },
  dental:          { label: 'Dental',           Icon: Smiley,       color: 'bg-[rgba(11,109,133,0.08)] text-[var(--mp-teal)]' },
  vision:          { label: 'Vision',           Icon: Eye,          color: 'bg-amber-50 text-amber-700' },
  pharmacy:        { label: 'Pharmacy',         Icon: Pill,         color: 'bg-emerald-50 text-emerald-700' },
  lab:             { label: 'Lab & Diagnostics', Icon: Flask,       color: 'bg-orange-50 text-orange-700' },
  imaging:         { label: 'Imaging',          Icon: Scan,         color: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)]' },
  physical_therapy: { label: 'Physical Therapy', Icon: Pulse,       color: 'bg-lime-50 text-lime-700' },
  wellness:        { label: 'Wellness',         Icon: Heart,        color: 'bg-rose-50 text-rose-700' },
};

const COVERAGE_COLORS: Record<string, string> = {
  full: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  referral_only: 'bg-[rgba(11,109,133,0.1)] text-[var(--mp-teal)]',
  telehealth_only: 'bg-[rgba(14,140,154,0.12)] text-[var(--mp-teal-soft)]',
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
      <Bezel>
        <div className="p-5 md:p-6">
          <div className="flex gap-3">
            <div className="relative max-w-xs flex-1">
              <MapPin weight="light" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
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
              className="gap-2 bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]"
            >
              {loading ? (
                <CircleNotch weight="light" className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <MagnifyingGlass weight="light" className="h-4 w-4" aria-hidden />
              )}
              Search
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </Bezel>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--mp-teal)]" />
        </div>
      )}

      {!loading && searched && services.length === 0 && (
        <Bezel>
          <div className="px-6 py-12 text-center">
            <Buildings weight="light" className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden />
            <h3 className="mb-1 text-lg font-semibold text-[var(--mp-ink)]">No Services Found</h3>
            <p className="text-slate-500">
              No healthcare services are currently available for ZIP code {zipCode}.
              Try a nearby ZIP code.
            </p>
          </div>
        </Bezel>
      )}

      {!loading && searched && Object.keys(byCategory).length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {services.length} service{services.length !== 1 ? 's' : ''} available near {zipCode}
          </p>

          {Object.entries(byCategory).map(([cat, catServices]) => {
            const config = CATEGORY_CONFIG[cat] || { label: cat.replace(/_/g, ' '), Icon: Buildings, color: 'bg-slate-100 text-slate-700' };
            const CategoryIcon = config.Icon;

            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', config.color)}>
                      <CategoryIcon weight="light" className="h-4 w-4" aria-hidden />
                    </span>
                    {config.label}
                    <Badge variant="secondary" className="ml-auto">{catServices.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {catServices.map((svc) => {
                    const isExpanded = selectedService?.service_id === svc.service_id;

                    return (
                      <div key={svc.service_id}>
                        <button
                          type="button"
                          onClick={() => handleServiceClick(svc)}
                          className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                            isExpanded
                              ? 'border-[rgba(11,109,133,0.2)] bg-[rgba(11,109,133,0.06)]'
                              : 'border-transparent bg-slate-50 hover:bg-slate-100'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[var(--mp-ink)]">{svc.service_name}</p>
                              {svc.description && (
                                <p className="truncate text-sm text-slate-500">{svc.description}</p>
                              )}
                            </div>
                            <div className="ml-3 flex shrink-0 items-center gap-2">
                              {svc.coverage_level && (
                                <Badge className={COVERAGE_COLORS[svc.coverage_level] || 'bg-slate-100 text-slate-600'}>
                                  {svc.coverage_level.replace(/_/g, ' ')}
                                </Badge>
                              )}
                              <span className="text-xs text-slate-400">
                                {svc.location_count} location{svc.location_count !== 1 ? 's' : ''}
                              </span>
                              {isExpanded ? (
                                <CaretDown weight="light" className="h-4 w-4 text-slate-400" aria-hidden />
                              ) : (
                                <CaretRight weight="light" className="h-4 w-4 text-slate-400" aria-hidden />
                              )}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="ml-4 mt-2 space-y-2">
                            {locationsLoading ? (
                              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                                <CircleNotch weight="light" className="h-4 w-4 animate-spin" aria-hidden />
                                Loading locations...
                              </div>
                            ) : locations.length === 0 ? (
                              <p className="py-3 text-sm text-slate-500">No locations found for this service.</p>
                            ) : (
                              locations.map((loc) => (
                                <div
                                  key={loc.location_id}
                                  className="rounded-lg border border-[rgba(11,109,133,0.08)] bg-white p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-[var(--mp-ink)]">{loc.name}</p>
                                      <p className="text-sm text-slate-500">
                                        {loc.address && `${loc.address}, `}{loc.city}, {loc.state} {loc.zip}
                                      </p>
                                      <div className="mt-1.5 flex items-center gap-3">
                                        {loc.phone && (
                                          <a
                                            href={`tel:${loc.phone.replace(/\D/g, '')}`}
                                            className="inline-flex items-center gap-1 text-sm text-[var(--mp-teal)] hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <Phone weight="light" className="h-3.5 w-3.5" aria-hidden />
                                            {loc.phone}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                      {loc.accepting_new_patients && (
                                        <Badge className="bg-emerald-50 text-xs text-emerald-700">Accepting Patients</Badge>
                                      )}
                                      {loc.telehealth_capable && (
                                        <Badge className="bg-[rgba(11,109,133,0.1)] text-xs text-[var(--mp-teal)]">Telehealth</Badge>
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
