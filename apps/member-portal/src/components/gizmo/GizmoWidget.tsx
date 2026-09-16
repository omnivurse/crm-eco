'use client';

import { usePathname, useRouter } from 'next/navigation';
import { GizmoCompanion } from '@crm-eco/ui/components/gizmo-companion';

export function MemberGizmoWidget() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <GizmoCompanion
      chatUrl="/api/gizmo/chat"
      pageLabel="Member portal"
      pathname={pathname}
      onNavigate={(href) => router.push(href)}
      bottomClassName="bottom-20 right-4 md:bottom-4"
    />
  );
}
