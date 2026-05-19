const CACHE = 'rayyan-portfolio-v4';
const PRECACHE = [
  '/assets/profile-320.webp',
  '/assets/profile-380.webp',
  '/assets/profile-640.webp',
  '/assets/profile-760.webp',
  '/assets/Imagenix.webp',
  '/assets/FastAPI.webp',
  '/assets/Brain-Tumor.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.pathname.startsWith('/assets/')) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        const network = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
        return cached || network;
      })
    )
  );
});
