'use client';

import { usePathname, useRouter } from 'next/navigation';
import { GizmoCompanion } from '@crm-eco/ui/components/gizmo-companion';
import { useGizmo } from './GizmoProvider';

export function GizmoWidget() {
  const gizmo = useGizmo();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <GizmoCompanion
      chatUrl="/api/gizmo/chat"
      pageLabel={gizmo.currentPageLabel}
      pathname={pathname}
      tips={gizmo.currentTips}
      onDismissTip={gizmo.dismissTip}
      onNavigate={(href) => router.push(href)}
      hasUnreadTips={gizmo.hasNewTips}
      bottomClassName="bottom-16 right-4"
      enabled
    />
  );
}
