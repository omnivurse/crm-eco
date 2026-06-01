/**
 * Double Helix Hub Service Worker
 * Handles caching for offline support and faster loads
 */

const CACHE_VERSION = 13;
const CACHE_NAME = `dhh-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `dhh-static-v${CACHE_VERSION}`;
const API_CACHE_NAME = `dhh-api-v${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Static assets to cache on install (must be real files that return 200).
// OFFLINE_URL is intentionally first — it's the one asset we *must* have
// cached before the fetch handler starts intercepting navigation requests,
// otherwise the offline-fallback branch degrades to a bare 503.
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/logo-icon.png',
  '/icon-192.png',
  '/icon-512.png',
];

// Last-resort offline shell. Inlined so a broken precache (or first navigation
// before install completes) still renders a useful page instead of bare text.
const INLINE_OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — CRM</title><style>html,body{height:100%}body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:linear-gradient(135deg,#f8fafc,#e2e8f0);display:grid;place-items:center;padding:24px}main{max-width:440px;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.08);padding:28px;text-align:center}h1{margin:0 0 8px;font-size:20px}p{margin:0 0 18px;color:#475569}button{appearance:none;border:0;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}button:hover{background:#0e7490}small{display:block;margin-top:14px;color:#94a3b8;font-size:12px}</style></head><body><main><h1>You appear to be offline</h1><p>The page couldn't load. Check your connection and try again.</p><button onclick="location.reload()">Retry</button><small>If this keeps happening, open DevTools → Application → Service Workers → Unregister.</small></main></body></html>`;

function inlineOfflineResponse() {
  return new Response(INLINE_OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/**
 * Install event - cache static assets individually (fault-tolerant)
 * Does NOT use cache.addAll() because a single 404 would reject the whole install.
 */
self.addEventListener('install', (event) => {
  console.log('[CRM-SW] Installing service worker...');

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);
      for (const url of STATIC_ASSETS) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            await cache.put(url, res.clone());
          }
        } catch (e) {
          console.warn(`[CRM-SW] Skipped caching ${url}:`, e);
        }
      }
      console.log('[CRM-SW] Static assets cached');
      return self.skipWaiting();
    })()
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[CRM-SW] Activating service worker...');

  const validCaches = [CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME];

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !validCaches.includes(name))
            .map((name) => {
              console.log('[CRM-SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[CRM-SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except Supabase API)
  if (url.origin !== location.origin && !url.hostname.includes('supabase')) {
    return;
  }

  // Skip auth-related requests entirely — never cache, never intercept.
  // Must stay in sync with the public auth routes in middleware.ts.
  if (
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/login') ||
    url.pathname.includes('/crm-login') ||
    url.pathname.includes('/crm-access-denied') ||
    url.pathname.includes('/reset-password') ||
    url.pathname.includes('/update-password') ||
    url.pathname.includes('/accept-invite')
  ) {
    return;
  }

  // Skip Next.js flight/router requests and CRM navigations — browser only.
  if (isNextDataRequest(request) || isCrmAppDocumentRequest(url)) {
    return;
  }

  // `/_next/static/*` must never be cache-first or cached offline: after a deploy,
  // stale webpack chunks + fresh HTML yields 404 CSS/JS and ChunkLoadError.
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('Asset unavailable offline', { status: 503 })
      )
    );
    return;
  }

  // Handle different request types
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    // Network-only fallback — avoids stale HTML/RSC after deploy.
    event.respondWith(
      fetch(request).catch(() => new Response('Offline', { status: 503 }))
    );
  }
});

/**
 * Next.js App Router RSC / router prefetch requests must never be cached.
 * Serving a stale flight payload after deploy causes HTML to reference
 * webpack chunks from the previous deployment (404 + ChunkLoadError).
 */
function isNextDataRequest(request) {
  const headers = request.headers;
  return (
    headers.get('RSC') === '1' ||
    headers.get('Next-Router-Prefetch') === '1' ||
    headers.get('Next-Router-State-Tree') != null ||
    (headers.get('Accept') || '').includes('text/x-component')
  );
}

/**
 * CRM app routes (except static/API) should bypass the SW entirely for
 * all GETs so post-deploy navigation and App Router fetches always hit
 * the network (router.push RSC requests are not always `navigate` mode).
 */
function isCrmAppDocumentRequest(url) {
  if (url.pathname.startsWith('/crm/api')) return false;
  if (url.pathname.includes('/_next/')) return false;
  return (
    url.pathname.startsWith('/crm') ||
    url.pathname.startsWith('/enrollments')
  );
}

/**
 * Check if URL is for a static asset
 */
function isStaticAsset(pathname) {
  const staticPatterns = [
    '/icons/',
    '/images/',
    '/signatures/',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
    '.woff',
    '.woff2',
    '.css',
  ];
  return staticPatterns.some((pattern) => pathname.includes(pattern));
}

/**
 * Check if URL is an API request
 */
function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/_next/data/') ||
    url.hostname.includes('supabase')
  );
}

/**
 * Safely cache a response. Only caches if the response is cacheable
 * (status 200, basic or cors type — never opaque or error).
 */
function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok) return;
  if (response.type === 'opaque' || response.type === 'error') return;

  const clone = response.clone();
  caches.open(cacheName).then((cache) => cache.put(request, clone));
}

/**
 * Cache First Strategy - for static assets
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    safeCachePut(cacheName, request, networkResponse);
    return networkResponse;
  } catch (error) {
    console.error('[CRM-SW] Cache first fetch failed:', error);
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

/**
 * Network First Strategy - for API requests
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      safeCachePut(cacheName, request, networkResponse);
    } else if (networkResponse.status === 404) {
      // Purge stale chunk after deploy so we never replay a prior dpl's asset.
      const cache = await caches.open(cacheName);
      await cache.delete(request);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.info('[CRM-SW] Serving cached API response (offline):', request.url);
      return cachedResponse;
    }

    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Network First with Offline Fallback - for navigation requests
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    // Never cache navigation HTML — stale shell references old _next/static hashes.
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.info('[CRM-SW] Serving cached navigation (offline):', request.url);
      return cachedResponse;
    }

    // Navigation fallback: serve the precached offline shell. The shell
    // reads the recent-records index from IndexedDB so the user lands
    // on something actionable rather than a bare error page.
    const offlinePage =
      (await caches.match(OFFLINE_URL)) || (await caches.match('/offline'));
    if (offlinePage) return offlinePage;

    // Final fallback: inline HTML so a broken precache still renders a
    // page with a Retry button instead of bare "Offline" plaintext.
    return inlineOfflineResponse();
  }
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

/**
 * Background sync for offline form submissions (future enhancement)
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    console.log('[CRM-SW] Syncing pending actions...');
  }
});
