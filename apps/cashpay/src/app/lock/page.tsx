import { PIN_LOCK_PAGE_METADATA } from '@crm-eco/ui/lib/pin-lock';
import { PinLockPage } from '@crm-eco/ui/components/pin-lock-page';

export const metadata = PIN_LOCK_PAGE_METADATA;
export const dynamic = 'force-dynamic';

export default function LockPage() {
  return <PinLockPage />;
}
