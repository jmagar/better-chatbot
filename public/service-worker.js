// Service Worker version (increment to force update)
const SW_VERSION = 'v1.0.0';
const CACHE_NAME = `better-chatbot-${SW_VERSION}`;

// Install event - just skip waiting
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event:', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event:', SW_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first (no offline support)
self.addEventListener('fetch', (event) => {
  // Just pass through to network, don't cache anything
  // This satisfies PWA requirements without implementing offline functionality
  event.respondWith(fetch(event.request));
});
