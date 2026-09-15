/* Stride PWA v1. Only explicitly public, non-account assets enter this cache. */
const CACHE = 'stride-public-shell-v1';
const OFFLINE_HTML = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\"><meta name=\"theme-color\" content=\"#245e49\"><title>Stride \u2014 Offline</title><style>body{margin:0;background:#f6f8fa;color:#1b2927;font:16px/1.6 system-ui;min-height:100dvh;display:grid;place-items:center}main{padding: max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));max-width:360px}img{border-radius:24px}h1{font-size:26px}a{display:inline-block;background:#245e49;color:white;border-radius:8px;padding:12px 20px;text-decoration:none}</style></head><body><main><img src=\"/icons/stride-192.png\" width=\"80\" height=\"80\" alt=\"Stride\"><h1>You\u2019re offline</h1><p>Reconnect to load your account and continue training. Stride needs a connection to load and save your fitness data.</p><a href=\"\">Try again</a></main></body></html>\n";
const PUBLIC_FILES = [ '/icons/stride-192.png', '/icons/stride-512.png', '/icons/stride-maskable-512.png', '/icons/apple-touch-icon.png'];
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
    event.respondWith(fetch(request).catch(() => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })));
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
