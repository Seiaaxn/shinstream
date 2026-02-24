/**
 * KitaNime Service Worker
 * Provides offline support and caching for PWA functionality
 */

const CACHE_NAME = 'kitanime-v1';
const STATIC_CACHE = 'kitanime-static-v1';
const DYNAMIC_CACHE = 'kitanime-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/offline',
    '/css/theme.css',
    '/css/responsive.css',
    '/css/dark-mode-enhanced.css',
    '/js/ui-enhancements.js',
    '/js/realtime.js',
    '/images/logo.png',
    '/images/favicon.ico'
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
    '/v1/home',
    '/v1/ongoing-anime',
    '/v1/complete-anime',
    '/v1/genres'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('offline')));
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) requests
    if (!request.url.startsWith('http')) return;

    // API requests - network first, cache fallback
    if (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets - cache first, network fallback
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // HTML pages - network first with offline fallback
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(networkFirstWithOffline(request));
        return;
    }

    // Default - stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
});

// Check if request is for static asset
function isStaticAsset(pathname) {
    return /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname);
}

// Cache-first strategy
async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        return new Response('Resource not available', { status: 503 });
    }
}

// Network-first strategy
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Network-first with offline page fallback
async function networkFirstWithOffline(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Return offline page for navigation requests
        const offlinePage = await caches.match('/offline');
        if (offlinePage) {
            return offlinePage;
        }

        return new Response('Offline - halaman tidak tersedia', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                const cache = caches.open(DYNAMIC_CACHE);
                cache.then(c => c.put(request, response.clone()));
            }
            return response;
        })
        .catch(() => null);

    return cached || fetchPromise;
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'Episode baru tersedia!',
        icon: '/images/logo.png',
        badge: '/images/logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Tonton Sekarang' },
            { action: 'close', title: 'Tutup' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'KitaNime', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if found
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Background sync for offline actions (future use)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-bookmarks') {
        event.waitUntil(syncBookmarks());
    }
});

async function syncBookmarks() {
    // Sync any pending bookmark actions when back online
    console.log('[SW] Syncing bookmarks...');
}

console.log('[SW] Service worker loaded');
