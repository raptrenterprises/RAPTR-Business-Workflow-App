// Minimal service worker — required by Android/Chrome to treat this as an
// installable app. It doesn't cache anything yet; every request just goes
// straight to the network. Good enough for "installable," not offline-capable.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
