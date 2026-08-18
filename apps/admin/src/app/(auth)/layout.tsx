'use client';

import { AuthSplitLayout, AuthHeroPanel, authForm } from '@crm-eco/ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const ADMIN_QUOTES = [
  { text: 'Enrollment is an operating system — not a spreadsheet.', author: 'Double Helix Admin' },
  { text: 'Billing, commissions, and members belong on one spine.', author: 'Double Helix Admin' },
  { text: 'Multi-tenant isolation is a feature, not a checkbox.', author: 'Double Helix Admin' },
];

/**
 * The MMS sign-in shell.
 *
 * VISUAL ONLY — this layout has never held auth logic, and still doesn't.
 *
 * `variant="admin"` puts `data-auth-variant="admin"` on the shell root, which
 * is what switches the tone tokens in packages/ui/src/styles/auth.css:
 * emerald leads, cyan answers quietly as the counter strand. Every descendant
 * inherits it, so the hero, the record rail, the form's focus rings and its
 * links cannot disagree about which product this is.
 *
 * Below 1024px `AuthSplitLayout` swaps the hero for `AuthBrandBar` — the
 * brand side used to be `hidden lg:flex`, so a phone got a bare form with no
 * product identity at all.
 *
 * The record rail inside `AuthHeroPanel` is scoped exactly as the MMS landing
 * hero scopes `LandingRail` (see apps/admin/src/components/landing/AdminLandingPage.tsx):
 * vertical, emerald from the variant, `fade="ends"`, and station labels OFF.
 * It is the panel's structural gutter, not an ornament, and it is motionless.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="admin"
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn" />}
      hero={
        <AuthHeroPanel
          variant="admin"
          badge="Admin Enrollment · MMS"
          headline={
            <>
              <span className="block">Enrollment</span>
              {/* Was a Tailwind gradient literal (from-emerald-600 …). The
                  console remaps those scales, so it painted Muted Spruce
                  rather than the brand. `.auth-title-accent` runs the
                  variant's own strands — emerald into cyan for MMS — the same
                  direction `.lp-gradient` runs under [data-strand='mms']. */}
              <span className={`block ${authForm.titleAccent}`}>under control</span>
            </>
          }
          subtitle="Plans, members, billing, and commissions — multi-tenant ops for agencies and TPAs."
          quotes={ADMIN_QUOTES}
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
