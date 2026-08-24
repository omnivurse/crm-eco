/**
 * Read the team-invite token from a URL.
 *
 * New mail uses `?token=` so email clients and redirects keep it.
 * Older mail used `#token=`; still accepted so already-sent invites work
 * once the PIN gate no longer intercepts `/accept-invite`.
 */
export function readInviteToken(search: string, hash: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const fromQuery = new URLSearchParams(query).get('token')?.trim();
  if (fromQuery) return fromQuery;

  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (fragment.startsWith('token=')) {
    const value = fragment.slice('token='.length).trim();
    return value || null;
  }
  return null;
}

export function buildInviteAcceptPath(token: string): string {
  return `/accept-invite?token=${encodeURIComponent(token)}`;
}
