/**
 * Pay It Forward CRM Service Worker
 * Handles caching for offline support and faster loads
 */

const CACHE_NAME = 'pif-crm-v1';
const STATIC_CACHE_NAME = 'pif-crm-static-v1';
const API_CACHE_NAME = 'pif-crm-api-v1';

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
  '/favicon.svg',
  '/logo.svg',
];

// Cache duration settings (in seconds)
const CACHE_DURATION = {
  api: 5 * 60,        // 5 minutes for API responses
  static: 7 * 24 * 60 * 60, // 7 days for static assets
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[CRM-SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[CRM-SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[CRM-SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[CRM-SW] Failed to cache static assets:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[CRM-SW] Activating service worker...');
  
  const validCaches = [CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME];
  
  event.waitUntil(
    caches.keys()
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
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (except for Supabase API)
  if (url.origin !== location.origin && !url.hostname.includes('supabase')) {
    return;
  }
  
  // Skip auth-related requests
  if (url.pathname.includes('/auth/') || url.pathname.includes('/login')) {
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
    '.js',
  ];
  return staticPatterns.some((pattern) => pathname.includes(pattern));
}

/**
 * Check if URL is an API request
 */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || 
         url.pathname.includes('/_next/data/') ||
         url.hostname.includes('supabase');
}

/**
 * Cache First Strategy - for static assets
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
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
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[CRM-SW] Network failed, trying cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
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
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[CRM-SW] Navigation failed, trying cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page for navigation requests
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale While Revalidate Strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, networkResponse.clone());
        });
      }
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
    // Future: Implement offline action queue sync
  }
});
