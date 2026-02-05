'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegistration Component
 * Registers the service worker for PWA functionality
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker on page load
      window.addEventListener('load', registerServiceWorker);
      
      return () => {
        window.removeEventListener('load', registerServiceWorker);
      };
    }
  }, []);

  return null;
}

/**
 * Register the service worker
 */
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service worker registered successfully:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available, show update prompt
            console.log('[PWA] New content available, refresh to update');
            
            // Optionally dispatch a custom event for UI notification
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Check for updates periodically (every hour)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
  }
}
