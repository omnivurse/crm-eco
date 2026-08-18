import { AuthBrandBar } from './auth-brand-bar';
import type { AuthVariant } from './auth-variant';

export interface AuthSplitLayoutProps {
  /** The brand side. Shown at lg and up. */
  hero: React.ReactNode;
  children: React.ReactNode;
  variant?: AuthVariant;
  /** Optional top-right toolbar (e.g. theme toggle). */
  toolbar?: React.ReactNode;
  /**
   * NEW. The below-lg identity. Defaults to `<AuthBrandBar />` for the
   * variant, which is why no app has to change to get a mobile brand
   * treatment. Pass `null` to suppress it, or your own node to replace it.
   */
  compact?: React.ReactNode;
  /** NEW. Product wordline for the default compact bar (e.g. a tenant name). */
  brandLabel?: string;
  /** NEW. Extra classes on the shell root. */
  className?: string;
}

/**
 * Split auth layout — brand side left, form panel right.
 *
 * Two defects fixed here:
 *  - `min-h-screen` became `100dvh` (with a 100vh fallback). On mobile
 *    browsers with a collapsing toolbar, 100vh is the LARGE viewport, which
 *    pushed the submit button under the chrome.
 *  - the brand side no longer vanishes below lg; `compact` takes over.
 *
 * The form stays the priority on small screens: the compact bar is a fixed
 * ~5.25rem masthead, not a hero, and the form panel takes the rest.
 *
 * `data-auth-variant` on the root is what switches the tone tokens in
 * packages/ui/src/styles/auth.css — every descendant inherits it, so a hero,
 * a rail and a focus ring cannot disagree about which product this is.
 */
export function AuthSplitLayout({
  hero,
  children,
  variant = 'default',
  toolbar,
  compact,
  brandLabel,
  className,
}: AuthSplitLayoutProps) {
  const compactNode =
    compact === undefined ? (
      <AuthBrandBar variant={variant} label={brandLabel} />
    ) : (
      compact
    );

  return (
    <div
      className={['auth-shell', className].filter(Boolean).join(' ')}
      data-auth-variant={variant}
    >
      {toolbar ? <div className="auth-toolbar">{toolbar}</div> : null}

      {compactNode ? <div className="auth-compact">{compactNode}</div> : null}

      <div className="auth-brand-side">{hero}</div>

      <div className="auth-form-side">
        <div className="auth-form-slot">{children}</div>
      </div>
    </div>
  );
}
