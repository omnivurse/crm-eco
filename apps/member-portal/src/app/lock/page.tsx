import { PinLockPage, PIN_LOCK_PAGE_METADATA } from '@crm-eco/ui/components/pin-lock-overlay';

export const metadata = PIN_LOCK_PAGE_METADATA;

export default async function LockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <PinLockPage next={next} />;
}
