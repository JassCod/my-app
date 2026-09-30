// TeamPulse service worker.
// Pages: serve the cached shell instantly and refresh it in the background, so a slow or
// flaky connection can never leave the app stuck on a blank screen. Assets are content-hashed,
// so they are cache-first.
const CACHE = 'teampulse-v3';
const SHELL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([SHELL, './manifest.webmanifest', './icons/icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    const network = fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(SHELL, copy));
      }
      return res;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      // Fresh page if the network answers quickly; otherwise the cached shell right away.
      withTimeout(network, 2500).catch(() => caches.match(SHELL).then((hit) => hit || network))
    );
    return;
  }

  if (url.origin !== location.origin) return; // fonts etc. go straight to the network
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
