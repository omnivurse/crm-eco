'use client';

import { useEffect, useState } from 'react';
import { formatCash, formatNeedle } from '@/lib/format';
import type { HclRate, SliceSummary } from '@/lib/hcl-types';
import styles from '@/app/instrument.module.css';

const SEED = {
  state: 'Oregon',
  msa: 'Portland-Salem',
  code: '99213',
};

export function InstrumentPreview() {
  const [rates, setRates] = useState<HclRate[]>([]);
  const [slice, setSlice] = useState<SliceSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          state: SEED.state,
          msa: SEED.msa,
          procedureCode: SEED.code,
          pageSize: '6',
        });
        const res = await fetch(`/api/rates?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message || 'Live tape unavailable here.');
          return;
        }
        setRates(data.rates || []);
        setSlice(data.slice || null);
      } catch {
        if (!cancelled) setError('Live tape unavailable here.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.preview} aria-label="Live rate instrument preview">
      <p className={styles.note} style={{ marginTop: 0 }}>
        Live: {SEED.msa} · CPT {SEED.code}
        {slice ? ` · this page ${slice.sliceCount} / file ${slice.fileSize.toLocaleString()}` : ''}
      </p>
      {loading ? (
        <>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} style={{ marginTop: 8 }} />
          <div className={styles.skeleton} style={{ marginTop: 8 }} />
        </>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {!loading && !error && rates.length === 0 ? (
        <p className={styles.note}>No ticks for this seed query.</p>
      ) : null}
      {rates.length > 0 ? (
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Facility</th>
              <th>CMS</th>
              <th style={{ textAlign: 'right' }}>Cash</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={`${r.id}-${r.facilityName}`}>
                <td>{r.facilityName}</td>
                <td className={styles.needle}>{formatNeedle(r.cmsRelativity)}</td>
                <td className={styles.rate}>{formatCash(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
