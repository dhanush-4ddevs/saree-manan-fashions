/* Network-only service worker: no caching */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(
        () =>
          new Response(
            `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Offline</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;margin:0;padding:2rem;background:#fff;color:#111}
    .banner{background:#ef4444;color:#fff;padding:.75rem 1rem;border-radius:.5rem}
  </style>
  </head>
  <body>
    <div class="banner">You are offline. Please check your internet connection and try again.</div>
  </body>
  </html>`,
            { headers: { "Content-Type": "text/html" } }
          )
      )
    );
    return;
  }

  event.respondWith(fetch(req, { cache: "no-store" }));
});
