// Service worker for the installed (home screen) copy.
// Network first for everything of our own, so an update shows up the next time the
// app opens; the cache is the offline fallback, and also answers when the network is
// too slow (a weak signal at the table). Fonts never change, so they come from the cache.
// VERSION is stamped by build.js: a new stamp makes the browser install this worker
// again and drop the old cache.
const VERSION = '190a5ec821';
const CACHE = 'waaagh-codex-' + VERSION;
const FONTS = ['fonts/atkinson-400-ext.woff2', 'fonts/atkinson-400.woff2', 'fonts/atkinson-400i-ext.woff2', 'fonts/atkinson-400i.woff2', 'fonts/atkinson-500-ext.woff2', 'fonts/atkinson-500.woff2', 'fonts/atkinson-600-ext.woff2', 'fonts/atkinson-600.woff2', 'fonts/atkinson-700-ext.woff2', 'fonts/atkinson-700.woff2', 'fonts/barlow-condensed-500-ext.woff2', 'fonts/barlow-condensed-500.woff2', 'fonts/barlow-condensed-600-ext.woff2', 'fonts/barlow-condensed-600.woff2', 'fonts/barlow-condensed-700-ext.woff2', 'fonts/barlow-condensed-700.woff2'];   // shipped with the app (fonts/OFL.txt, fonts/OFL-atkinson.txt)
const CORE = ['./', 'index.html', 'data.js', 'verified.js', 'manifest.webmanifest', 'icon-192.png', 'icon-180.png', 'icon-512.png', 'icon-maskable.png'].concat(FONTS);

self.addEventListener('install', e => {
  self.skipWaiting();
  // if a file fails to download the install fails and the previous worker stays in charge
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'no-cache' })))));
});
self.addEventListener('activate', e => {
  // drop older copies only once this one is complete
  e.waitUntil((async () => {
    const mine = await caches.open(CACHE);
    const complete = (await Promise.all(CORE.map(u => mine.match(u)))).every(Boolean);
    if (complete) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('waaagh-codex') && k !== CACHE).map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !font) return;
  if (own && url.pathname.endsWith('version.json')) return; // always straight to the network
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = () => cache.match(stripQuery(req), { ignoreSearch: own });
    if (font) {
      const hit = await cached();
      if (hit) return hit;
    }
    // no-cache revalidates with the server, so GitHub Pages' 10-minute cache can't serve old files
    const net = fetch(own ? new Request(req, { cache: 'no-cache' }) : req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(stripQuery(req), res.clone());
      return res;
    });
    net.catch(() => {});   // a failure is handled below; this only silences the background copy
    try {
      // a slow network: show the cached copy after 2.5 s (the fetch still refreshes the cache)
      const slow = new Promise(resolve => setTimeout(resolve, 2500));
      const first = await Promise.race([net, slow.then(() => cached())]);
      return first || await net;
    } catch (err) {
      // offline: this build's copy, else any older copy still stored
      const hit = await cached() || await caches.match(stripQuery(req), { ignoreSearch: own });
      if (hit) return hit;
      if (req.mode === 'navigate') { const page = await caches.match('index.html'); if (page) return page; }
      throw err;
    }
  })());
});

function stripQuery(req) {
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return req;
  u.search = '';
  return new Request(u.toString());
}
