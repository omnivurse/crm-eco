/**
 * Double Helix Hub Portal Service Worker
 * Deploy-safe caching — never serve stale HTML/RSC or _next/static after a release.
 */

const CACHE_VERSION = 2;
const CACHE_NAME = `dhh-portal-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `dhh-portal-static-v${CACHE_VERSION}`;
const API_CACHE_NAME = `dhh-portal-api-v${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [OFFLINE_URL, '/manifest.json', '/manifest.webmanifest'];

const INLINE_OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Portal</title><style>html,body{height:100%}body{margin:0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:linear-gradient(135deg,#f8fafc,#e2e8f0);display:grid;place-items:center;padding:24px}main{max-width:440px;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.08);padding:28px;text-align:center}h1{margin:0 0 8px;font-size:20px}p{margin:0 0 18px;color:#475569}button{appearance:none;border:0;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer}button:hover{background:#0e7490}small{display:block;margin-top:14px;color:#94a3b8;font-size:12px}</style></head><body><main><h1>You appear to be offline</h1><p>The page couldn't load. Check your connection and try again.</p><button onclick="location.reload()">Retry</button><small>If this keeps happening, open DevTools → Application → Service Workers → Unregister.</small></main></body></html>`;

function inlineOfflineResponse() {
  return new Response(INLINE_OFFLINE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

self.addEventListener('install', (event) => {
  console.log('[Portal-SW] Installing service worker...');

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
          console.warn(`[Portal-SW] Skipped caching ${url}:`, e);
        }
      }
      return self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Portal-SW] Activating service worker...');

  const validCaches = [CACHE_NAME, STATIC_CACHE_NAME, API_CACHE_NAME];

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !validCaches.includes(name))
            .map((name) => {
              console.log('[Portal-SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.origin !== location.origin && !url.hostname.includes('supabase')) {
    return;
  }

  // Keep in sync with public auth routes in middleware.ts.
  if (
    url.pathname.includes('/auth/') ||
    url.pathname.startsWith('/signin') ||
    url.pathname.startsWith('/signup') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/reset-password') ||
    url.pathname.startsWith('/update-password') ||
    url.pathname.startsWith('/access-denied')
  ) {
    return;
  }

  if (isNextDataRequest(request) || isPortalAppDocumentRequest(url, request)) {
    return;
  }

  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('Asset unavailable offline', { status: 503 })
      )
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(
      fetch(request).catch(() => new Response('Offline', { status: 503 }))
    );
  }
});

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
 * Member, agent, and public enrollment routes must bypass the SW for
 * document/RSC requests so post-deploy navigation always hits the network.
 */
function isPortalAppDocumentRequest(url, request) {
  if (url.pathname.startsWith('/api')) return false;
  if (url.pathname.includes('/_next/')) return false;

  const isAppRoute =
    url.pathname.startsWith('/enroll') ||
    url.pathname.startsWith('/agent') ||
    url.pathname.startsWith('/billing') ||
    url.pathname.startsWith('/needs') ||
    url.pathname.startsWith('/documents') ||
    url.pathname.startsWith('/dependents') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/plan') ||
    url.pathname.startsWith('/services') ||
    url.pathname.startsWith('/support') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/notifications') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/pricing');

  if (!isAppRoute) return false;
  return request.mode === 'navigate' || isNextDataRequest(request);
}

function isStaticAsset(pathname) {
  const staticPatterns = [
    '/icons/',
    '/images/',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.webp',
    '.woff',
    '.woff2',
  ];
  return staticPatterns.some((pattern) => pathname.includes(pattern));
}

function isApiRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/_next/data/') ||
    url.hostname.includes('supabase')
  );
}

function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok) return;
  if (response.type === 'opaque' || response.type === 'error') return;

  const clone = response.clone();
  caches.open(cacheName).then((cache) => cache.put(request, clone));
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    safeCachePut(cacheName, request, networkResponse);
    return networkResponse;
  } catch (error) {
    console.error('[Portal-SW] Cache first fetch failed:', error);
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      safeCachePut(cacheName, request, networkResponse);
    } else if (networkResponse.status === 404) {
      const cache = await caches.open(cacheName);
      await cache.delete(request);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.info('[Portal-SW] Serving cached API response (offline):', request.url);
      return cachedResponse;
    }

    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;
    return inlineOfflineResponse();
  }
}

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
