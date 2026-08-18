import { AuthSplitLayout } from '@crm-eco/ui';
import { AdvisorAuthHero } from './AdvisorAuthHero';
import { advisorAuthFontVars } from './fonts';
import styles from './advisor-auth.module.css';

export interface AdvisorAuthShellProps {
  children: React.ReactNode;
}

/**
 * The one shell every advisor auth route renders: /login, /reset-password and
 * /update-password. It is a wrapper and nothing else — it owns no state, no
 * Supabase call and no redirect.
 *
 * These routes are top-level with per-route layouts rather than an `(auth)`
 * route group like the other apps, so there is no single layout file to hang
 * the shell on; this component is what keeps the three from drifting apart
 * again, which is exactly what had already happened to the hero.
 *
 * It supplies three things:
 *   - `variant="advisor"` — the identity the shared auth contract assigns this
 *     surface: cyan leads with the counter strand raised to 0.70, because an
 *     advisor works a book of business (CRM) but produces enrollments (MMS)
 *     and therefore stands on the seam between the two products. This one
 *     attribute drives the tone tokens, the record rail's stations, the
 *     headline gradient's direction, the link and focus-ring colour, and the
 *     compact brand bar's wordline. Before this the app passed `variant="crm"`
 *     on /login and nothing at all on the two password routes, so it fell
 *     through to `default`.
 *   - the landing display/mono faces, scoped here (see ./fonts.ts).
 *   - the type re-binding those faces need (see ./advisor-auth.module.css).
 *
 * The below-lg brand bar is `AuthSplitLayout`'s default, which reads
 * "Advisor Portal" from AUTH_VARIANT_LABEL — so the phone keeps a real
 * identity instead of the bare form it used to show under 1024px.
 */
export function AdvisorAuthShell({ children }: AdvisorAuthShellProps) {
  return (
    <AuthSplitLayout
      variant="advisor"
      className={`${styles.root} ${advisorAuthFontVars}`}
      hero={<AdvisorAuthHero />}
    >
      {children}
    </AuthSplitLayout>
  );
}
