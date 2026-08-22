import { headers } from 'next/headers';
import { PIN_LOCK_PATH_HEADER } from '@crm-eco/ui/lib/pin-lock';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Marketing chrome is omitted on `/lock` so the PIN page is the only HTML
 * visitors see. Legal review paths still get the normal header.
 */
export async function WebsiteChrome({ children }: { children: React.ReactNode }) {
  const isLock = (await headers()).get(PIN_LOCK_PATH_HEADER) === '1';
  if (isLock) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
