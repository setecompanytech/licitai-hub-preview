self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));

      await self.clients.claim();

      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      windowClients.forEach((client) => {
        client.navigate(client.url);
      });

      await self.registration.unregister();
    })()
  );
});

self.addEventListener("fetch", () => {
  // no-op: deixa a navegação seguir pela rede
});
