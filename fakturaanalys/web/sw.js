// Gör att appen öppnas även utan nät (t.ex. hemskärmsappen i Safari). Data ligger i IndexedDB.
const CACHE = 'fakturaanalys-v1';
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'sql-wasm-browser.wasm', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys()
  .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Claude-anrop går förbi
  // Nätet först (så att nya versioner syns), cache om nätet saknas
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
