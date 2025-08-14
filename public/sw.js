/* Network-only service worker (no caching) */
const SW_VERSION = "v3-network-only-2025-08-14";

self.addEventListener("install", (event) => {
  // Activate updated SW immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clear all existing caches from any previous versions
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      // Ensure the new SW controls all clients immediately
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  // Always fetch from network; do not read/write CacheStorage
  event.respondWith(
    fetch(event.request, { cache: "no-store" }).catch(() => {
      // If offline, let the request fail naturally without serving stale cache
      return new Response("", {
        status: 503,
        statusText: "Service Unavailable",
      });
    })
  );
});
