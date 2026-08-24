'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PushPin, PushPinSlash, X } from '@phosphor-icons/react';
import {
  classifyPayer,
  describeFacilityLine,
  describePayer,
  describePlan,
  facilitySpread,
  familyForCode,
  filterByRadius,
  flagRateOutliers,
  listDiscount,
  mapsUrl,
  medianListDiscount,
  milesFromOrigin,
  mixEntries,
  npiUrl,
  originFromSlice,
  partitionRates,
  payerClassLabel,
  payerMix,
  planNegotiation,
  qualityLookupUrl,
  searchProcedureFamilies,
  tickIdentity,
  uniquePayers,
  websiteHref,
  type PayerClass,
  type ProcedureFamily,
  type RadiusMiles,
} from '@crm-eco/cash-pay';
import { ThemeToggle } from '@/components/ThemeToggle';
import { brand } from '@/lib/brand';
import { formatCash, formatCmsDollars, formatNeedle, formatPct, tickKey } from '@/lib/format';
import type { HclRate, MsaOption, SliceSummary, SpecialtyOption } from '@/lib/hcl-types';
import styles from '@/app/instrument.module.css';

type SortBy = 'price_asc' | 'price_desc' | 'cms_asc' | 'payer' | 'off_list';
type Scope = 'metro' | 'market';

const EMPTY_SLICE: SliceSummary = {
  sliceCount: 0,
  low: null,
  median: null,
  high: null,
  cmsMin: null,
  cmsMax: null,
  fileSize: 0,
  scope: 'slice',
};

const PAYER_FILTERS: Array<{ id: 'all' | PayerClass; label: string }> = [
  { id: 'all', label: 'All payers' },
  { id: 'medicare', label: 'Medicare' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'medicaid', label: 'Medicaid' },
  { id: 'cash', label: 'Cash pay' },
  { id: 'workers_comp', label: 'Workers’ comp' },
];

function groupByFacility(rows: HclRate[]): Array<{
  facility: string;
  city: string;
  state: string;
  ticks: HclRate[];
}> {
  const map = new Map<string, HclRate[]>();
  for (const row of rows) {
    const key = row.facilityName.trim() || 'Unknown facility';
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].map(([facility, ticks]) => ({
    facility,
    city: ticks[0]?.city || '',
    state: ticks[0]?.state || '',
    ticks,
  }));
}

export function RateInstrument() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [zipCode, setZipCode] = useState(searchParams.get('zip') || '');
  const [allMsas, setAllMsas] = useState<MsaOption[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [stateName, setStateName] = useState(searchParams.get('state') || '');
  const [msaName, setMsaName] = useState(searchParams.get('msa') || '');
  const [procedureCode, setProcedureCode] = useState(searchParams.get('code') || '');
  const [procedureQuery, setProcedureQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1);
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');
  const [scope, setScope] = useState<Scope>((searchParams.get('scope') as Scope) || 'metro');
  const [radius, setRadius] = useState<RadiusMiles>(
    searchParams.get('radius') === '10' || searchParams.get('radius') === '25' || searchParams.get('radius') === '50'
      ? Number(searchParams.get('radius')) as RadiusMiles
      : 'metro',
  );
  const [payerFilter, setPayerFilter] = useState<'all' | PayerClass>('all');
  const [showOutliers, setShowOutliers] = useState(false);
  const [bid, setBid] = useState('');

  const [rates, setRates] = useState<HclRate[]>([]);
  const [slice, setSlice] = useState<SliceSummary>(EMPTY_SLICE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [zipHint, setZipHint] = useState('');
  const [pins, setPins] = useState<HclRate[]>([]);
  const [drawer, setDrawer] = useState<{ facility: string; hospitalId: number | null } | null>(null);
  const [drawerRates, setDrawerRates] = useState<HclRate[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const msas = useMemo(
    () => (stateName ? allMsas.filter((m) => m.stateName === stateName) : []),
    [allMsas, stateName],
  );

  const familyMatches = useMemo(
    () => (procedureQuery.trim().length >= 2 ? searchProcedureFamilies(procedureQuery) : []),
    [procedureQuery],
  );
  const activeFamily = useMemo(() => familyForCode(procedureCode), [procedureCode]);

  const writeUrl = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const loadMeta = useCallback(async (zip: string, applyPreferred = false) => {
    setMetaLoading(true);
    try {
      const params = new URLSearchParams();
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
      if (applyPreferred && data.preferredState) {
        setStateName(data.preferredState);
        if (data.preferredMsa) setMsaName(data.preferredMsa);
      } else {
        setStateName((prev) => prev || data.preferredState || '');
      }
    } catch {
      setError('Could not load HCL markets. Try again shortly.');
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta(searchParams.get('zip') || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateName || allMsas.length === 0) return;
    if (msaName && msas.some((m) => m.msaName === msaName)) return;
    setMsaName(msas[0]?.msaName || '');
  }, [stateName, msas, msaName, allMsas.length]);

  const fetchSlice = useCallback(
    async (metro: string, nextPage: number) => {
      const params = new URLSearchParams({
        state: stateName,
        msa: metro,
        page: String(nextPage),
        pageSize: '50',
      });
      if (zipCode) params.set('zip', zipCode);
      if (procedureCode.trim()) params.set('procedureCode', procedureCode.trim());
      if (category.trim()) params.set('category', category.trim());
      if (specialty) params.set('specialty', specialty);
      const res = await fetch(`/api/rates?${params}`);
      const data = await res.json();
      return { res, data, metro };
    },
    [category, procedureCode, specialty, stateName, zipCode],
  );

  const search = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      setError('');
      setNotice('');
      setSearched(true);
      setPage(nextPage);
      writeUrl({
        zip: zipCode,
        state: stateName,
        msa: msaName,
        code: procedureCode.trim(),
        q: procedureQuery.trim(),
        category: category.trim(),
        page: String(nextPage),
        scope,
        radius: radius === 'metro' ? '' : String(radius),
      });

      try {
        const metros =
          scope === 'market' && stateName
            ? msas.map((m) => m.msaName).slice(0, 6)
            : [msaName];
        const results = await Promise.all(metros.filter(Boolean).map((metro) => fetchSlice(metro, nextPage)));
        const failed = results.find((r) => !r.res.ok);
        if (failed && results.every((r) => !r.res.ok)) {
          setRates([]);
          setSlice(EMPTY_SLICE);
          setHasMore(false);
          setError(
            failed.data.error === 'rate_limited'
              ? 'Too many reads. Wait a moment, then try again.'
              : failed.data.message || 'Search failed',
          );
          return;
        }
        const list: HclRate[] = results.flatMap((r) => (r.res.ok ? r.data.rates || [] : []));
        const fileSize = results.reduce((sum, r) => sum + (r.data.slice?.fileSize || r.data.totalCount || 0), 0);
        const nextSlice = results.find((r) => r.res.ok)?.data.slice || EMPTY_SLICE;
        setRates(list);
        setSlice({ ...nextSlice, fileSize, sliceCount: list.length });
        setHasMore(scope === 'metro' && results.some((r) => r.res.ok && r.data.hasMore));
        if (list.length === 0) {
          setNotice('No ticks in this slice. Try another CPT or metro.');
        }
      } catch {
        setError('Network error. Please try again.');
        setRates([]);
      } finally {
        setLoading(false);
      }
    },
    [category, fetchSlice, msaName, msas, procedureCode, procedureQuery, radius, scope, stateName, writeUrl, zipCode],
  );

  const autoSearched = useRef(false);
  useEffect(() => {
    if (autoSearched.current || metaLoading || allMsas.length === 0) return;
    const urlState = searchParams.get('state');
    const urlMsa = searchParams.get('msa');
    if (!urlState || !urlMsa) return;
    if (stateName !== urlState || msaName !== urlMsa) return;
    autoSearched.current = true;
    void search(Number(searchParams.get('page') || '1') || 1);
  }, [allMsas.length, metaLoading, msaName, search, searchParams, stateName]);

  const hidden = useMemo(() => flagRateOutliers(rates), [rates]);
  const { kept, outliers } = useMemo(() => partitionRates(rates, hidden), [hidden, rates]);
  const origin = useMemo(() => originFromSlice(kept, zipCode), [kept, zipCode]);
  const nearby = useMemo(() => filterByRadius(kept, origin, radius), [kept, origin, radius]);
  const visible = useMemo(() => {
    const base = showOutliers ? [...nearby, ...outliers] : nearby;
    return payerFilter === 'all' ? base : base.filter((row) => classifyPayer(row) === payerFilter);
  }, [nearby, outliers, payerFilter, showOutliers]);

  const sortedRates = useMemo(() => {
    return [...visible].sort((a, b) => {
      if (sortBy === 'price_asc') return a.rate - b.rate;
      if (sortBy === 'price_desc') return b.rate - a.rate;
      if (sortBy === 'cms_asc') return (a.cmsRelativity ?? 99) - (b.cmsRelativity ?? 99);
      if (sortBy === 'off_list') return (listDiscount(b) ?? -1) - (listDiscount(a) ?? -1);
      return describePayer(a).localeCompare(describePayer(b));
    });
  }, [sortBy, visible]);

  const groups = useMemo(() => groupByFacility(sortedRates), [sortedRates]);
  const coach = useMemo(() => planNegotiation(nearby), [nearby]);
  const namedPayers = useMemo(() => uniquePayers(nearby), [nearby]);
  const mix = useMemo(() => mixEntries(payerMix(nearby)), [nearby]);
  const offList = useMemo(() => medianListDiscount(nearby), [nearby]);
  const bidNumber = Number(bid.replace(/[^0-9.]/g, ''));
  const bidVsMedicare =
    Number.isFinite(bidNumber) && bidNumber > 0 && coach.medicare
      ? bidNumber - coach.medicare
      : null;

  const togglePin = (row: HclRate) => {
    setPins((prev) => {
      const key = tickKey(row);
      if (prev.some((p) => tickKey(p) === key)) return prev.filter((p) => tickKey(p) !== key);
      if (prev.length >= 4) return prev;
      return [...prev, row];
    });
  };

  const pickFamily = (family: ProcedureFamily) => {
    setProcedureCode(family.code);
    setProcedureQuery(family.label);
  };

  const openDrawer = async (row: HclRate, trigger: HTMLElement) => {
    restoreFocus.current = trigger;
    setDrawer({ facility: row.facilityName, hospitalId: row.hospitalId });
    setDrawerRates([]);
    setDrawerLoading(true);
    dialogRef.current?.showModal();
    const mine = rates.filter((r) => r.facilityName === row.facilityName);
    if (mine.length > 0) setDrawerRates(mine);
    try {
      const params = new URLSearchParams({
        state: stateName,
        msa: msaName,
        pageSize: '50',
      });
      if (row.hospitalId != null) params.set('hospitalId', String(row.hospitalId));
      if (procedureCode.trim()) params.set('procedureCode', procedureCode.trim());
      if (specialty) params.set('specialty', specialty);
      const res = await fetch(`/api/rates?${params}`);
      const data = await res.json();
      const list: HclRate[] = data.rates || [];
      setDrawerRates(
        row.hospitalId != null ? list : list.filter((r) => r.facilityName === row.facilityName),
      );
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    dialogRef.current?.close();
    setDrawer(null);
    restoreFocus.current?.focus();
  };

  const applyBid = () => {
    if (coach.medicare) setBid(String(Math.round(coach.medicare)));
  };
  const applyOffer = () => {
    if (coach.cashOffer) setBid(String(coach.cashOffer));
  };

  return (
    <div className={`${styles.shell} ${pins.length > 0 ? styles.shellHasTray : ''}`}>
      <header className={styles.chrome}>
        <a className={styles.brand} href="/">
          <span className={styles.brandName}>{brand.product}</span>
          <span className={styles.brandMeta}>
            {msaName || 'No metro selected'}
            {procedureCode ? ` · CPT ${procedureCode}` : ''}
          </span>
        </a>
        <div className={styles.chromeActions}>
          <a className={styles.licenseLink} href="/#access">
            License this UI
          </a>
          <ThemeToggle />
        </div>
      </header>

      <div className={styles.stage}>
        <aside className={styles.rail}>
          <form
            className={styles.railSticky}
            onSubmit={(e) => {
              e.preventDefault();
              void search(1);
            }}
          >
            <label className={styles.field}>
              <span className={styles.label}>Procedure</span>
              <input
                className={styles.control}
                value={procedureQuery}
                placeholder="Knee surgery, mole, 27447…"
                onChange={(e) => {
                  setProcedureQuery(e.target.value);
                  const onlyCode = e.target.value.replace(/[^A-Za-z0-9]/g, '');
                  if (/^\d{4,5}$/.test(onlyCode) || /^[A-Za-z]\d{4}$/.test(onlyCode)) {
                    setProcedureCode(onlyCode.toUpperCase());
                  }
                }}
              />
            </label>
            {familyMatches.length > 0 ? (
              <ul className={styles.suggest}>
                {familyMatches.slice(0, 6).map((family) => (
                  <li key={family.id}>
                    <button type="button" onClick={() => pickFamily(family)}>
                      <span>{family.label}</span>
                      <span className={styles.mono}>{family.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className={`${styles.field} ${styles.heroCode}`}>
              <span className={styles.label}>CPT / HCPCS</span>
              <input
                className={styles.control}
                value={procedureCode}
                placeholder="Required for a tight tape"
                onChange={(e) =>
                  setProcedureCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 11))
                }
              />
            </label>
            {activeFamily ? (
              <div className={styles.companions}>
                <span className={styles.label}>Typical bill</span>
                <div className={styles.chipRow}>
                  <span className={styles.chipOn}>{activeFamily.code} hospital</span>
                  {activeFamily.companions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        setProcedureCode(c.code);
                        setProcedureQuery(c.label);
                      }}
                    >
                      {c.label} · {c.code}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className={styles.field}>
              <span className={styles.label}>ZIP</span>
              <input
                className={styles.control}
                value={zipCode}
                inputMode="numeric"
                autoComplete="postal-code"
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setZipCode(next);
                  if (next && next.length < 5) setZipHint('Enter a 5-digit ZIP.');
                  else setZipHint('');
                }}
                onBlur={() => {
                  if (!zipCode) {
                    setZipHint('');
                    return;
                  }
                  if (!/^\d{5}$/.test(zipCode)) {
                    setZipHint('Enter a 5-digit ZIP.');
                    return;
                  }
                  setZipHint('');
                  void loadMeta(zipCode, true);
                }}
              />
              {zipHint ? <span className={styles.error}>{zipHint}</span> : null}
            </label>
            <label className={styles.field}>
              <span className={styles.label}>HCL Market</span>
              <select
                className={styles.control}
                value={stateName}
                disabled={metaLoading}
                onChange={(e) => {
                  setStateName(e.target.value);
                  setMsaName('');
                }}
              >
                <option value="">Select market</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Metro</span>
              <select
                className={styles.control}
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
            <label className={styles.field}>
              <span className={styles.label}>Look in</span>
              <select
                className={styles.control}
                value={scope}
                onChange={(e) => setScope(e.target.value as Scope)}
              >
                <option value="metro">This metro</option>
                <option value="market">Every metro in this market</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Radius</span>
              <select
                className={styles.control}
                value={radius}
                onChange={(e) =>
                  setRadius(e.target.value === 'metro' ? 'metro' : (Number(e.target.value) as RadiusMiles))
                }
              >
                <option value="metro">Whole metro</option>
                <option value="10">10 miles</option>
                <option value="25">25 miles</option>
                <option value="50">50 miles</option>
              </select>
            </label>
            {specialties.length > 1 ? (
              <label className={styles.field}>
                <span className={styles.label}>Live specialty</span>
                <select
                  className={styles.control}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                >
                  {specialties.map((s) => (
                    <option key={s.id || s.hclName} value={s.hclName}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className={styles.note}>
                Live file: hospital cash, including every named payer at those hospitals. Clinic,
                pharmacy, imaging, and lab files are not on this key yet — ask HCL to map them.
              </p>
            )}
            <label className={styles.field}>
              <span className={styles.label}>Category</span>
              <input
                className={styles.control}
                value={category}
                placeholder="Optional"
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Sort</span>
              <select
                className={styles.control}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="cms_asc">Closest to Medicare</option>
                <option value="off_list">Biggest cut off list</option>
                <option value="payer">Payer name</option>
              </select>
            </label>
            <button className={styles.readBtn} type="submit" disabled={loading || !stateName || !msaName}>
              {loading ? 'Reading…' : 'Read the tape'}
            </button>
          </form>
        </aside>

        <section className={styles.tape} aria-live="polite">
          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.note}>{notice}</p> : null}

          {searched ? (
            <>
              <p className={styles.note}>
                This page, not the whole file. Every tick is a named payer, with the chargemaster
                list, the Medicare analog, and the published figure side by side.
              </p>
              <div className={styles.strip}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Kept / hidden</span>
                  <span className={styles.statValue}>
                    {nearby.length}
                    <span className={styles.statQuiet}> / {outliers.length}</span>
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Low / median / high</span>
                  <span className={styles.statValue} data-signal="true">
                    {coach.lowestKept != null ? formatCash(coach.lowestKept) : 'n/a'}
                    {coach.medianKept != null ? ` · ${formatCash(coach.medianKept)}` : ''}
                    {nearby.length ? ` · ${formatCash(Math.max(...nearby.map((r) => r.rate)))}` : ''}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Medicare analog</span>
                  <span className={styles.statValue}>
                    {coach.medicare != null ? formatCash(coach.medicare) : 'n/a'}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Named payers</span>
                  <span className={styles.statValue}>{namedPayers.length}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Off list</span>
                  <span className={styles.statValue}>{formatPct(offList) || 'n/a'}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Commercial low</span>
                  <span className={styles.statValue}>
                    {coach.commercialLow != null ? formatCash(coach.commercialLow) : 'n/a'}
                  </span>
                </div>
              </div>
              {mix.length > 0 ? (
                <div className={styles.mix} aria-label="Payer mix on this page">
                  {mix.map((entry) => (
                    <span
                      key={entry.id}
                      className={styles.mixSeg}
                      data-class={entry.id}
                      style={{ flex: entry.count }}
                    >
                      {entry.label} {entry.count}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className={styles.coach}>
                <div>
                  <p className={styles.label}>Coach</p>
                  <p className={styles.coachLine}>
                    Medicare on this tape is{' '}
                    <strong>{coach.medicare != null ? formatCash(coach.medicare) : 'not published'}</strong>
                    {coach.medicareTicks ? ` (${coach.medicareTicks} Medicare ticks)` : ''}
                    . Lowest kept rate is{' '}
                    <strong>{coach.lowestKept != null ? formatCash(coach.lowestKept) : 'n/a'}</strong>
                    {coach.commercialLow != null
                      ? `. Lowest commercial is ${formatCash(coach.commercialLow)}`
                      : ''}
                    . If Medicare is refused, offer{' '}
                    <strong>{coach.cashOffer != null ? formatCash(coach.cashOffer) : 'n/a'}</strong>
                    {' '}
                    (20% above the lowest kept rate) as cash, paid now
                    {offList != null ? `, against a median ${formatPct(offList)} cut off list` : ''}.
                  </p>
                </div>
                <label className={styles.field}>
                  <span className={styles.label}>I would pay</span>
                  <input
                    className={styles.control}
                    inputMode="decimal"
                    value={bid}
                    placeholder={coach.medicare != null ? String(Math.round(coach.medicare)) : '11800'}
                    onChange={(e) => setBid(e.target.value)}
                  />
                  <span className={styles.note} style={{ margin: '0.35rem 0 0' }}>
                    {bidVsMedicare == null
                      ? 'Type a bid to see it against Medicare.'
                      : bidVsMedicare === 0
                        ? 'Matches the Medicare analog.'
                        : bidVsMedicare < 0
                          ? `${formatCash(Math.abs(bidVsMedicare))} under Medicare.`
                          : `${formatCash(bidVsMedicare)} above Medicare.`}
                  </span>
                  <div className={styles.chipRow}>
                    <button type="button" className={styles.chip} onClick={applyBid} disabled={!coach.medicare}>
                      Use Medicare
                    </button>
                    <button type="button" className={styles.chip} onClick={applyOffer} disabled={!coach.cashOffer}>
                      Use cash offer
                    </button>
                  </div>
                </label>
              </div>

              <div className={styles.chipRow} role="group" aria-label="Payer filter">
                {PAYER_FILTERS.map((chip) => {
                  const count =
                    chip.id === 'all'
                      ? nearby.length
                      : mix.find((entry) => entry.id === chip.id)?.count ?? 0;
                  return (
                  <button
                    key={chip.id}
                    type="button"
                    className={payerFilter === chip.id ? styles.chipOn : styles.chip}
                    onClick={() => setPayerFilter(chip.id)}
                  >
                    {chip.label}
                    {searched ? ` ${count}` : ''}
                  </button>
                  );
                })}
                <button
                  type="button"
                  className={showOutliers ? styles.chipOn : styles.chip}
                  onClick={() => setShowOutliers((v) => !v)}
                >
                  {showOutliers ? 'Hiding junk off' : `Show ${outliers.length} hidden`}
                </button>
              </div>
              {namedPayers.length > 0 ? (
                <p className={styles.note}>
                  On this page: {namedPayers.slice(0, 12).join(', ')}
                  {namedPayers.length > 12 ? ` +${namedPayers.length - 12}` : ''}.
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.note}>
              Type a procedure or CPT, pick a metro, then read the tape. Stats describe this page,
              not the market.
            </p>
          )}

          {loading ? (
            <div aria-busy="true">
              <div className={styles.skeleton} />
              <div className={styles.skeleton} style={{ marginTop: 8 }} />
              <div className={styles.skeleton} style={{ marginTop: 8 }} />
            </div>
          ) : null}

          {!loading && searched && sortedRates.length > 0 ? (
            <>
              <div className={styles.ledgerWrap}>
                <table className={styles.ledger}>
                  <thead>
                    <tr>
                      <th>Facility</th>
                      <th>Payer</th>
                      <th>Plan</th>
                      <th>List</th>
                      <th>Medicare $</th>
                      <th>vs CMS</th>
                      <th style={{ textAlign: 'right' }}>Published</th>
                      <th> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <Fragment key={group.facility}>
                        <tr className={styles.groupRow}>
                          <td colSpan={8}>
                            <button
                              type="button"
                              className={`${styles.rowBtn} ${styles.facility}`}
                              onClick={(e) => void openDrawer(group.ticks[0], e.currentTarget)}
                            >
                              {group.facility}
                            </button>
                            <div className={styles.groupMeta}>
                              {describeFacilityLine(group.ticks[0], { includeMetro: scope === 'market' })}
                              {origin
                                ? (() => {
                                    const miles = milesFromOrigin(group.ticks[0], origin);
                                    return miles != null ? ` · ${miles.toFixed(1)} mi` : '';
                                  })()
                                : null}
                              {(() => {
                                const spread = facilitySpread(group.ticks);
                                if (spread.low == null || spread.high == null) return '';
                                return ` · ${spread.payerCount} payers · ${formatCash(spread.low)}–${formatCash(spread.high)}`;
                              })()}
                            </div>
                          </td>
                        </tr>
                        {group.ticks.map((r) => {
                          const key = tickKey(r);
                          const pinned = pins.some((p) => tickKey(p) === key);
                          const junk = hidden.has(tickIdentity(r));
                          return (
                            <tr key={key} data-outlier={junk ? 'true' : undefined}>
                              <td />
                              <td>
                                <div className={styles.payer}>
                                  {describePayer(r)}
                                  <span className={styles.payerClass}>{payerClassLabel(classifyPayer(r))}</span>
                                </div>
                              </td>
                              <td className={styles.note} style={{ margin: 0 }}>
                                {describePlan(r) || r.product || r.procedureCode}
                              </td>
                              <td className={styles.list}>
                                {r.grossCharges != null ? formatCash(r.grossCharges) : '—'}
                                {listDiscount(r) != null ? (
                                  <div className={styles.groupMeta}>{formatPct(listDiscount(r))} off</div>
                                ) : null}
                              </td>
                              <td className={styles.mono}>{formatCmsDollars(r.cmsRate) || '—'}</td>
                              <td className={styles.needle}>{formatNeedle(r.cmsRelativity)}</td>
                              <td className={styles.rate}>{formatCash(r.rate)}</td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.pinBtn}
                                  data-on={pinned}
                                  aria-pressed={pinned}
                                  aria-label={pinned ? 'Unpin from compare' : 'Pin to compare'}
                                  onClick={() => togglePin(r)}
                                >
                                  {pinned ? <PushPinSlash weight="light" /> : <PushPin weight="light" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.cards}>
                {groups.map((group) => (
                  <article key={group.facility} className={styles.card}>
                    <div className={styles.cardTop}>
                      <button
                        type="button"
                        className={`${styles.rowBtn} ${styles.facility}`}
                        onClick={(e) => void openDrawer(group.ticks[0], e.currentTarget)}
                      >
                        {group.facility}
                      </button>
                    </div>
                    <p className={styles.groupMeta}>
                      {describeFacilityLine(group.ticks[0], { includeMetro: scope === 'market' })}
                    </p>
                    {group.ticks.map((r) => {
                      const key = tickKey(r);
                      const pinned = pins.some((p) => tickKey(p) === key);
                      return (
                        <div key={key} className={styles.cardTick} data-outlier={hidden.has(tickIdentity(r)) ? 'true' : undefined}>
                          <div>
                            <div className={styles.payer}>{describePayer(r)}</div>
                            <div className={styles.groupMeta}>
                              {describePlan(r)}
                              {r.grossCharges != null ? ` · list ${formatCash(r.grossCharges)}` : ''}
                              {r.cmsRate ? ` · Medicare ${formatCash(r.cmsRate)}` : ''}
                            </div>
                            <div className={styles.needle}>{formatNeedle(r.cmsRelativity)}</div>
                          </div>
                          <div className={styles.cardRate}>
                            <div className={styles.rate}>{formatCash(r.rate)}</div>
                            <button
                              type="button"
                              className={styles.pinBtn}
                              data-on={pinned}
                              aria-pressed={pinned}
                              aria-label={pinned ? 'Unpin from compare' : 'Pin to compare'}
                              onClick={() => togglePin(r)}
                            >
                              {pinned ? <PushPinSlash weight="light" /> : <PushPin weight="light" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {searched && !loading && sortedRates.length === 0 && !error ? (
            <p className={styles.note}>No ticks in this slice. Add a CPT or pick another metro.</p>
          ) : null}

          {searched && (page > 1 || hasMore) ? (
            <div className={styles.pager}>
              <span>
                Page {page}
                {slice.fileSize ? ` · file ${slice.fileSize.toLocaleString()}` : ''}
              </span>
              <div>
                <button type="button" disabled={loading || page <= 1} onClick={() => void search(page - 1)}>
                  Previous
                </button>{' '}
                <button type="button" disabled={loading || !hasMore} onClick={() => void search(page + 1)}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {pins.length > 0 ? (
        <aside className={styles.tray} aria-label="Compare tray">
          <p className={styles.note} style={{ margin: 0 }}>
            Compare {pins.length} of 4 · same CPT, different payers
          </p>
          <div className={styles.trayGrid}>
            {pins.map((p) => (
              <div key={tickKey(p)} className={styles.trayCard}>
                <strong>{p.facilityName}</strong>
                <div>{describePayer(p)}</div>
                <div className={styles.rate}>{formatCash(p.rate)}</div>
                <div className={styles.needle}>
                  {formatNeedle(p.cmsRelativity)}
                  {p.cmsRate ? ` · ${formatCash(p.cmsRate)}` : ''}
                </div>
                <button
                  type="button"
                  className={styles.pinBtn}
                  aria-label={`Unpin ${p.facilityName}`}
                  onClick={() => togglePin(p)}
                >
                  <PushPinSlash weight="light" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.drawer}
        onClose={closeDrawer}
        aria-labelledby="facility-drawer-title"
      >
        <div className={styles.drawerHead}>
          <div>
            <h2 id="facility-drawer-title">{drawer?.facility}</h2>
            <p className={styles.note}>
              Same query, this facility only. Every published payer on the page.
            </p>
          </div>
          <button type="button" className={styles.pinBtn} onClick={closeDrawer} aria-label="Close">
            <X weight="light" />
          </button>
        </div>
        <div className={styles.drawerBody}>
          {drawerRates[0] ? (
            <div className={styles.facilityFacts}>
              <p className={styles.dossierKicker}>
                {describeFacilityLine(drawerRates[0], { includeMetro: true })}
              </p>
              <p>
                {[drawerRates[0].address, drawerRates[0].city, drawerRates[0].state, drawerRates[0].zip]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <div className={styles.chipRow}>
                {drawerRates[0].phone ? (
                  <a className={styles.chip} href={`tel:${drawerRates[0].phone.replace(/\D/g, '')}`}>
                    Call {drawerRates[0].phone}
                  </a>
                ) : null}
                <a className={styles.chip} href={mapsUrl(drawerRates[0])} target="_blank" rel="noreferrer">
                  Map
                </a>
                {websiteHref(drawerRates[0].website) ? (
                  <a
                    className={styles.chip}
                    href={websiteHref(drawerRates[0].website)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                ) : null}
                <a
                  className={styles.chip}
                  href={qualityLookupUrl(drawerRates[0])}
                  target="_blank"
                  rel="noreferrer"
                >
                  Outcomes (Healthgrades)
                </a>
                {npiUrl(drawerRates[0].npi) ? (
                  <a className={styles.chip} href={npiUrl(drawerRates[0].npi)!} target="_blank" rel="noreferrer">
                    NPI {drawerRates[0].npi}
                  </a>
                ) : null}
              </div>
              {drawerRates[0].methodology ? (
                <p className={styles.note} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  Methodology: {drawerRates[0].methodology}
                </p>
              ) : null}
            </div>
          ) : null}
          {drawerLoading ? <div className={styles.skeleton} aria-busy="true" /> : null}
          {!drawerLoading && drawerRates.length === 0 ? (
            <p className={styles.note}>No more ticks for this facility in the current query.</p>
          ) : null}
          {drawerRates.map((r) => (
            <div
              key={tickKey(r)}
              className={styles.drawerTick}
              data-outlier={hidden.has(tickIdentity(r)) ? 'true' : undefined}
            >
              <div>
                <div className={styles.payer}>
                  {describePayer(r)}
                  <span className={styles.payerClass}>{payerClassLabel(classifyPayer(r))}</span>
                </div>
                <div className={styles.groupMeta}>
                  {[describePlan(r), r.product, r.codeType, r.additionalPayerNotes]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className={styles.triple}>
                  <span>List {r.grossCharges != null ? formatCash(r.grossCharges) : '—'}</span>
                  <span>Medicare {formatCmsDollars(r.cmsRate) || '—'}</span>
                  <span>{formatNeedle(r.cmsRelativity) || '—'}</span>
                </div>
              </div>
              <div className={styles.cardRate}>
                <div className={styles.rate}>{formatCash(r.rate)}</div>
                {listDiscount(r) != null ? (
                  <div className={styles.groupMeta}>{formatPct(listDiscount(r))} off list</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
