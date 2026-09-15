/* Stride PWA v1. Only explicitly public, non-account assets enter this cache. */
const CACHE = 'stride-public-shell-v1';
const PUBLIC_FILES = ['/offline.html', '/icons/stride-192.png', '/icons/stride-512.png', '/icons/stride-maskable-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of PUBLIC_FILES) {
      const response = await fetch(path, { cache: 'reload', credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error('Public asset unavailable');
      await cache.put(path, response);
    }
  })());
});
// Intentionally no skipWaiting or clients.claim: never replace an active workout's worker.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('stride-public-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Auth, APIs, RSC payloads, and account HTML always use the normal network path.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
    return;
  }
  // Only immutable build assets or our explicit public files. Never arbitrary images/data.
  const builtAsset = /^\/_next\/static\/(chunks|css|media)\/[\w.-]+[.-][\w-]{8,}\.(js|css|woff2?)$/.test(url.pathname);
  if (url.search || !(PUBLIC_FILES.includes(url.pathname) || builtAsset)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.type === 'basic' && /^(text\/css|(?:text|application)\/javascript|font\/)/.test(response.headers.get('Content-Type') || '')) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > 100) await cache.delete(keys[PUBLIC_FILES.length]);
    }
    return response;
  })());
});
