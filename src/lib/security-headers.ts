/**
 * Browser security headers.
 *
 * Adapted from Upside Lab's, which carries lessons that only showed up in
 * production. Static headers live in next.config.ts so they cover every
 * response including static files, which never reach proxy.ts. The content
 * security policy is set in proxy.ts instead, because two policies on one
 * response are combined by the browser and a second copy here would tighten
 * things in surprising ways.
 */

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

function supabaseConnectSrc(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return ["https://*.supabase.co", "wss://*.supabase.co"];
  try {
    const url = new URL(raw);
    return [url.origin, `wss://${url.host}`];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

/**
 * Content security policy for the app shell.
 *
 * `'unsafe-inline'` in script-src is required by the inline scripts Next.js
 * emits to hydrate a page. A nonce cannot replace it here: a nonce in
 * script-src makes the browser ignore `'unsafe-inline'` entirely, and any
 * prerendered HTML served from a cache carries no matching nonce, so
 * hydration is blocked and the page never becomes interactive.
 *
 * `'strict-dynamic'` stays off because Vercel Analytics injects a same-origin
 * script at runtime without a nonce.
 *
 * Market data is fetched on the server, so no price feed appears in
 * connect-src. The browser never talks to a data vendor directly.
 */
export function buildContentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const isPreview = process.env.VERCEL_ENV === "preview";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://va.vercel-scripts.com",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];

  const connectSrc = [
    "'self'",
    ...supabaseConnectSrc(),
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    ...(isPreview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
    ...(isDev
      ? ["http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]
      : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    // Google returns a profile picture on its own domain after sign-in.
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // Sign-in is a full navigation to Google, not a form post, so 'self' holds.
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
