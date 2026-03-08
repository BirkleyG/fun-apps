const CACHE_NAME = "launcher-shell-v2";
const RUNTIME_CACHE = "launcher-runtime-v2";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const basePath = self.location.pathname.replace(/service-worker\.js$/, "");
  const path = url.pathname;
  const isLauncherNav = path === basePath || path === `${basePath}index.html`;
  const isLauncherAsset =
    path.startsWith(`${basePath}assets/`) ||
    path === `${basePath}manifest.webmanifest` ||
    path === `${basePath}service-worker.js` ||
    path === `${basePath}icon.svg`;

  if (request.mode === "navigate") {
    if (!isLauncherNav) {
      event.respondWith(fetch(request, { cache: "no-store" }));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (!isLauncherAsset) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
