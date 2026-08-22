/** Shared noindex + stealth headers. Keep in sync with `pin-lock.ts`. */
export const X_ROBOTS_TAG_NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

/** Next.js `headers()` entries — apply to every path, including legal / lock. */
export function noIndexRouteHeaders() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: X_ROBOTS_TAG_NOINDEX },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
    {
      source: '/lock',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        { key: 'X-Robots-Tag', value: X_ROBOTS_TAG_NOINDEX },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    },
  ];
}
