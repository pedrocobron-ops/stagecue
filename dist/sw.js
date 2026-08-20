// GERADO por scripts/build.mjs
const CACHE = 'stagecue-1sy9y6x';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  const cacheable = u.origin === location.origin || u.hostname === 'cdn.jsdelivr.net';
  if (!cacheable) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    try {
      const r = await fetch(e.request);
      if (r && r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      const m = await c.match(e.request, { ignoreSearch: u.origin === location.origin });
      if (m) return m;
      throw err;
    }
  }));
});
