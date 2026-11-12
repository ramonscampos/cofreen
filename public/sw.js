// Minimal service worker: it only makes the app installable and shows a simple
// offline page when a page load fails. It never caches pages, API responses or
// server actions, so financial data always comes fresh from the network.
// Bump the version whenever offline.html changes so installed apps refresh it
const CACHE = "cofreen-offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads fall back to the offline page; everything else goes
  // straight to the network untouched
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (
        (await cache.match(OFFLINE_URL)) ??
        new Response("Você está offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
