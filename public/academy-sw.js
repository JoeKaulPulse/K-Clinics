// Minimal service worker for the K Academy installable app. Deliberately
// transparent: it exists (with a fetch handler) so the academy is installable,
// but it never caches HTML or alters responses, so it can't serve stale pages.
// Offline shell/caching can be layered on later if wanted.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No respondWith — the browser handles every request normally.
});
