const CACHE = "rayyan-portfolio-v10";
const ASSET_ROOT = new URL("assets/", self.registration.scope);
// Cache images on demand instead of downloading every portrait size at install.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
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

// Images and the versioned libraries in assets/vendor/ are cached. HTML, CSS,
// the site's own JS, and the resume always use the network.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;
  if (
    event.request.method !== "GET" ||
    url.origin !== ASSET_ROOT.origin ||
    !path.startsWith(ASSET_ROOT.pathname) ||
    !(/\.(webp|png|svg)$/.test(path) || (path.startsWith(`${ASSET_ROOT.pathname}vendor/`) && path.endsWith(".js")))
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
