import { AuthHeroPanel, authForm } from '@crm-eco/ui';

/**
 * The advisor portal's brand side — one hero, shared by /login,
 * /reset-password and /update-password.
 *
 * WHY IT EXISTS
 *   The three auth routes each carried their own copy of the hero, and they
 *   had already drifted: /login said "Grow your advisor practice" over a
 *   `from-cyan-300 to-emerald-300` Tailwind gradient, while the two password
 *   layouts said "Grow your practice with Double Helix Hub" over a
 *   `from-[#5eead4] via-[#67e8f9] to-[#a7f3d0]` hex gradient. Neither could
 *   match the landings: this app remaps Tailwind's cyan scale onto spruce
 *   (`advisor` palette in tailwind.config.ts + the shared console preset), and
 *   raw hex cannot follow the theme at all. Both are now `authForm.titleAccent`,
 *   which paints from `--auth-strand-a/-b` — the same two pigments the landing
 *   `.lp-gradient` uses, read in the advisor's direction.
 *
 * IDENTITY — `variant="advisor"`
 *   Per the shared auth contract: cyan leads, counter raised to 0.70. The
 *   advisor works a book of business (a CRM object) but what they produce is
 *   an enrollment (an MMS object), so they stand on the seam between the two
 *   products — cyan side. That is why this reads as two strands running
 *   together rather than the single dominant ribbon of `crm`/`admin`. The
 *   variant also selects the rail's stations (Contact → Enrollment → Member →
 *   Commission), which is literally the advisor's own record journey.
 *
 * COPY
 *   Every string below already shipped in this app; nothing here is new. The
 *   headline is /login's, the subtitle is the password layouts' — the two were
 *   merged into one hero rather than a third version being written.
 *
 * QUOTES ARE OFF
 *   `showQuotes={false}`. The rotator is the only element that moves while
 *   someone is typing a password, and WCAG 2.2.2 treats content that
 *   auto-updates for longer than five seconds as something the user must be
 *   able to pause. `AuthQuoteRotator`'s own header recommends this for
 *   production consoles; an advisor signing in at 7am is on a console.
 */
export function AdvisorAuthHero() {
  return (
    <AuthHeroPanel
      variant="advisor"
      badge="Advisor Portal"
      headline={
        <>
          <span className="block">Grow your</span>
          <span className={`block ${authForm.titleAccent}`}>advisor practice</span>
        </>
      }
      subtitle="Enroll members, track commissions, and manage your book of business from one advisor portal."
      showQuotes={false}
    />
  );
}
