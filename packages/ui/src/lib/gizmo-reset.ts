/**
 * Whole-query reset. "new search wendy" stays a search.
 * "new search" / "clear" / "start over" wipe the thread.
 */
const RESET_PHRASES = new Set([
  'clear',
  'clear it',
  'clear chat',
  'clear search',
  'clear conversation',
  'clear history',
  'reset',
  'reset chat',
  'reset search',
  'new search',
  'new chat',
  'new conversation',
  'fresh search',
  'start over',
  'start fresh',
  'start again',
  'start a new search',
  'start a new chat',
  'forget that',
  'forget this',
  'wipe',
  'wipe it',
]);

export function isGizmoResetQuery(query: string): boolean {
  const normalized = query
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+/g, '')
    .replace(/\s+/g, ' ');
  const stripped = normalized.replace(/^(please|can you|could you|just)\s+/, '');
  return RESET_PHRASES.has(stripped);
}
