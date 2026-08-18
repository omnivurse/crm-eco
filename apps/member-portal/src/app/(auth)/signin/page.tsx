import { Suspense } from 'react';
import { SignInForm } from './form';

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInForm />
    </Suspense>
  );
}

/**
 * The Suspense fallback, corrected.
 *
 * The previous one rendered a whole second split screen — `min-h-screen`, its
 * own 55%/45% columns, `bg-dhh-ink`, `bg-cyan-500/20` — INSIDE the (auth)
 * layout's form slot, so for the first paint the member saw a dark panel
 * nested in the real one. This is simply the shape of the form it stands in
 * for, drawn from the auth tokens (see member-auth.css), so the swap to the
 * real form is unnoticeable.
 */
function SignInLoading() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading the sign-in form.
      </p>
      <div className="mp-skeleton" aria-hidden="true">
        <div className="mp-skeleton-logo" />
        <div className="mp-skeleton-title" />
        <div className="mp-skeleton-line" />
        <div className="mp-skeleton-field" />
        <div className="mp-skeleton-field" />
        <div className="mp-skeleton-btn" />
      </div>
    </>
  );
}
