'use client';

import { AuthSplitLayout, AuthHeroPanel, authForm } from '@crm-eco/ui';
import { ThemeToggle } from '@/components/crm/shell/ThemeToggle';

const CRM_QUOTES = [
  { text: 'Pipeline clarity beats pipeline volume.', author: 'Double Helix CRM' },
  { text: 'Every lead deserves a stage, an owner, and a next action.', author: 'Double Helix CRM' },
  { text: 'Benefits sales run on trust — and systems that remember the details.', author: 'Double Helix CRM' },
];

/**
 * Shell for the /(auth) group. VISUAL ONLY — this layout renders no auth
 * logic; it wraps whatever page the group resolves to.
 *
 * `brandLabel` is the platform, not the product: below lg the shell renders
 * AuthBrandBar as the masthead (the brand side used to simply vanish there),
 * and the form's own mono eyebrow already says "CRM Core" a few pixels below
 * it. Masthead = who you are signing in with, eyebrow = which product.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSplitLayout
      variant="crm"
      brandLabel="Double Helix"
      toolbar={<ThemeToggle variant="icon" className="auth-theme-btn !h-9 !w-9" />}
      hero={
        <AuthHeroPanel
          variant="crm"
          badge="CRM Core"
          headline={
            <>
              <span className="block">Your book,</span>
              {/* Was `from-cyan-600 to-emerald-600 dark:from-cyan-300 …`. Those
                  literals resolve through the console's remapped `cyan` scale
                  (Muted Spruce), so the headline never matched the landing.
                  `.auth-title-accent` leads with the variant's own pigment. */}
              <span className={`block ${authForm.titleAccent}`}>one workspace</span>
            </>
          }
          subtitle="Pipelines, modules, and automations purpose-built for Medicare, ACA, group, and healthshare advisors."
          quotes={CRM_QUOTES}
        />
      }
    >
      {children}
    </AuthSplitLayout>
  );
}
