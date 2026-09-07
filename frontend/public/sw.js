const CACHE = "tripboard-shell-v2";
const SHELL = ["/", "/tripboard-mark.svg"];

// Pages behind or around sign-in render per viewer, so they are never cached
// and never replayed. The auth round-trip also has to reach the network so the
// proxy can turn a Google callback into a session cookie.
const PRIVATE = /^\/(api|auth|sign-in|sign-up|invite|account|trips)(\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // credentials: "omit" keeps the shell anonymous even when a signed-in
      // visitor is the one installing it.
      .then((cache) => cache.addAll(SHELL.map((path) => new Request(path, { credentials: "omit" })))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (PRIVATE.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
