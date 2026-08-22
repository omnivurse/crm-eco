'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PushPin, PushPinSlash, X } from '@phosphor-icons/react';
import styles from './instrument.module.css';

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
  hospitalId: number | null;
  facilityName: string;
  city: string;
  state: string;
  procedureCode: string;
  codeDescription: string;
  category: string;
  rate: number;
  paymentMethod: string | null;
  cmsRelativity: number | null;
}

interface SliceSummary {
  sliceCount: number;
  low: number | null;
  median: number | null;
  high: number | null;
  cmsMin: number | null;
  cmsMax: number | null;
  fileSize: number;
  scope: 'slice';
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

function formatCash(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNeedle(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return `${value.toFixed(2)}x CMS`;
}

function tickKey(row: { id: number | string; facilityName: string; procedureCode: string }): string {
  return `${row.id}-${row.facilityName}-${row.procedureCode}`;
}

function groupByFacility(rows: HclRate[]) {
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

export function PricingSearch({ memberZip, memberState, procedures }: PricingSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [zipCode, setZipCode] = useState(searchParams.get('zip') || memberZip || '');
  const [allMsas, setAllMsas] = useState<MsaOption[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [stateName, setStateName] = useState(searchParams.get('state') || memberState || '');
  const [msaName, setMsaName] = useState(searchParams.get('msa') || '');
  const [procedureCode, setProcedureCode] = useState(searchParams.get('code') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [selectedProcedureName, setSelectedProcedureName] = useState('');
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1);
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');

  const [hclRates, setHclRates] = useState<HclRate[]>([]);
  const [legacyResults, setLegacyResults] = useState<LegacyResult[]>([]);
  const [source, setSource] = useState<'hcl' | 'legacy' | null>(null);
  const [slice, setSlice] = useState<SliceSummary>(EMPTY_SLICE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [zipHint, setZipHint] = useState('');
  const [pins, setPins] = useState<HclRate[]>([]);
  const [drawer, setDrawer] = useState<{ facility: string; hospitalId: number | null } | null>(
    null,
  );
  const [drawerRates, setDrawerRates] = useState<HclRate[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const msas = useMemo(
    () => (stateName ? allMsas.filter((m) => m.stateName === stateName) : []),
    [allMsas, stateName],
  );

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
      if (applyPreferred && data.preferredState) {
        setStateName(data.preferredState);
        if (data.preferredMsa) setMsaName(data.preferredMsa);
      } else {
        setStateName((prev) => prev || data.preferredState || memberState || '');
      }
      if (data.preferredZip && !zip) setZipCode(data.preferredZip);
    } catch {
      setNotice('Metro list unavailable. Backup search still works with a ZIP.');
    } finally {
      setMetaLoading(false);
    }
  }, [memberState]);

  useEffect(() => {
    void loadMeta(searchParams.get('zip') || memberZip || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!stateName || allMsas.length === 0) return;
    if (msaName && msas.some((m) => m.msaName === msaName)) return;
    setMsaName(msas[0]?.msaName || '');
  }, [stateName, msas, msaName, allMsas.length]);

  const runLegacySearch = useCallback(async (noticeOverride?: string) => {
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
    setSlice(EMPTY_SLICE);
    setSource('legacy');
    setHasMore(false);
    setNotice(
      noticeOverride ||
        'Backup cash-price directory. Published hospital files for this metro are not on this key yet.',
    );
    return true;
  }, [zipCode, selectedProcedureName]);

  const search = useCallback(
    async (nextPage = 1) => {
      setError('');
      setNotice('');
      setLoading(true);
      setSearched(true);
      setPage(nextPage);
      writeUrl({
        zip: zipCode,
        state: stateName,
        msa: msaName,
        code: procedureCode.trim(),
        category: category.trim(),
        page: String(nextPage),
      });

      try {
        if (msaName && stateName) {
          const params = new URLSearchParams({
            state: stateName,
            msa: msaName,
            page: String(nextPage),
            pageSize: '50',
          });
          if (zipCode) params.set('zip', zipCode);
          if (procedureCode.trim()) params.set('procedureCode', procedureCode.trim());
          if (category.trim()) params.set('category', category.trim());
          if (specialty) params.set('specialty', specialty);
          const res = await fetch(`/api/pricing/hcl?${params}`);
          const data = await res.json();
          if (res.ok && data.rates) {
            setHclRates(data.rates);
            setLegacyResults([]);
            setSource('hcl');
            setSlice(data.slice || EMPTY_SLICE);
            setHasMore(Boolean(data.hasMore));
            if ((data.rates || []).length === 0) {
              setNotice('No ticks in this slice. Add a CPT or pick another metro.');
            }
            return;
          }
          if (data.error === 'rate_limited') {
            setError('Too many reads. Wait a moment, then try again.');
            return;
          }
          if (data.fallback) {
            await runLegacySearch(
              data.error === 'misconfigured' || data.error === 'invalid_key'
                ? 'Live hospital file is not configured here. Showing the backup directory.'
                : undefined,
            );
            return;
          }
          setError(data.message || 'Unable to read the tape.');
          return;
        }
        await runLegacySearch();
      } catch {
        setError('Network error. Please try again.');
        setHclRates([]);
      } finally {
        setLoading(false);
      }
    },
    [category, msaName, procedureCode, runLegacySearch, specialty, stateName, writeUrl, zipCode],
  );

  const autoSearched = useRef(false);
  useEffect(() => {
    if (autoSearched.current || metaLoading) return;
    const urlState = searchParams.get('state');
    const urlMsa = searchParams.get('msa');
    if (!urlState || !urlMsa) return;
    if (allMsas.length === 0) return;
    if (stateName !== urlState || msaName !== urlMsa) return;
    autoSearched.current = true;
    void search(Number(searchParams.get('page') || '1') || 1);
  }, [allMsas.length, metaLoading, msaName, search, searchParams, stateName]);

  const sortedHcl = useMemo(() => {
    return [...hclRates].sort((a, b) =>
      sortBy === 'price_asc' ? a.rate - b.rate : b.rate - a.rate,
    );
  }, [hclRates, sortBy]);

  const groups = useMemo(() => groupByFacility(sortedHcl), [sortedHcl]);

  const sortedLegacy = useMemo(() => {
    return [...legacyResults].sort((a, b) =>
      sortBy === 'price_asc' ? a.cash_price - b.cash_price : b.cash_price - a.cash_price,
    );
  }, [legacyResults, sortBy]);

  const togglePin = (row: HclRate) => {
    setPins((prev) => {
      const key = tickKey(row);
      if (prev.some((p) => tickKey(p) === key)) {
        return prev.filter((p) => tickKey(p) !== key);
      }
      if (prev.length >= 4) return prev;
      return [...prev, row];
    });
  };

  const openDrawer = async (row: HclRate, trigger: HTMLElement) => {
    restoreFocus.current = trigger;
    setDrawer({ facility: row.facilityName, hospitalId: row.hospitalId });
    setDrawerRates([]);
    setDrawerLoading(true);
    dialogRef.current?.showModal();
    try {
      const params = new URLSearchParams({
        state: stateName,
        msa: msaName,
        pageSize: '50',
      });
      if (row.hospitalId != null) params.set('hospitalId', String(row.hospitalId));
      if (procedureCode.trim()) params.set('procedureCode', procedureCode.trim());
      if (specialty) params.set('specialty', specialty);
      const res = await fetch(`/api/pricing/hcl?${params}`);
      const data = await res.json();
      const list: HclRate[] = data.rates || [];
      setDrawerRates(
        row.hospitalId != null
          ? list
          : list.filter((r) => r.facilityName === row.facilityName),
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

  return (
    <div className={`${styles.shell} ${pins.length > 0 ? styles.shellHasTray : ''}`}>
      <div className={styles.stage}>
        <aside className={styles.rail}>
          <form
            className={styles.railSticky}
            onSubmit={(e) => {
              e.preventDefault();
              void search(1);
            }}
          >
            <p className={styles.note}>
              Published cash, not a quote. Sharing still follows your plan and IUA.{' '}
              <Link href="/needs/new">Submit a need</Link> with the itemized bill when you have
              one.
            </p>
            <p className={styles.note} style={{ marginTop: '-0.35rem' }}>
              Metro: {msaName || 'none selected'}
            </p>
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
                Live specialty: Hospital cash prices. Pharmacy, imaging, and lab are not mapped on
                this key.
              </p>
            )}
            <label className={`${styles.field} ${styles.heroCode}`}>
              <span className={styles.label}>
                {specialties.find((s) => s.hclName === specialty)?.codeHint || 'CPT / HCPCS'}
              </span>
              <input
                className={styles.control}
                value={procedureCode}
                placeholder="Optional"
                onChange={(e) =>
                  setProcedureCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 11))
                }
              />
            </label>
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
              </select>
            </label>
            {procedures.length > 0 ? (
              <label className={styles.field}>
                <span className={styles.label}>Backup procedure</span>
                <select
                  className={styles.control}
                  value={selectedProcedureName || '__all__'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedProcedureName(v === '__all__' ? '' : v);
                    const match = procedures.find((p) => p.procedure_name === v);
                    if (match?.procedure_code) setProcedureCode(match.procedure_code);
                  }}
                >
                  <option value="__all__">All procedures</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.procedure_name}>
                      {p.procedure_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              className={styles.readBtn}
              type="submit"
              disabled={loading || metaLoading}
            >
              {loading ? 'Reading…' : 'Read the tape'}
            </button>
          </form>
        </aside>

        <section className={styles.tape} aria-live="polite">
          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.note}>{notice}</p> : null}

          {searched && source === 'hcl' ? (
            <>
              <p className={styles.note}>This page, not the metro.</p>
              <div className={styles.strip}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>This page</span>
                  <span className={styles.statValue}>{slice.sliceCount}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Low / median / high</span>
                  <span className={styles.statValue} data-signal="true">
                    {slice.low != null ? formatCash(slice.low) : 'n/a'}
                    {slice.median != null ? ` · ${formatCash(slice.median)}` : ''}
                    {slice.high != null ? ` · ${formatCash(slice.high)}` : ''}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>CMS needle</span>
                  <span className={styles.statValue}>
                    {slice.cmsMin != null
                      ? `${slice.cmsMin.toFixed(2)}-${slice.cmsMax?.toFixed(2)}x`
                      : 'n/a'}
                  </span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>File size</span>
                  <span className={styles.statValue}>{slice.fileSize.toLocaleString()}</span>
                </div>
              </div>
            </>
          ) : !searched ? (
            <p className={styles.note}>
              Pick an HCL market and metro, then read the tape. Stats describe this page, not the
              metro.
            </p>
          ) : null}

          {loading ? (
            <div aria-busy="true">
              <div className={styles.skeleton} />
              <div className={styles.skeleton} style={{ marginTop: 8 }} />
              <div className={styles.skeleton} style={{ marginTop: 8 }} />
            </div>
          ) : null}

          {!loading && searched && source === 'hcl' && sortedHcl.length > 0 ? (
            <>
              <div className={styles.ledgerWrap}>
                <table className={styles.ledger}>
                  <thead>
                    <tr>
                      <th>Facility</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Method</th>
                      <th>CMS</th>
                      <th style={{ textAlign: 'right' }}>Cash</th>
                      <th> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <Fragment key={group.facility}>
                        <tr className={styles.groupRow}>
                          <td colSpan={7}>
                            <button
                              type="button"
                              className={`${styles.rowBtn} ${styles.facility}`}
                              onClick={(e) => void openDrawer(group.ticks[0], e.currentTarget)}
                            >
                              {group.facility}
                            </button>
                            <div className={styles.groupMeta}>
                              {[group.city, group.state].filter(Boolean).join(', ')}
                            </div>
                          </td>
                        </tr>
                        {group.ticks.map((r) => {
                          const key = tickKey(r);
                          const pinned = pins.some((p) => tickKey(p) === key);
                          return (
                            <tr key={key}>
                              <td />
                              <td className={styles.mono}>{r.procedureCode}</td>
                              <td>{r.codeDescription || r.category}</td>
                              <td className={styles.note} style={{ margin: 0 }}>
                                {r.paymentMethod || 'n/a'}
                              </td>
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
                                  {pinned ? (
                                    <PushPinSlash weight="light" />
                                  ) : (
                                    <PushPin weight="light" />
                                  )}
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
                    <button
                      type="button"
                      className={`${styles.rowBtn} ${styles.facility}`}
                      onClick={(e) => void openDrawer(group.ticks[0], e.currentTarget)}
                    >
                      {group.facility}
                    </button>
                    <p className={styles.groupMeta}>
                      {[group.city, group.state].filter(Boolean).join(', ')}
                    </p>
                    {group.ticks.map((r) => {
                      const key = tickKey(r);
                      const pinned = pins.some((p) => tickKey(p) === key);
                      return (
                        <div key={key} className={styles.cardTick}>
                          <div>
                            <div className={styles.mono}>{r.procedureCode}</div>
                            <div className={styles.groupMeta}>
                              {r.codeDescription || r.category}
                              {r.paymentMethod ? ` · ${r.paymentMethod}` : ''}
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
                              {pinned ? (
                                <PushPinSlash weight="light" />
                              ) : (
                                <PushPin weight="light" />
                              )}
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

          {!loading && searched && source === 'hcl' && sortedHcl.length === 0 && !error ? (
            <p className={styles.note}>No ticks in this slice. Add a CPT or pick another metro.</p>
          ) : null}

          {!loading && searched && source === 'legacy' && sortedLegacy.length === 0 && !error ? (
            <p className={styles.note}>No backup rows near this ZIP. Try another ZIP or procedure.</p>
          ) : null}

          {!loading && searched && source === 'legacy' && sortedLegacy.length > 0 ? (
            <div className={styles.backup}>
              {sortedLegacy.map((r) => (
                <div key={`${r.procedure_id}-${r.provider_location_id}`} className={styles.backupCard}>
                  <div>
                    <div className={styles.facility}>{r.provider_name}</div>
                    <p className={styles.groupMeta}>
                      {r.city}, {r.state} {r.zip}
                      {r.distance_miles != null ? ` · ${r.distance_miles} mi` : ''}
                    </p>
                    <p className={styles.note} style={{ marginBottom: 0 }}>
                      {r.procedure_name}
                    </p>
                  </div>
                  <div className={styles.rate}>{formatCash(r.cash_price)}</div>
                </div>
              ))}
            </div>
          ) : null}

          {searched && source === 'hcl' && (page > 1 || hasMore) ? (
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
            Compare {pins.length} of 4
          </p>
          <div className={styles.trayGrid}>
            {pins.map((p) => (
              <div key={tickKey(p)} className={styles.trayCard}>
                <strong>{p.facilityName}</strong>
                <div className={styles.mono}>{p.procedureCode}</div>
                <div className={styles.rate}>{formatCash(p.rate)}</div>
                <div className={styles.needle}>{formatNeedle(p.cmsRelativity)}</div>
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
            <p className={styles.note}>Same metro slice, this facility only.</p>
          </div>
          <button type="button" className={styles.pinBtn} onClick={closeDrawer} aria-label="Close">
            <X weight="light" />
          </button>
        </div>
        <div style={{ padding: '0.85rem 1.1rem 1.2rem' }}>
          {drawerLoading ? <div className={styles.skeleton} aria-busy="true" /> : null}
          {!drawerLoading && drawerRates.length === 0 ? (
            <p className={styles.note}>No more ticks for this facility in the current query.</p>
          ) : null}
          {drawerRates.map((r) => (
            <div
              key={tickKey(r)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '0.55rem 0',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <div>
                <div className={styles.mono}>{r.procedureCode}</div>
                <div>{r.codeDescription || r.category}</div>
              </div>
              <div className={styles.rate}>{formatCash(r.rate)}</div>
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
