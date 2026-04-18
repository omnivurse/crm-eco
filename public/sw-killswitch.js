/**
 * Service Worker Kill-Switch
 * Deploy this at /sw.js on crm.payitforwardhealth.com to clean up
 * cached service workers from the old domain.
 *
 * Once deployed, any user visiting the old domain will:
 *   1. Delete all caches
 *   2. Unregister this service worker
 *   3. Redirect to crm.doublehelixhub.com
 */

// Immediately take control
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete all caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // Unregister ourselves
      await self.registration.unregister();

      // Notify all clients to navigate to the new domain
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        const oldUrl = new URL(client.url);
        const newUrl = `https://crm.doublehelixhub.com${oldUrl.pathname}${oldUrl.search}${oldUrl.hash}`;
        client.navigate(newUrl);
      }
    })()
  );
});

// Pass through all fetch requests (no caching)
self.addEventListener('fetch', () => {});
