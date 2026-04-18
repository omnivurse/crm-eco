# PWA Setup Complete

Progressive Web App (PWA) functionality has been implemented for both high-priority apps.

## Apps with PWA Support

| App | Location | Status | Features |
|-----|----------|--------|----------|
| **Member Portal** | `apps/portal` | ✅ Complete | Installable, offline caching, iOS support |
| **DHH CRM** | `apps/crm` | ✅ Complete | Installable, offline caching, update notifications, install prompt |

---

## What's Included

### 1. Web App Manifest (`manifest.json`)
- App name, description, theme colors
- App icons for all device sizes (72px to 512px)
- Standalone display mode
- App shortcuts (CRM only)

### 2. Service Worker (`sw.js`)
- **Cache-first** strategy for static assets (CSS, JS, images)
- **Network-first** strategy for API calls
- **Stale-while-revalidate** for HTML pages
- Offline fallback page
- Automatic cache cleanup on updates

### 3. PWA Meta Tags
- Apple Web App meta tags
- Theme color (light/dark mode aware in CRM)
- Viewport configuration for native feel

### 4. React Components

#### ServiceWorkerRegistration
Automatically registers the service worker and handles updates.

#### InstallPrompt (CRM only)
Prompts users to install the PWA with:
- Native install button for Chrome/Edge
- iOS Safari instructions
- Dismissable with 7-day cooldown

### 5. Offline Page
Branded offline fallback when network is unavailable.

---

## File Structure

```
apps/portal/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── offline.html           # Offline fallback
│   └── icons/                 # App icons (72-512px)
└── src/
    ├── app/layout.tsx         # Updated with PWA meta
    └── components/
        └── ServiceWorkerRegistration.tsx

apps/crm/
├── public/
│   ├── manifest.json          # PWA manifest with shortcuts
│   ├── sw.js                  # Service worker
│   ├── offline.html           # Themed offline fallback
│   └── icons/                 # App icons (72-512px)
└── src/
    ├── app/layout.tsx         # Updated with PWA meta
    └── components/pwa/
        ├── index.ts
        ├── ServiceWorkerRegistration.tsx
        └── InstallPrompt.tsx
```

---

## How to Test

### Chrome DevTools
1. Open DevTools → Application tab
2. Check "Service Workers" section
3. Check "Manifest" section for app details
4. Use "Lighthouse" to audit PWA compliance

### Install on Desktop
1. Visit the app in Chrome/Edge
2. Click the install icon in the address bar (or use InstallPrompt)
3. App opens in standalone window

### Install on Mobile

**Android (Chrome):**
1. Visit the app
2. Tap "Add to Home Screen" in menu (or banner)

**iOS (Safari):**
1. Visit the app
2. Tap Share → "Add to Home Screen"

### Test Offline
1. Open DevTools → Network tab
2. Check "Offline"
3. Navigate the app - cached pages should load
4. Offline page shows for uncached routes

---

## Regenerating Icons

If you need to update the app icons:

```bash
# Install sharp if not already installed
npm install sharp --save-dev

# Generate icons for CRM
node scripts/generate-pwa-icons.mjs apps/crm/public/logo.png apps/crm/public/icons

# Generate icons for Portal (use your own logo)
node scripts/generate-pwa-icons.mjs path/to/logo.png apps/portal/public/icons
```

**Recommended source image:**
- At least 512x512 pixels
- Square aspect ratio
- PNG with transparent background

---

## Future Enhancements

### Push Notifications (Not implemented yet)
Would require:
1. Supabase Edge Function for push server
2. VAPID key generation
3. Notification permission UI
4. Background sync for offline actions

### Background Sync (Stubbed)
Service worker has placeholder for:
- Offline form submissions
- Queued API calls
- Automatic sync when back online

---

## Hooks Available (CRM)

```tsx
import { useIsPWA, usePWAInstall } from '@/components/pwa';

// Check if running as installed PWA
const isPWA = useIsPWA();

// Access install prompt
const { canInstall, install } = usePWAInstall();
```

---

## Cache Versioning

To force cache refresh after deployments, update version in service workers:

```javascript
// In sw.js
const CACHE_NAME = 'dhh-crm-v2';        // Increment version
const STATIC_CACHE_NAME = 'dhh-crm-static-v2';
```

---

## Troubleshooting

**Service worker not registering:**
- Ensure HTTPS (or localhost)
- Check browser console for errors
- Clear site data and reload

**Install prompt not showing:**
- Must be served over HTTPS
- Must have valid manifest.json
- Must have registered service worker
- User may have dismissed it (7-day cooldown)

**Cached data stale:**
- Bump cache version in sw.js
- Use DevTools → Application → Clear storage

---

*Generated: February 5, 2026*
