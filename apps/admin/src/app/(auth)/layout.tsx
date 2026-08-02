'use client';

import { AuthSplitLayout, AuthHeroPanel } from '@crm-eco/ui';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const ADMIN_QUOTES = [
  { text: 'Enrollment is an operating system — not a spreadsheet.', author: 'Double Helix Admin' },
  { text: 'Billing, commissions, and members belong on one spine.', author: 'Double Helix Admin' },
  { text: 'Multi-tenant isolation is a feature, not a checkbox.', author: 'Double Helix Admin' },
];

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
              <span className="block bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-300 dark:via-teal-300 dark:to-cyan-300 bg-clip-text text-transparent">
                under control
              </span>
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
