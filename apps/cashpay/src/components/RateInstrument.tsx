'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PushPin, PushPinSlash, X } from '@phosphor-icons/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { brand } from '@/lib/brand';
import { formatCash, formatNeedle, tickKey } from '@/lib/format';
import type { HclRate, MsaOption, SliceSummary, SpecialtyOption } from '@/lib/hcl-types';
import styles from '@/app/instrument.module.css';

type SortBy = 'price_asc' | 'price_desc';

function groupByFacility(rows: HclRate[]): Array<{ facility: string; city: string; state: string; ticks: HclRate[] }> {
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
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [specialty, setSpecialty] = useState('');
  const [specialties, setSpecialties] = useState<SpecialtyOption[]>([]);
  const [page, setPage] = useState(Number(searchParams.get('page') || '1') || 1);
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');

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
        category: category.trim(),
        page: String(nextPage),
      });

      try {
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

        const res = await fetch(`/api/rates?${params}`);
        const data = await res.json();

        if (!res.ok) {
          setRates([]);
          setSlice(EMPTY_SLICE);
          setHasMore(false);
          setError(
            data.error === 'rate_limited'
              ? 'Too many reads. Wait a moment, then try again.'
              : data.message || 'Search failed',
          );
          return;
        }

        const list: HclRate[] = data.rates || [];
        setRates(list);
        setSlice(data.slice || EMPTY_SLICE);
        setHasMore(Boolean(data.hasMore));
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
    [category, msaName, procedureCode, specialty, stateName, writeUrl, zipCode],
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

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) =>
      sortBy === 'price_asc' ? a.rate - b.rate : b.rate - a.rate,
    );
  }, [rates, sortBy]);

  const groups = useMemo(() => groupByFacility(sortedRates), [sortedRates]);

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
      const res = await fetch(`/api/rates?${params}`);
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
      <header className={styles.chrome}>
        <a className={styles.brand} href="/">
          <span className={styles.brandName}>{brand.product}</span>
          <span className={styles.brandMeta}>{msaName || 'No metro selected'}</span>
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
            <button
              className={styles.readBtn}
              type="submit"
              disabled={loading || !stateName || !msaName}
            >
              {loading ? 'Reading…' : 'Read the tape'}
            </button>
          </form>
        </aside>

        <section className={styles.tape} aria-live="polite">
          {error ? <p className={styles.error}>{error}</p> : null}
          {notice ? <p className={styles.note}>{notice}</p> : null}

          {searched ? (
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
          ) : (
            <p className={styles.note}>
              Pick an HCL market and metro, then read the tape. Stats describe this page, not the
              metro.
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
