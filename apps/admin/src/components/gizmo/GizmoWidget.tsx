'use client';

import { usePathname, useRouter } from 'next/navigation';
import { GizmoCompanion } from '@crm-eco/ui/components/gizmo-companion';

export function AdminGizmoWidget() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <GizmoCompanion
      chatUrl="/api/gizmo/chat"
      pageLabel="Admin"
      pathname={pathname}
      onNavigate={(href) => router.push(href)}
      bottomClassName="bottom-4 right-4"
    />
  );
}
