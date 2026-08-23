/*
  Upside Arena service worker.

  Two jobs: make the app installable and keep the shell usable when the network
  drops, and receive push. Market data is never cached here, because a stale
  quote shown as live would be worse than no quote at all.
*/

const VERSION = "arena-v4";
const SHELL_CACHE = `${VERSION}-shell`;

const SHELL_ASSETS = ["/offline", "/icons/icon-192.png", "/manifest.webmanifest"];

/*
  Small, rarely-changed files worth holding on to. Kept as a set so the fetch
  handler decides with a lookup rather than a chain of comparisons on the
  critical path of every request the page makes.
*/
const STATIC_FILES = new Set([
  "/favicon.png",
  "/favicon.ico",
  "/arena-mark.svg",
  "/og.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
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

  // Never serve an authenticated or API response from cache.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations go to the network first, falling back to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/offline");
        return cached ?? Response.error();
      })
    );
    return;
  }

  /*
    Build output, addressed by content.

    Everything under /_next/static/ has a hash of its own contents in its
    name, so a hit is not merely probably right, it is exactly the file that
    was asked for. Revalidating it in the background, as this used to, spent a
    request per asset on every load to be told what the URL already said. A
    changed file is a changed name and misses the cache on its own.
  */
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  /*
    Icons and the mark. Not content-addressed, so these are served from cache
    and refreshed behind the screen: shown instantly, correct by the next load.
  */
  if (url.pathname.startsWith("/icons/") || STATIC_FILES.has(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      })
    );
  }
});

/*
  Push.

  The payload is already the finished message: the server decided what to say,
  whether it was allowed to say it, and where it should lead. Nothing is
  fetched here, so a notification cannot arrive blank because a request failed
  while the phone was asleep.

  Every push shows something. userVisibleOnly was promised at subscribe time,
  and a browser that catches us pushing silently revokes the subscription.
*/
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }

  const title = message.title || "Upside Arena";
  const url = message.url || "/home";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      /*
        Collapse on the URL. If two arrive while the phone is off, the second
        replaces the first rather than stacking, because a pile of them is what
        gets a channel muted.
      */
      tag: url,
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/home",
    self.location.origin
  );

  // Same origin only. A notification must never be able to open somewhere else.
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // A tab already open is focused and moved, rather than a second one
        // being opened next to it.
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin && "focus" in client) {
            return client.focus().then((focused) =>
              focused.navigate ? focused.navigate(target.href) : focused
            );
          }
        }
        return self.clients.openWindow(target.href);
      })
  );
});

/*
  A push service can retire a subscription on its own. When it does, the
  browser is told first, and re-subscribing here keeps someone who agreed once
  from silently falling off.
*/
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription;
  const options = {
    userVisibleOnly: true,
    applicationServerKey:
      (event.oldSubscription && event.oldSubscription.options
        ? event.oldSubscription.options.applicationServerKey
        : null) || null,
  };

  if (!options.applicationServerKey) return;

  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((subscription) =>
      fetch("/api/push/resubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          old: old ? old.endpoint : null,
          subscription: subscription.toJSON(),
        }),
      }).catch(() => undefined)
    )
  );
});
