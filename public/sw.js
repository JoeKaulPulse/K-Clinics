// K Clinics admin — web-push service worker (Phase 4). Shows a notification on
// push and focuses/opens the right admin screen when it's clicked.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'K Clinics';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { href: data.href || '/admin' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes('/admin') && 'focus' in w) {
          w.focus();
          if ('navigate' in w) w.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
