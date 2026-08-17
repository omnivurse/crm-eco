'use client';

/**
 * UnsavedFormGuard — protects a record form from silent data loss.
 *
 * Two modes:
 *
 *  1. Wrapper only (`<UnsavedFormGuard>{form}</UnsavedFormGuard>`): warns on
 *     `beforeunload` once the user has typed, and shows an "Unsaved changes"
 *     pill ABOVE the page's sticky action bar (bottom-16, not bottom-4, so it
 *     never covers the Create / Cancel buttons).
 *
 *  2. Form owner (`action` provided): renders the `<form>` itself via
 *     `useActionState`, so a server action can RETURN a structured result
 *     (`CreateFormActionState`) instead of throwing. Duplicates and validation
 *     errors render inline above the sticky bar with "View existing" /
 *     "Create anyway" (force=true), the typed values stay in the DOM, and the
 *     sessionStorage draft (RecordDraftAutosave) is untouched. The unsaved pill
 *     lives INSIDE the bar in this mode so nothing overlaps.
 *
 * Why `onReset={preventDefault}`: React 19 auto-resets uncontrolled inputs of a
 * `<form action>` once the action settles (via `form.reset()`, which fires a
 * cancelable `reset` event). Our inputs are react-hook-form `register()`ed
 * (uncontrolled), so without this the client's typing would be wiped the moment
 * the server says "duplicate". Cancelling the reset event keeps every value.
 */

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@crm-eco/ui/lib/utils';

export interface CreateFormDuplicate {
  id: string;
  title: string | null;
  email: string | null;
  phone?: string | null;
}

/** Serializable result a create-form server action returns (never throws). */
export type CreateFormActionState =
  | { ok: true }
  | {
      ok: false;
      /** e.g. DUPLICATE_RECORD | PENDING_REQUIRES_START_DATE | VALIDATION | UNAUTHENTICATED */
      code?: string;
      message: string;
      duplicates?: CreateFormDuplicate[];
      /** Per-field messages (key → message) when the server can attribute them. */
      fieldErrors?: Record<string, string>;
    };

export const CREATE_FORM_IDLE: CreateFormActionState = { ok: true };

/** Hidden-input name the server action reads to bypass the duplicate check. */
export const CREATE_FORM_FORCE_FIELD = '_force';

interface UnsavedFormGuardProps {
  children: ReactNode;
  /**
   * Server action `(prev, formData) => Promise<CreateFormActionState>`. When
   * provided the guard owns the `<form>` + sticky action bar. Success must
   * `redirect()` inside the action; any failure must be RETURNED, not thrown.
   */
  action?: (
    prev: CreateFormActionState,
    formData: FormData,
  ) => Promise<CreateFormActionState>;
  /** Cancel link target (form-owner mode). */
  cancelHref?: string;
  /** Submit button label (form-owner mode). */
  submitLabel?: string;
  /** Extra classes on the `<form>` (form-owner mode). */
  formClassName?: string;
}

export function UnsavedFormGuard({
  children,
  action,
  cancelHref,
  submitLabel = 'Create Record',
  formClassName,
}: UnsavedFormGuardProps) {
  const [isDirty, setIsDirty] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handleChange = () => setIsDirty(true);
    el.addEventListener('input', handleChange);
    el.addEventListener('change', handleChange);
    return () => {
      el.removeEventListener('input', handleChange);
      el.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (!action) {
    return (
      <div ref={wrapperRef}>
        {children}
        {isDirty && (
          <div
            role="status"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
            Unsaved changes — don&apos;t forget to save before leaving
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapperRef}>
      <GuardedActionForm
        action={action}
        cancelHref={cancelHref}
        submitLabel={submitLabel}
        formClassName={formClassName}
        isDirty={isDirty}
      >
        {children}
      </GuardedActionForm>
    </div>
  );
}

function GuardedActionForm({
  action,
  cancelHref,
  submitLabel,
  formClassName,
  isDirty,
  children,
}: Required<Pick<UnsavedFormGuardProps, 'action' | 'submitLabel'>> &
  Pick<UnsavedFormGuardProps, 'cancelHref' | 'formClassName'> & {
    isDirty: boolean;
    children: ReactNode;
  }) {
  const [state, formAction] = useActionState(action, CREATE_FORM_IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  // `force` is armed for ONE specific action state (the duplicate result the
  // user answered "Create anyway" to). Storing the state it was armed for in
  // React state (not a ref) lets the render derive "still active" without
  // setState-in-effect: once the action settles into a new state, or the user
  // edits a field, the next submit runs the duplicate pre-check again.
  const [force, setForce] = useState<{ armedFor: CreateFormActionState } | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Any fresh submit starts without the force flag; "Create anyway" flips it
  // and re-submits in the same tick via requestSubmit().
  const handleCreateAnyway = useCallback(() => {
    setForce({ armedFor: state });
    // Let React commit the hidden input before submitting.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }, [state]);

  useEffect(() => {
    if (state.ok) return;
    // Bring the inline result into view + announce it.
    bannerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    bannerRef.current?.focus({ preventScroll: true });
  }, [state]);

  const forceActive = force !== null && force.armedFor === state;

  const isDuplicate = !state.ok && state.code === 'DUPLICATE_RECORD';

  return (
    <form
      ref={formRef}
      action={formAction}
      onReset={(e) => e.preventDefault()}
      onChange={() => {
        if (force) setForce(null);
      }}
      className={cn('space-y-6', formClassName)}
    >
      {children}

      {forceActive && <input type="hidden" name={CREATE_FORM_FORCE_FIELD} value="1" />}

      {!state.ok && (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className={cn(
            'rounded-lg border px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            isDuplicate
              ? 'border-amber-300 bg-amber-50 text-amber-900 focus-visible:ring-amber-400 dark:border-amber-700/50 dark:bg-amber-500/10 dark:text-amber-100'
              : 'border-red-300 bg-red-50 text-red-900 focus-visible:ring-red-400 dark:border-red-700/50 dark:bg-red-500/10 dark:text-red-100',
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-medium">
                {isDuplicate ? 'Possible duplicate — nothing was created' : 'Could not create the record'}
              </p>
              <p className="text-[13px] opacity-90">{state.message}</p>
              {isDuplicate && state.duplicates && state.duplicates.length > 0 && (
                <ul className="space-y-1">
                  {state.duplicates.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white/60 px-2.5 py-1.5 dark:bg-black/20"
                    >
                      <span className="font-medium">{d.title || 'Untitled record'}</span>
                      {d.email && <span className="text-xs opacity-80">{d.email}</span>}
                      {d.phone && <span className="text-xs opacity-80">{d.phone}</span>}
                      <Link
                        href={`/crm/r/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 rounded-md border border-amber-400 px-2 py-0.5 text-xs font-medium hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-amber-600 dark:hover:bg-white/10"
                        aria-label={`View existing record ${d.title || d.id} in a new tab`}
                      >
                        View existing
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!state.ok && state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
                <ul className="list-disc pl-5 text-[13px]">
                  {Object.entries(state.fieldErrors).map(([k, v]) => (
                    <li key={k}>
                      <span className="font-medium">{k}</span>: {v}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs opacity-80">
                Everything you typed is still here{isDuplicate ? ' — review the match, then choose below.' : '.'}
              </p>
              {isDuplicate && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCreateAnyway}
                    className="inline-flex items-center rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
                  >
                    Create anyway
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky action bar — unsaved pill lives INSIDE so it never overlaps. */}
      <div className="sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-slate-900">
        {isDirty && (
          <span
            role="status"
            className="mr-auto inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
            Unsaved changes
          </span>
        )}
        {cancelHref && (
          <Link
            href={cancelHref}
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
          >
            Cancel
          </Link>
        )}
        <SubmitButton label={submitLabel} force={forceActive} />
      </div>
    </form>
  );
}

function SubmitButton({ label, force }: { label: string; force: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2 text-white shadow-sm transition-colors hover:bg-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus-visible:ring-offset-slate-900"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? 'Creating…' : force ? `${label} (skip duplicate check)` : label}
    </button>
  );
}
