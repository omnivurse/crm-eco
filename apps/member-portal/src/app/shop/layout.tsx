import { ReactNode } from 'react';
import { requireActiveMembership } from '@/lib/auth/require-active-membership';

export default async function ShopLayout({ children }: { children: ReactNode }) {
  await requireActiveMembership();
  return <>{children}</>;
}
