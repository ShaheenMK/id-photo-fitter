// Offline cache for ID Photo Fitter.
// Small app files: network first (so updates arrive immediately), cache as the offline fallback.
// Big model files: cached once in their own cache that survives updates (so the ~90 MB is not downloaded again).
const APP = 'idphoto-app-v11', MODELS = 'idphoto-models';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const isBig = u => /\/(models|ort)\//.test(new URL(u).pathname);
self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys(), mc = await caches.open(MODELS);
    for (const k of keys) {
      if (k === APP || k === MODELS) continue;
      try { const c = await caches.open(k); for (const r of await c.keys()) if (isBig(r.url) && !(await mc.match(r))) { const hit = await c.match(r); if (hit) await mc.put(r, hit); } } catch (err) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range')) return;
  if (isBig(req.url)) {
    e.respondWith(caches.open(MODELS).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true }); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
