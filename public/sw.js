// TeamPulse service worker.
// Page: always asks the server for the latest version (a cheap check when nothing changed), but falls back
// to the saved copy after 2.5 s so a slow connection never leaves a blank screen.
// App files: their names change with every update, so they are cached forever and kept across updates;
// a phone still running an older version can always find the files it needs.
const SHELL_CACHE = 'teampulse-shell-v4';
const ASSET_CACHE = 'teampulse-assets';
const SHELL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll([new Request(SHELL, { cache: 'reload' }), './manifest.webmanifest', './icons/icon.svg']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // Firebase, fonts etc. go straight to the network

  if (request.mode === 'navigate') {
    // `no-cache` = revalidate with the server, never reuse the browser's 10-minute copy of an old version.
    const network = fetch(request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(SHELL, copy));
      }
      return res;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(withTimeout(network, 2500).catch(() => caches.match(SHELL).then((hit) => hit || network)));
    return;
  }

  const isAsset = url.pathname.includes('/assets/');
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(isAsset ? ASSET_CACHE : SHELL_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
    )
  );
});
