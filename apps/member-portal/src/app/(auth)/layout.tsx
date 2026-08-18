import { AuthSplitLayout, AuthHeroPanel, authForm } from '@crm-eco/ui';
import { Shield, Lock, Users, Checks } from '@phosphor-icons/react/dist/ssr';
import './member-auth.css';

/**
 * The member sign-in shell.
 *
 * VISUAL ONLY — this layout has never held auth logic, and still doesn't. No
 * Supabase call, no redirect, no session read passes through here.
 *
 * WHY IT LOOKS DIFFERENT FROM THE OTHER THREE CONSOLES
 * The CRM, Admin and Advisor sign-ins are read by professionals at a desk.
 * This one is read by a health-share member — often older, usually on a phone,
 * sometimes while worrying about a medical bill. So it is the same family one
 * notch larger and one notch calmer (see member-auth.css): plain sentences, no
 * product-marketing swagger, no rotating quotes to pull the eye off the
 * password field, and reassurance instead of positioning.
 *
 * `variant="member"` puts `data-auth-variant="member"` on the shell root,
 * which switches the tone tokens in packages/ui/src/styles/auth.css: emerald
 * leads with the cyan counter-strand raised to 0.7. That pairing is the point
 * — a member IS the record an enrollment minted (MMS, emerald) and the person
 * a book of business is about (CRM, cyan), so both strands read. Every
 * descendant inherits the attribute, so the hero, the record rail, the focus
 * rings and the links cannot disagree about which product this is.
 *
 * WHAT REPLACED THE OLD HERO
 * `SoftTealAuthHero` was four blurred orbs drifting on infinite 12-20s loops
 * over hard-coded #0b6d85/#5ec8d8 literals, inside a `.mp-auth` wrapper whose
 * `!important` rules in globals.css painted over the shared button and link
 * styles. It could not track the landing palette and it moved continuously on
 * the front door of a production system. `AuthHeroPanel` is the same
 * atmosphere read calmly, from the variant's own tokens, and motionless.
 *
 * Below 1024px the brand side used to be `hidden lg:flex` — a phone got a bare
 * form with no identity at all. `AuthSplitLayout` now swaps in `AuthBrandBar`
 * (labelled "Member Portal" by the variant), which matters most here: this is
 * the most mobile-heavy of the four audiences.
 *
 * The record rail inside `AuthHeroPanel` is scoped the way the landings scope
 * `LandingRail`: vertical, tone inherited from the variant, `fade="ends"`, and
 * station labels OFF. It is the panel's structural gutter, not an ornament,
 * and it does not animate. The member station set — Household, Plan, Coverage,
 * Billing — fixes its geometry (AUTH_RAIL_STATIONS in @crm-eco/ui).
 */

/**
 * Unchanged copy, deliberately: these four are compliance and trust claims
 * this page has always made, and they are not a designer's to reword.
 */
const trustPoints = [
  {
    icon: Shield,
    title: 'HIPAA Compliant',
    description: 'Your health information is protected to the highest standards.',
  },
  {
    icon: Lock,
    title: '256-bit Encryption',
    description: 'All data in transit and at rest is encrypted end-to-end.',
  },
  {
    icon: Users,
    title: 'Member-First Community',
    description: 'Join thousands of families sharing medical expenses together.',
  },
  {
    icon: Checks,
    title: 'Transparent Sharing',
    description: 'Clear guidelines and real-time visibility into your needs.',
  },
];

export default function PortalAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="member"
      className="mp-auth-member"
      hero={
        <AuthHeroPanel
          variant="member"
          badge="Member Portal"
          headline={
            <>
              <span className="block">Your membership,</span>
              {/* `.auth-title-accent` runs the variant's own strands — emerald
                  into cyan for a member — instead of a Tailwind gradient
                  literal, which the console colour remap would have repainted. */}
              <span className={`block ${authForm.titleAccent}`}>all in one place</span>
            </>
          }
          subtitle="Sign in to check your plan, the people on it, and your bills — and to get help whenever you need it."
          /* No rotating aphorisms on this door. This hero never had them, and
             WCAG 2.2.2 treats auto-updating content as something a person must
             be able to stop; someone typing a password should not have to. */
          showQuotes={false}
        >
          <ul className="mp-trust">
            {trustPoints.map((point) => (
              <li key={point.title} className="mp-trust-item">
                <span className="mp-trust-icon">
                  <point.icon weight="light" className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="mp-trust-title">{point.title}</span>
                  <span className="mp-trust-copy">{point.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </AuthHeroPanel>
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
