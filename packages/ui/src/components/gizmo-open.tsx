export const GIZMO_OPEN_EVENT = 'gizmo:open';

export function openGizmo(query?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GIZMO_OPEN_EVENT, { detail: { query } }));
}
