'use client';

import { usePathname, useRouter } from 'next/navigation';
import { GizmoCompanion } from '@crm-eco/ui/components/gizmo-companion';
import { useGizmo } from './GizmoProvider';

export function GizmoWidget() {
  const gizmo = useGizmo();
  const pathname = usePathname();
  const router = useRouter();

  if (!gizmo.enabled) return null;

  return (
    <GizmoCompanion
      chatUrl="/api/gizmo/chat"
      pageLabel={gizmo.currentPageLabel}
      pathname={pathname}
      tips={gizmo.currentTips}
      onDismissTip={gizmo.dismissTip}
      onHide={() => gizmo.setEnabled(false)}
      onNavigate={(href) => router.push(href)}
      hasUnreadTips={gizmo.hasNewTips}
      bottomClassName="bottom-14 right-4"
      enabled={gizmo.enabled}
    />
  );
}
