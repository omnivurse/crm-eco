/**
 * AuthFormError — the error box, announced.
 *
 * Every auth form in the monorepo renders errors as a bare
 * `<div className={authForm.error}>{error}</div>`, which a screen reader
 * never announces: the node appears silently after submit. This is the same
 * box with `role="alert"` (an implicit assertive live region) so the failure
 * reaches everyone.
 *
 * Drop-in: `{error && <AuthFormError>{error}</AuthFormError>}`. Message text
 * is passed through untouched — it comes from Supabase and from each app's
 * own validation, and neither is this component's business.
 */
export interface AuthFormErrorProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthFormError({ children, className }: AuthFormErrorProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={['auth-alert', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
