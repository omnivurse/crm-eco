/**
 * Pay It Forward Health Portal Service Worker
 * Handles caching for offline support and faster loads
 */

const CACHE_NAME = 'pif-health-portal-v1';
const STATIC_CACHE_NAME = 'pif-health-static-v1';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/login',
  '/offline',
  '/manifest.json',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fallback to cache (for API calls and dynamic content)
  networkFirst: ['/_next/data/', '/api/'],
  // Cache first, fallback to network (for static assets)
  cacheFirst: ['/_next/static/', '/icons/', '/images/', '.png', '.jpg', '.svg', '.woff2'],
  // Stale while revalidate (for HTML pages)
  staleWhileRevalidate: ['/'],
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
            .map((name) => {
              return caches.delete(name);
            })
        );
      })
      .then(() => {
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
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Skip Supabase auth requests
  if (url.pathname.includes('/auth/')) {
    return;
  }

  // Determine caching strategy based on URL
  if (matchesPatterns(url.pathname, CACHE_STRATEGIES.cacheFirst)) {
    event.respondWith(cacheFirst(request));
  } else if (matchesPatterns(url.pathname, CACHE_STRATEGIES.networkFirst)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * Check if URL matches any of the patterns
 */
function matchesPatterns(pathname, patterns) {
  return patterns.some((pattern) => pathname.includes(pattern));
}

/**
 * Cache First Strategy
 * Good for static assets that don't change often
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First Strategy
 * Good for API calls and dynamic content
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale While Revalidate Strategy
 * Returns cached version immediately, updates cache in background
 */
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const cache = caches.open(CACHE_NAME);
        cache.then((c) => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed, return offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/offline');
      }
      return new Response('Offline', { status: 503 });
    });
  
  return cachedResponse || fetchPromise;
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
