'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
}

type SortBy = 'price_asc' | 'price_desc';

export function CashPaySearch() {
  const [zipCode, setZipCode] = useState('');
  const [allMsas, setAllMsas] = useState<MsaOption[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [stateName, setStateName] = useState('');
  const [msaName, setMsaName] = useState('');
  const [procedureCode, setProcedureCode] = useState('');
  const [category, setCategory] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');

  const [rates, setRates] = useState<HclRate[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const msas = useMemo(
    () => (stateName ? allMsas.filter((m) => m.stateName === stateName) : allMsas),
    [allMsas, stateName],
  );

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
      const res = await fetch(`/api/meta?${params}`);
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
      if (data.preferredState) setStateName(data.preferredState);
      if (data.preferredZip) {
        setZipCode((prev) => prev || data.preferredZip);
      }
    } catch {
      setError('Could not load metro areas. Try again shortly.');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta('');
  }, [loadMeta]);

  useEffect(() => {
    if (!stateName) return;
    const first = msas[0];
    if (first && !msas.some((m) => m.msaName === msaName)) {
      setMsaName(first.msaName);
    }
  }, [stateName, msas, msaName]);

  const search = async (nextPage = 1) => {
    setLoading(true);
    setError('');
    setNotice('');
    setSearched(true);
    setPage(nextPage);

    try {
      const params = new URLSearchParams({
        state: stateName,
        msa: msaName,
        page: String(nextPage),
        pageSize: '25',
      });
      if (zipCode) params.set('zip', zipCode);
      if (procedureCode.trim()) params.set('procedureCode', procedureCode.trim());
      if (category.trim()) params.set('category', category.trim());
      if (specialty) params.set('specialty', specialty);

      const res = await fetch(`/api/rates?${params}`);
      const data = await res.json();

      if (!res.ok) {
        setRates([]);
        setTotalCount(0);
        setHasMore(false);
        setError(data.message || 'Search failed');
        if (data.error === 'no_msa_mapping' || data.error === 'empty') {
          setNotice('This metro is not in the published file yet, or no rates matched.');
        } else if (data.error === 'invalid_key' || data.error === 'misconfigured') {
          setNotice('Live rates are not available yet for this environment.');
        }
        return;
      }

      let list: HclRate[] = data.rates || [];
      list = [...list].sort((a, b) =>
        sortBy === 'price_asc' ? a.rate - b.rate : b.rate - a.rate,
      );
      setRates(list);
      setTotalCount(data.totalCount ?? list.length);
      setHasMore(Boolean(data.hasMore));
      if (list.length === 0) {
        setNotice('No published cash rates matched. Try another CPT or metro.');
      }
    } catch {
      setError('Network error. Please try again.');
      setRates([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) =>
      sortBy === 'price_asc' ? a.rate - b.rate : b.rate - a.rate,
    );
  }, [rates, sortBy]);

  return (
    <div className="cashpay-search space-y-4">
      <p className="text-sm text-muted-foreground">
        Not a quote or insurance estimate. Figures come from published cash / self-pay
        files — hospital and facility, pharmacy (RX / NDC), imaging, labs, and other billed
        services in the load. Completeness varies by metro and specialty.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">ZIP</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onBlur={() => {
              if (/^\d{5}$/.test(zipCode)) void loadMeta(zipCode);
            }}
            placeholder="97201"
            inputMode="numeric"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">State</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={stateName}
            disabled={metaLoading}
            onChange={(e) => {
              setStateName(e.target.value);
              setMsaName('');
            }}
          >
            <option value="">Select state</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Metro (MSA)</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={msaName}
            disabled={!stateName || msas.length === 0}
            onChange={(e) => setMsaName(e.target.value)}
          >
            <option value="">Select metro</option>
            {msas.map((m) => (
              <option key={`${m.stateName}-${m.msaName}`} value={m.msaName}>
                {m.msaName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">What to price</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={specialty}
            disabled={metaLoading || specialties.length === 0}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            {specialties.map((s) => (
              <option key={s.id || s.hclName} value={s.hclName}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {specialties.find((s) => s.hclName === specialty)?.codeHint || 'CPT / NDC'}
          </span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={procedureCode}
            onChange={(e) => setProcedureCode(e.target.value)}
            placeholder="Optional — CPT, HCPCS, or NDC"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sort</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        className="lp-btn-primary"
        disabled={loading || !stateName || !msaName}
        onClick={() => void search(1)}
      >
        {loading ? 'Searching…' : 'Search cash prices'}
      </button>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-amber-700 dark:text-amber-400">{notice}</p> : null}

      {searched && !loading && sortedRates.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No results for this search.</p>
      ) : null}

      {sortedRates.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Facility / pharmacy</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Cash rate</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map((r) => (
                <tr key={String(r.id)} className="border-b border-border/60">
                  <td className="px-3 py-2">{r.facilityName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(', ')}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.procedureCode}</td>
                  <td className="px-3 py-2">{r.codeDescription || r.category}</td>
                  <td className="cashpay-rate px-3 py-2 text-right">{formatPrice(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {sortedRates.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            Page {page}
            {totalCount ? ` · ${totalCount.toLocaleString()} total` : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="lp-btn-secondary"
              disabled={loading || page <= 1}
              onClick={() => void search(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="lp-btn-secondary"
              disabled={loading || !hasMore}
              onClick={() => void search(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
