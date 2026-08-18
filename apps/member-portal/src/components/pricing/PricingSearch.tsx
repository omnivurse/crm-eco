'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlass,
  MapPin,
  CurrencyDollar,
  CircleNotch,
  Info,
  CaretLeft,
  CaretRight,
  ArrowsDownUp,
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
import { Bezel } from '@/components/ui/Bezel';

interface Procedure {
  id: string;
  procedure_code: string;
  procedure_name: string;
  category: string;
  avg_national_price: number | null;
}

interface MsaOption {
  stateName: string;
  msaName: string;
  specialty?: string;
}

interface SpecialtyOption {
  id: string;
  label: string;
  hclName: string;
  codeHint: string;
}

interface HclRate {
  id: number | string;
  facilityName: string;
  city: string;
  state: string;
  procedureCode: string;
  codeDescription: string;
  category: string;
  rate: number;
  paymentMethod: string | null;
  carrier: string | null;
  planName: string | null;
}

interface LegacyResult {
  procedure_id: string;
  procedure_code: string;
  procedure_name: string;
  provider_location_id: string;
  provider_name: string;
  city: string;
  state: string;
  zip: string;
  cash_price: number;
  distance_miles: number | null;
}

interface PricingSearchProps {
  memberZip?: string;
  memberState?: string;
  procedures: Procedure[];
}

type SortBy = 'price_asc' | 'price_desc';

export function PricingSearch({ memberZip, memberState, procedures }: PricingSearchProps) {
  const [zipCode, setZipCode] = useState(memberZip || '');
  const [allMsas, setAllMsas] = useState<MsaOption[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [stateName, setStateName] = useState(memberState || '');
  const [msaName, setMsaName] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [selectedProcedureName, setSelectedProcedureName] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');

  const msas = useMemo(
    () => (stateName ? allMsas.filter((m) => m.stateName === stateName) : allMsas),
    [allMsas, stateName],
  );

  const [hclRates, setHclRates] = useState<HclRate[]>([]);
  const [legacyResults, setLegacyResults] = useState<LegacyResult[]>([]);
  const [source, setSource] = useState<'hcl' | 'legacy' | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);

  const loadMeta = useCallback(async (zip: string) => {
    setMetaLoading(true);
    try {
      const params = new URLSearchParams({ meta: '1' });
      if (zip) params.set('zip', zip);
      const res = await fetch(`/api/pricing/hcl?${params}`);
      if (!res.ok) throw new Error('meta failed');
      const data = await res.json();
      setStates(data.states || []);
      setAllMsas(data.msas || []);
      const nextSpecialties: SpecialtyOption[] = data.specialties || [];
      setSpecialties(nextSpecialties);
      setSpecialty((prev) => {
        if (prev && nextSpecialties.some((s) => s.hclName === prev)) return prev;
        return data.defaultSpecialty || nextSpecialties[0]?.hclName || '';
      });
      const nextState = data.preferredState || memberState || data.states?.[0] || '';
      setStateName(nextState);
      const forState: MsaOption[] = (data.msas || []).filter(
        (m: MsaOption) => m.stateName === nextState,
      );
      setMsaName((prev) => {
        if (prev && forState.some((m) => m.msaName === prev)) return prev;
        return forState[0]?.msaName || '';
      });
      if (data.preferredZip && !zipCode) setZipCode(data.preferredZip);
    } catch {
      setNotice('Metro list unavailable — backup search still works with ZIP.');
    } finally {
      setMetaLoading(false);
    }
  }, [memberState, zipCode]);

  useEffect(() => {
    void loadMeta(memberZip || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateName) return;
    const forState = allMsas.filter((m) => m.stateName === stateName);
    setMsaName((prev) =>
      forState.some((m) => m.msaName === prev) ? prev : forState[0]?.msaName || '',
    );
  }, [stateName, allMsas]);

  const runLegacySearch = useCallback(async () => {
    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      setError('Enter a valid 5-digit ZIP for backup search.');
      return false;
    }
    const params = new URLSearchParams({ zip: zipCode });
    if (selectedProcedureName && selectedProcedureName !== '__all__') {
      params.set('procedure', selectedProcedureName);
    }
    const res = await fetch(`/api/pricing/search?${params}`);
    if (!res.ok) throw new Error('legacy failed');
    const data = await res.json();
    setLegacyResults(data.results || []);
    setHclRates([]);
    setSource('legacy');
    setTotalCount((data.results || []).length);
    setHasMore(false);
    setNotice(
      'Showing backup cash-price directory. Published hospital / RX files for this metro are not available yet.',
    );
    return true;
  }, [zipCode, selectedProcedureName]);

  const handleSearch = useCallback(
    async (nextPage = 1) => {
      setError('');
      setNotice('');
      setLoading(true);
      setPage(nextPage);
      try {
        if (msaName && stateName) {
          const params = new URLSearchParams({
            state: stateName,
            msa: msaName,
            page: String(nextPage),
            pageSize: '25',
          });
          if (zipCode) params.set('zip', zipCode);
          if (procedureCode) params.set('procedureCode', procedureCode);
          if (specialty) params.set('specialty', specialty);
          const res = await fetch(`/api/pricing/hcl?${params}`);
          const data = await res.json();
          if (res.ok && data.rates) {
            setHclRates(data.rates);
            setLegacyResults([]);
            setSource('hcl');
            setTotalCount(data.totalCount || data.rates.length);
            setHasMore(Boolean(data.hasMore));
            setSearched(true);
            return;
          }
          if (data.fallback) {
            await runLegacySearch();
            setSearched(true);
            return;
          }
          setError(data.message || 'Unable to search pricing.');
          setSearched(true);
          return;
        }
        await runLegacySearch();
        setSearched(true);
      } catch {
        setError('Unable to search pricing. Please try again.');
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [msaName, stateName, zipCode, procedureCode, specialty, runLegacySearch],
  );

  const sortedHcl = useMemo(() => {
    const copy = [...hclRates];
    copy.sort((a, b) => (sortBy === 'price_asc' ? a.rate - b.rate : b.rate - a.rate));
    return copy;
  }, [hclRates, sortBy]);

  const sortedLegacy = useMemo(() => {
    const copy = [...legacyResults];
    copy.sort((a, b) =>
      sortBy === 'price_asc' ? a.cash_price - b.cash_price : b.cash_price - a.cash_price,
    );
    return copy;
  }, [legacyResults, sortBy]);

  return (
    <div className="space-y-6">
      <Bezel>
        <div className="space-y-4 p-5 md:p-6">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Info weight="light" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mp-teal)]" />
            <p>
              Cash Pay covers published cash / self-pay figures for hospital and facility care,
              pharmacy (RX / NDC), imaging, labs, and other billed services in the file. Not a
              quote, not insurance, and coverage varies by metro. Confirm with the provider.
              Care over your IUA may not be shareable —{' '}
              <Link href="/needs/new" className="font-medium text-[var(--mp-teal)] underline-offset-2 hover:underline">
                submit a need
              </Link>{' '}
              with your receipt when appropriate.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <MapPin weight="light" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onBlur={() => zipCode.length === 5 && void loadMeta(zipCode)}
                className="pl-9"
                maxLength={5}
                aria-label="ZIP code"
              />
            </div>

            <Select
              value={stateName || undefined}
              onValueChange={setStateName}
              disabled={metaLoading || states.length === 0}
            >
              <SelectTrigger aria-label="State">
                <SelectValue placeholder={metaLoading ? 'Loading states…' : 'State'} />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={msaName || undefined}
              onValueChange={setMsaName}
              disabled={metaLoading || msas.length === 0}
            >
              <SelectTrigger aria-label="Metro area">
                <SelectValue placeholder={msas.length ? 'Metro area (MSA)' : 'No metro on file'} />
              </SelectTrigger>
              <SelectContent>
                {msas.map((m) => (
                  <SelectItem key={m.msaName} value={m.msaName}>
                    {m.msaName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={specialty || undefined}
              onValueChange={setSpecialty}
              disabled={metaLoading || specialties.length === 0}
            >
              <SelectTrigger aria-label="What to price">
                <SelectValue placeholder="Hospital, RX, imaging…" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.id || s.hclName} value={s.hclName}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="text"
              placeholder={
                specialties.find((s) => s.hclName === specialty)?.codeHint
                  ? `${specialties.find((s) => s.hclName === specialty)?.codeHint} (optional)`
                  : 'CPT, HCPCS, or NDC (optional)'
              }
              value={procedureCode}
              onChange={(e) => setProcedureCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 11))}
              aria-label="Procedure or NDC code"
            />

            <Select
              value={selectedProcedureName || '__all__'}
              onValueChange={(v) => {
                setSelectedProcedureName(v === '__all__' ? '' : v);
                const match = procedures.find((p) => p.procedure_name === v);
                if (match?.procedure_code) setProcedureCode(match.procedure_code);
              }}
            >
              <SelectTrigger aria-label="Procedure name">
                <SelectValue placeholder="Procedure (backup search)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All procedures</SelectItem>
                {procedures.map((p) => (
                  <SelectItem key={p.id} value={p.procedure_name}>
                    {p.procedure_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => void handleSearch(1)}
              disabled={loading || metaLoading}
              className="gap-2 bg-[var(--mp-teal)] hover:bg-[var(--mp-teal-soft)]"
            >
              {loading ? (
                <CircleNotch weight="light" className="h-4 w-4 animate-spin" />
              ) : (
                <MagnifyingGlass weight="light" className="h-4 w-4" />
              )}
              Compare prices
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-amber-700">{notice}</p>}
        </div>
      </Bezel>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <CircleNotch weight="light" className="h-8 w-8 animate-spin text-[var(--mp-teal)]" />
        </div>
      )}

      {!loading && searched && source === 'hcl' && sortedHcl.length === 0 && (
        <Bezel>
          <div className="px-6 py-12 text-center">
            <CurrencyDollar weight="light" className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-lg font-semibold text-[var(--mp-ink)]">No prices in this file</h3>
            <p className="text-slate-500">Try another CPT code or metro area.</p>
          </div>
        </Bezel>
      )}

      {!loading && searched && source === 'legacy' && sortedLegacy.length === 0 && (
        <Bezel>
          <div className="px-6 py-12 text-center">
            <CurrencyDollar weight="light" className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <h3 className="mb-1 text-lg font-semibold text-[var(--mp-ink)]">No pricing found</h3>
            <p className="text-slate-500">Try a different ZIP or procedure.</p>
          </div>
        </Bezel>
      )}

      {!loading && searched && (sortedHcl.length > 0 || sortedLegacy.length > 0) && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {source === 'hcl'
                ? `${totalCount.toLocaleString()} published rate${totalCount === 1 ? '' : 's'} · page ${page}`
                : `${sortedLegacy.length} backup result${sortedLegacy.length === 1 ? '' : 's'} near ${zipCode}`}
            </p>
            <div className="flex items-center gap-2">
              <ArrowsDownUp weight="light" className="h-4 w-4 text-slate-400" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">Price: low to high</SelectItem>
                  <SelectItem value="price_desc">Price: high to low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {source === 'hcl' &&
              sortedHcl.map((r) => (
                <Card key={`${r.id}-${r.facilityName}-${r.procedureCode}`}>
                  <CardContent className="flex flex-col gap-3 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[var(--mp-ink)]">{r.facilityName}</h3>
                        {r.category && (
                          <Badge variant="outline" className="text-xs">
                            {r.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {[r.city, r.state].filter(Boolean).join(', ')}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {r.procedureCode && (
                          <span className="font-mono text-xs text-slate-500">{r.procedureCode} · </span>
                        )}
                        {r.codeDescription || 'Procedure'}
                      </p>
                      {(r.paymentMethod || r.carrier) && (
                        <p className="mt-1 text-xs text-slate-400">
                          {[r.paymentMethod, r.carrier, r.planName].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="text-xs uppercase tracking-wider text-slate-500">Cash / listed</p>
                      <p className="text-2xl font-bold tracking-[-0.03em] text-amber-700">
                        {formatPrice(r.rate)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {source === 'legacy' &&
              sortedLegacy.map((r) => (
                <Card key={`${r.procedure_id}-${r.provider_location_id}`}>
                  <CardContent className="flex flex-col gap-3 pb-4 pt-4 sm:flex-row sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--mp-ink)]">{r.provider_name}</h3>
                      <p className="text-sm text-slate-500">
                        {r.city}, {r.state} {r.zip}
                        {r.distance_miles != null ? ` · ${r.distance_miles} mi` : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{r.procedure_name}</p>
                    </div>
                    <p className="text-2xl font-bold text-[var(--mp-ink)]">
                      {formatPrice(r.cash_price)}
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>

          {source === 'hcl' && (page > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => void handleSearch(page - 1)}
                className="gap-1"
              >
                <CaretLeft weight="light" className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || loading}
                onClick={() => void handleSearch(page + 1)}
                className="gap-1"
              >
                Next
                <CaretRight weight="light" className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
