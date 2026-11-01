/* Wassl service worker — Web Push and v11 cache refresh. */
const WASSL_SW_VERSION = "wassl-v11-2026-11-01";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("wassl-") && key !== WASSL_SW_VERSION)
              .map((key) => caches.delete(key)),
          ),
        ),
    ]).then(() =>
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          clients.forEach((client) =>
            client.postMessage({ type: "WASSL_SW_UPDATED", version: WASSL_SW_VERSION }),
          ),
        ),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Wassl", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Wassl";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "wassl",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) client.navigate(target);
            return;
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
