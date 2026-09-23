const CACHE = "rayyan-portfolio-v5";
const ASSET_ROOT = new URL("assets/", self.registration.scope);
const PRECACHE = [
  "profile-380.webp",
  "profile-640.webp",
  "profile-760.webp",
  "Imagenix.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE.map((path) => new URL(path, ASSET_ROOT).href)),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("rayyan-portfolio-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Only images are cached. HTML, CSS, JS, and the resume always use the network.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== ASSET_ROOT.origin ||
    !url.pathname.startsWith(ASSET_ROOT.pathname) ||
    !/\.(webp|png|svg)$/.test(url.pathname)
  )
    return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }),
  );
});
