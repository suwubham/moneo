// Moneo's service worker. It keeps the app's files and the offline page, never anyone's data:
// signed-in pages always come from the network, and when that fails you land on /offline.
const VERSION = "moneo-v1";
const SHELL = ["/offline", "/manifest.webmanifest", "/icon/192", "/icon/512"];

async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(SHELL);
  // The offline page's own scripts and styles, so it can start with no network at all.
  const html = await (await cache.match("/offline")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Build files never change under the same name: serve from cache, fill it as they are fetched.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: always the network. With no network, the offline page, remembering where you were going.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        if (url.pathname === "/offline") return caches.match("/offline");
        return Response.redirect(`/offline?from=${encodeURIComponent(url.pathname + url.search)}`, 302);
      }),
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
  }
});
