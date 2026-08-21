/*
  The browser half of push.

  Everything here is defensive, because push support is genuinely uneven.
  Safari on iOS only offers it to a site added to the home screen, some
  browsers ship the API and then refuse the subscription, and a permission can
  be denied permanently in a way no amount of asking will undo. Each of those
  is a normal outcome, not an error, so each returns a reason the interface can
  say out loud instead of a thrown exception.
*/

export type PushOutcome =
  | { state: "subscribed"; endpoint: string }
  | { state: "denied" }
  | { state: "unsupported"; reason: string }
  | { state: "failed" };

/** Turns the VAPID public key from its URL-safe base64 into bytes. */
export function decodeVapidKey(key: string): Uint8Array {
  const padding = "=".repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** True when this browser is running the site as an installed app. */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, and only a touch screen gives it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Why push cannot be offered here, or null when it can. */
export function pushUnavailableReason(): string | null {
  if (typeof window === "undefined") return "Not available here.";
  if (!("serviceWorker" in navigator)) return "This browser does not support notifications.";
  if (!("PushManager" in window)) {
    return isIos()
      ? "On iPhone and iPad, add Arena to your home screen first. Share, then Add to Home Screen."
      : "This browser does not support notifications.";
  }
  if (!("Notification" in window)) return "This browser does not support notifications.";
  if (isIos() && !isInstalled()) {
    return "Add Arena to your home screen first. Share, then Add to Home Screen.";
  }
  return null;
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/*
  navigator.serviceWorker.ready never rejects. If no worker is registered, or
  registration failed, it simply waits for ever, and anything awaiting it waits
  with it. That is how a control silently disappears instead of saying what is
  wrong, so nothing here awaits it unguarded.
*/
const READY_TIMEOUT_MS = 5000;

/*
  Subscribing has to reach the browser's push service over the network, and a
  browser that cannot reach it does not fail: it waits. Left unbounded that is
  a button which spins for ever, so every wait here has an end.
*/
const SUBSCRIBE_TIMEOUT_MS = 20000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (pushUnavailableReason()) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration();

    // Registered here rather than assumed. In development the app does not
    // register a worker at all, and a first visit in production may still be
    // registering when somebody reaches for this.
    const pending = existing
      ? navigator.serviceWorker.ready
      : navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);

    return await withTimeout(pending, READY_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/** The endpoint of an existing subscription in this browser, if there is one. */
export async function currentEndpoint(): Promise<string | null> {
  const registration = await activeRegistration();
  if (!registration) return null;

  try {
    const existing = await registration.pushManager.getSubscription();
    return existing?.endpoint ?? null;
  } catch {
    return null;
  }
}

export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Asks the browser, then the push service, and hands back something the server
 * can store.
 *
 * The permission prompt fires here and nowhere else, so it is always the
 * direct result of somebody pressing a button.
 */
export async function subscribe(publicKey: string): Promise<
  PushOutcome & { subscription?: { endpoint: string; keys: { p256dh: string; auth: string } } }
> {
  const unavailable = pushUnavailableReason();
  if (unavailable) return { state: "unsupported", reason: unavailable };
  if (!publicKey) return { state: "unsupported", reason: "Notifications are not switched on yet." };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { state: "denied" };

    const registration = await activeRegistration();
    if (!registration) {
      return {
        state: "unsupported",
        reason: "This browser could not start the part of Arena that receives notifications.",
      };
    }

    /*
      An existing subscription is reused rather than replaced. Unsubscribing
      and resubscribing hands out a new endpoint, which would leave the old one
      in the database receiving nothing.
    */
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey) as BufferSource,
        }),
        SUBSCRIBE_TIMEOUT_MS
      ));

    if (!subscription) {
      return {
        state: "unsupported",
        reason: "Your browser could not reach its notification service. This can happen behind a strict network.",
      };
    }

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return { state: "failed" };

    return {
      state: "subscribed",
      endpoint: json.endpoint,
      subscription: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
    };
  } catch {
    return { state: "failed" };
  }
}

/** Ends the subscription in this browser and reports which endpoint went. */
export async function unsubscribe(): Promise<string | null> {
  try {
    const registration = await activeRegistration();
    if (!registration) return null;

    const existing = await registration.pushManager.getSubscription();
    if (!existing) return null;

    const endpoint = existing.endpoint;
    await existing.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
