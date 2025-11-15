// Service Worker version (increment to force update)
const SW_VERSION = 'v1.0.0';

// Install event - just skip waiting
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event:', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - take control of all clients
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event:', SW_VERSION);
  event.waitUntil(self.clients.claim());
});

// Fetch event - network-first (no offline support)
self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Pass through to network with error handling
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.error('[ServiceWorker] Fetch failed:', error);
      // Return a basic error response
      return new Response('Network error occurred', {
        status: 408,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
