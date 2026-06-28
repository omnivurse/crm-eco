/** Global event bus so any surface (dashboard hero, top bar) can open the command palette. */
export const CRM_OPEN_COMMAND_PALETTE_EVENT = 'crm:open-command-palette' as const;

export function openCrmCommandPalette(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CRM_OPEN_COMMAND_PALETTE_EVENT));
}
