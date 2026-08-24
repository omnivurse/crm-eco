'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DownloadSimple, Plus, Trash } from '@phosphor-icons/react';
import { compileRateBook, type RateClipSnapshot } from '@crm-eco/cash-pay';
import { toast } from 'sonner';
import { RateNoteButton } from './RateNoteButton';
import styles from './instrument.module.css';

interface Book {
  id: string;
  name: string;
  is_default: boolean;
}

type Clip = RateClipSnapshot & { clipId: string };

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
  return `${value.toFixed(2)}× Medicare`;
}

interface RateBookProps {
  memberName: string;
  postalCode: string;
}

export function RateBook({ memberName, postalCode }: RateBookProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = books.find((book) => book.id === bookId) ?? books[0] ?? null;
  const compile = useMemo(() => compileRateBook(clips), [clips]);

  const loadBooks = useCallback(async () => {
    const res = await fetch('/api/member/rate-books');
    if (!res.ok) throw new Error('books');
    const data = (await res.json()) as { books: Book[] };
    setBooks(data.books ?? []);
    return data.books ?? [];
  }, []);

  const loadClips = useCallback(async (id: string) => {
    const res = await fetch(`/api/member/rate-clips?bookId=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('clips');
    const data = (await res.json()) as { clips: Clip[] };
    setClips(data.clips ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const nextBooks = await loadBooks();
        if (cancelled) return;
        const nextId = nextBooks.find((book) => book.is_default)?.id || nextBooks[0]?.id || '';
        setBookId(nextId);
        if (nextId) await loadClips(nextId);
        else setClips([]);
      } catch {
        if (!cancelled) toast.error('Your tape could not be read.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadBooks, loadClips]);

  const switchBook = async (id: string) => {
    setBookId(id);
    setLoading(true);
    try {
      await loadClips(id);
    } catch {
      toast.error('That book could not be read.');
    } finally {
      setLoading(false);
    }
  };

  const createBook = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/member/rate-books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || 'Untitled book' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || 'Could not create the book.');
        return;
      }
      setNewName('');
      const next = await loadBooks();
      const created = (data.book as Book | undefined)?.id;
      if (created) {
        setBookId(created);
        await loadClips(created);
      } else if (next[0]) {
        await switchBook(next[0].id);
      }
      toast.success('Book created.');
    } catch {
      toast.error('Could not create the book.');
    } finally {
      setBusy(false);
    }
  };

  const removeClip = async (clipId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/rate-clips?id=${encodeURIComponent(clipId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Could not remove that clip.');
        return;
      }
      setClips((prev) => prev.filter((clip) => clip.clipId !== clipId));
    } catch {
      toast.error('Could not remove that clip.');
    } finally {
      setBusy(false);
    }
  };

  const deleteBook = async () => {
    if (!selected || selected.is_default || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/member/rate-books/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('The default book stays.');
        return;
      }
      const next = await loadBooks();
      const fallback = next.find((book) => book.is_default)?.id || next[0]?.id || '';
      setBookId(fallback);
      if (fallback) await loadClips(fallback);
      else setClips([]);
    } catch {
      toast.error('Could not delete the book.');
    } finally {
      setBusy(false);
    }
  };

  const downloadSheet = () => {
    if (!selected) return;
    window.location.href = `/api/member/rate-books/${selected.id}/export`;
  };

  return (
    <div className={styles.shell}>
      <div className={styles.tape} style={{ paddingBottom: '1.5rem' }}>
        <p className={styles.note}>
          Dated snapshots of published hospital cash. Not a quote. Not insurance.{' '}
          <Link href="/pricing">Read the tape</Link> to clip another tick.
        </p>

        <div className={styles.bookBar}>
          <label className={styles.field} style={{ margin: 0, minWidth: '12rem' }}>
            <span className={styles.label}>Book</span>
            <select
              className={styles.control}
              value={selected?.id || ''}
              disabled={books.length === 0}
              onChange={(e) => void switchBook(e.target.value)}
            >
              {books.length === 0 ? <option value="">No books yet</option> : null}
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name}
                  {book.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field} style={{ margin: 0, minWidth: '10rem' }}>
            <span className={styles.label}>New book</span>
            <input
              className={styles.control}
              value={newName}
              maxLength={60}
              placeholder="Florida trip"
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => void createBook()}>
            <Plus weight="light" className="mr-1 h-4 w-4" aria-hidden />
            Add
          </button>
          {selected && !selected.is_default ? (
            <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => void deleteBook()}>
              Delete book
            </button>
          ) : null}
        </div>

        <div className={styles.strip}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>This book</span>
            <span className={styles.statValue}>{compile.clipCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Cash</span>
            <span className={styles.statValue} data-signal="true">
              {formatCash(compile.cashTotal)}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Vs page high</span>
            <span className={styles.statValue} data-signal="true">
              {compile.vsSliceHigh == null ? 'n/a' : formatCash(compile.vsSliceHigh)}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>vs Medicare</span>
            <span className={styles.statValue}>
              {compile.cmsMin == null
                ? 'n/a'
                : `${compile.cmsMin.toFixed(2)}–${compile.cmsMax?.toFixed(2)}×`}
            </span>
          </div>
        </div>

        <div className={styles.bookBar}>
          <button type="button" className={styles.ghostBtn} disabled={!selected} onClick={downloadSheet}>
            <DownloadSimple weight="light" className="mr-2 h-4 w-4" aria-hidden />
            Spreadsheet
          </button>
          {selected ? (
            <RateNoteButton
              bookName={selected.name}
              memberName={memberName}
              postalCode={postalCode}
              compile={compile}
              clips={clips}
            />
          ) : null}
        </div>

        {loading ? (
          <div aria-busy="true">
            <div className={styles.skeleton} />
            <div className={styles.skeleton} style={{ marginTop: 8 }} />
          </div>
        ) : null}

        {!loading && clips.length === 0 ? (
          <p className={styles.note}>
            Nothing clipped yet. Open the tape, then clip a facility.{' '}
            <Link href="/pricing">Read the tape</Link>
          </p>
        ) : null}

        {!loading && clips.length > 0 ? (
          <>
          <div className={styles.ledgerWrap}>
            <table className={styles.ledger}>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Payer</th>
                  <th>Code</th>
                  <th>Metro</th>
                  <th>As of</th>
                  <th>vs CMS</th>
                  <th style={{ textAlign: 'right' }}>Published</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {clips.map((clip) => {
                  const href = `/pricing?state=${encodeURIComponent(clip.queryStateName)}&msa=${encodeURIComponent(clip.queryMsaName)}&code=${encodeURIComponent(clip.procedureCode)}`;
                  return (
                    <tr key={clip.clipId}>
                      <td>
                        <Link href={href} className={styles.facility}>
                          {clip.facilityName}
                        </Link>
                        <div className={styles.groupMeta}>
                          {[clip.city, clip.state].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td>{clip.paymentMethod || clip.codeDescription || 'Unnamed payer'}</td>
                      <td className={styles.mono}>{clip.procedureCode}</td>
                      <td className={styles.note} style={{ margin: 0 }}>
                        {[clip.queryStateName, clip.queryMsaName].filter(Boolean).join(' · ')}
                      </td>
                      <td className={styles.mono}>
                        {clip.clippedAt ? new Date(clip.clippedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className={styles.needle}>{formatNeedle(clip.cmsRelativity)}</td>
                      <td className={styles.rate}>{formatCash(clip.rate)}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.pinBtn}
                          aria-label={`Remove ${clip.facilityName}`}
                          disabled={busy}
                          onClick={() => void removeClip(clip.clipId)}
                        >
                          <Trash weight="light" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.cards}>
            {clips.map((clip) => {
              const href = `/pricing?state=${encodeURIComponent(clip.queryStateName)}&msa=${encodeURIComponent(clip.queryMsaName)}&code=${encodeURIComponent(clip.procedureCode)}`;
              return (
                <article key={clip.clipId} className={styles.card}>
                  <Link href={href} className={styles.facility}>
                    {clip.facilityName}
                  </Link>
                  <p className={styles.groupMeta}>
                    {[clip.city, clip.state].filter(Boolean).join(', ')}
                  </p>
                  <div className={styles.cardTick}>
                    <div>
                      <div className={styles.mono}>{clip.procedureCode}</div>
                      <div className={styles.groupMeta}>
                        {clip.paymentMethod || clip.codeDescription || clip.category}
                      </div>
                      <div className={styles.needle}>{formatNeedle(clip.cmsRelativity)}</div>
                    </div>
                    <div className={styles.cardRate}>
                      <div className={styles.rate}>{formatCash(clip.rate)}</div>
                      <button
                        type="button"
                        className={styles.pinBtn}
                        aria-label={`Remove ${clip.facilityName}`}
                        disabled={busy}
                        onClick={() => void removeClip(clip.clipId)}
                      >
                        <Trash weight="light" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
