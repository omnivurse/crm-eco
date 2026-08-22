import { isPinLockRequest } from '@crm-eco/ui/lib/pin-lock-server';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Marketing chrome is omitted on `/lock` so the PIN page is the only HTML
 * visitors see. Legal review paths still get the normal header.
 */
export async function WebsiteChrome({ children }: { children: React.ReactNode }) {
  if (await isPinLockRequest()) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
