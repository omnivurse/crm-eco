import type { QuickCreateModuleKey } from '@/lib/crm/quick-create-config';

export const CRM_OPEN_QUICK_CREATE_EVENT = 'crm:open-quick-create' as const;

export function openCrmQuickCreate(moduleKey: QuickCreateModuleKey): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CRM_OPEN_QUICK_CREATE_EVENT, { detail: { moduleKey } }),
  );
}
