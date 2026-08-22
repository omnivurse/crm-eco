/** Shared noindex header. Keep in sync with `pin-lock.ts`. */
export const X_ROBOTS_TAG_NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

/** Next.js `headers()` entries — apply to every path, including legal / lock. */
export function noIndexRouteHeaders() {
  return [
    {
      source: '/:path*',
      headers: [{ key: 'X-Robots-Tag', value: X_ROBOTS_TAG_NOINDEX }],
    },
  ];
}
