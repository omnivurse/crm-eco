/**
 * Double Helix Hub Service Worker
 * Handles caching for offline support and faster loads
 */

const CACHE_VERSION = 5;
const CACHE_NAME = `dhh-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `dhh-static-v${CACHE_VERSION}`;
const API_CACHE_NAME = `dhh-api-v${CACHE_VERSION}`;

// Static assets to cache on install (must be real files that return 200)
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
];

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

  // Handle different request types
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
  }
});

/**
 * Check if URL is for a static asset
 */
function isStaticAsset(pathname) {
  const staticPatterns = [
    '/_next/static/',
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
    safeCachePut(cacheName, request, networkResponse);
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
    // Only cache successful HTML responses, not redirects (3xx) which
    // cause cross-origin errors when replayed from cache.
    if (networkResponse.status < 300) {
      safeCachePut(CACHE_NAME, request, networkResponse);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.info('[CRM-SW] Serving cached navigation (offline):', request.url);
      return cachedResponse;
    }

    const offlinePage = await caches.match('/offline');
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale While Revalidate Strategy
 * Returns cached response immediately, then updates the cache in the background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      safeCachePut(cacheName, request, networkResponse);
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || (await fetchPromise) || new Response('Offline', { status: 503 });
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
