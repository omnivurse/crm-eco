'use client';

import { useState, useCallback } from 'react';
import {
  MagnifyingGlass,
  MapPin,
  CurrencyDollar,
  Star,
  Phone,
  ArrowsDownUp,
  CircleNotch,
  TrendDown,
  TrendUp,
  ShieldCheck,
  Clock,
} from '@phosphor-icons/react';
import { Card, CardContent } from '@crm-eco/ui/components/card';
import { Button } from '@crm-eco/ui/components/button';
import { Input } from '@crm-eco/ui/components/input';
import { Badge } from '@crm-eco/ui/components/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@crm-eco/ui/components/select';
import { cn } from '@crm-eco/ui/lib/utils';
import { Bezel } from '@/components/ui/Bezel';

interface Procedure {
  id: string;
  procedure_code: string;
  procedure_name: string;
  category: string;
  avg_national_price: number | null;
}

interface PricingResult {
  procedure_id: string;
  procedure_code: string;
  procedure_name: string;
  category: string;
  avg_national_price: number | null;
  provider_location_id: string;
  provider_name: string;
  provider_type: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  latitude: number;
  longitude: number;
  cash_price: number;
  discounted_price: number | null;
  price_range_low: number | null;
  price_range_high: number | null;
  distance_miles: number | null;
  rating: number | null;
  review_count: number | null;
  last_verified_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  urgent_care: 'Urgent Care',
  imaging_center: 'Imaging Center',
  lab: 'Lab',
  hospital: 'Hospital',
  clinic: 'Clinic',
  pharmacy: 'Pharmacy',
};

interface PricingSearchProps {
  memberZip?: string;
  procedures: Procedure[];
}

export function PricingSearch({ memberZip, procedures }: PricingSearchProps) {
  const [zipCode, setZipCode] = useState(memberZip || '');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [results, setResults] = useState<PricingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'price_asc' | 'price_desc'>('distance');

  const handleSearch = useCallback(async () => {
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams({ zip: zipCode });
      if (selectedProcedure) params.set('procedure', selectedProcedure);
      const res = await fetch(`/api/pricing/search?${params}`);
      if (!res.ok) throw new Error('Failed to search');
      const data = await res.json();
      setResults(data.results || []);
      setSearched(true);
    } catch {
      setError('Unable to search pricing. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [zipCode, selectedProcedure]);

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'price_asc') return a.cash_price - b.cash_price;
    if (sortBy === 'price_desc') return b.cash_price - a.cash_price;
    // distance — nulls last
    const aDist = a.distance_miles ?? 99999;
    const bDist = b.distance_miles ?? 99999;
    return aDist - bDist;
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            weight={i < full || (i === full && half) ? 'fill' : 'light'}
            className={cn(
              'h-3.5 w-3.5',
              i < full
                ? 'text-amber-400'
                : i === full && half
                  ? 'text-amber-300'
                  : 'text-slate-300'
            )}
          />
        ))}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Bezel>
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative max-w-xs flex-1">
              <MapPin weight="light" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
            <Select value={selectedProcedure} onValueChange={setSelectedProcedure}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="All procedures" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All procedures</SelectItem>
                {procedures.map((p) => (
                  <SelectItem key={p.id} value={p.procedure_name}>
                    {p.procedure_name}
                    {p.avg_national_price && (
                      <span className="ml-1 text-slate-400">
                        (avg {formatPrice(p.avg_national_price)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="gap-2 bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]"
            >
              {loading ? (
                <CircleNotch weight="light" className="h-4 w-4 animate-spin" />
              ) : (
                <MagnifyingGlass weight="light" className="h-4 w-4" />
              )}
              Compare Prices
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

      {!loading && searched && results.length === 0 && (
        <Bezel>
          <div className="px-6 py-12 text-center">
            <CurrencyDollar weight="light" className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-lg font-semibold text-[var(--mp-ink)]">No Pricing Found</h3>
            <p className="text-slate-500">
              No cash pricing data is available for this search.
              Try a different ZIP code or procedure.
            </p>
          </div>
        </Bezel>
      )}

      {!loading && searched && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {results.length} result{results.length !== 1 ? 's' : ''} near {zipCode}
            </p>
            <div className="flex items-center gap-2">
              <ArrowsDownUp weight="light" className="h-4 w-4 text-slate-400" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distance">Nearest first</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {sortedResults.map((r) => {
              const savings = r.avg_national_price
                ? Math.round(((r.avg_national_price - r.cash_price) / r.avg_national_price) * 100)
                : null;

              return (
                <Card key={`${r.procedure_id}-${r.provider_location_id}`}>
                  <CardContent className="pb-4 pt-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="truncate font-semibold text-[var(--mp-ink)]">{r.provider_name}</h3>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {TYPE_LABELS[r.provider_type] || r.provider_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500">
                          {r.address && `${r.address}, `}{r.city}, {r.state} {r.zip}
                        </p>
                        {r.distance_miles != null && (
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--mp-teal)]">
                            <MapPin weight="light" className="h-3.5 w-3.5" />
                            {r.distance_miles} miles away
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          {r.rating != null && (
                            <div className="flex items-center gap-1">
                              {renderStars(r.rating)}
                              <span className="text-xs text-slate-500">
                                {r.rating}
                                {r.review_count != null && ` (${r.review_count})`}
                              </span>
                            </div>
                          )}
                          {r.phone && (
                            <a
                              href={`tel:${r.phone.replace(/\D/g, '')}`}
                              className="inline-flex items-center gap-1 text-sm text-[var(--mp-teal)] hover:underline"
                            >
                              <Phone weight="light" className="h-3.5 w-3.5" />
                              {r.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 sm:min-w-[160px] sm:text-right">
                        <p className="mb-0.5 text-xs uppercase tracking-wider text-slate-500">
                          {r.procedure_name}
                        </p>
                        <p className="text-2xl font-bold tracking-[-0.03em] text-[var(--mp-ink)]">
                          {formatPrice(r.cash_price)}
                        </p>
                        {r.discounted_price && r.discounted_price < r.cash_price && (
                          <p className="flex items-center gap-1 text-sm font-medium text-[var(--mp-teal)] sm:justify-end">
                            <ShieldCheck weight="light" className="h-3.5 w-3.5" />
                            Member: {formatPrice(r.discounted_price)}
                          </p>
                        )}
                        {savings != null && savings > 0 && (
                          <Badge className="mt-1 bg-emerald-50 text-emerald-700">
                            <TrendDown weight="light" className="mr-0.5 h-3 w-3" />
                            {savings}% below avg
                          </Badge>
                        )}
                        {savings != null && savings < 0 && (
                          <Badge className="mt-1 bg-red-50 text-red-700">
                            <TrendUp weight="light" className="mr-0.5 h-3 w-3" />
                            {Math.abs(savings)}% above avg
                          </Badge>
                        )}
                        {r.last_verified_at && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 sm:justify-end">
                            <Clock weight="light" className="h-3 w-3" />
                            Verified {new Date(r.last_verified_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
