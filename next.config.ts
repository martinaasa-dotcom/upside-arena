import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /*
    Partial prerendering, and `use cache` to go with it.

    Every room in this app reads something live -- a price, a standing, a
    streak -- so under the old model every room was dynamic end to end, and a
    dynamic route has no static shell to send. That is why tapping a dock tab
    used to do nothing until the server came back: there was nothing to paint.

    With this on, the shell of a route is prerendered and the live parts
    stream into their Suspense fallbacks. The fallbacks are the loading
    screens that are already here, so the shape a room paints instantly is
    the shape it was already painting while it waited.
  */
  cacheComponents: true,

  /*
    yahoo-finance2 is a CommonJS package that reads its own files at runtime.
    Bundling it breaks that, so it stays external and is required normally on
    the server. Upside Lab does the same.
  */
  serverExternalPackages: ["yahoo-finance2"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
      {
        // A cached service worker outlives the app it was meant to serve.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // A player's own rooms have nothing to offer a search engine.
        source: "/(home|trade|profile|onboarding)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        /*
          The mark, the icons and the share picture.

          Next gives everything under /_next/static a year and an immutable
          flag, because those names contain a hash of their contents. Files in
          public/ carry no hash, so they got the default of no caching at all
          and were re-fetched on every visit -- including og.png, which is
          80KB and changes about never.

          These are not immutable, because a rebrand really does replace them
          under the same names, so they get a lifetime rather than a promise:
          an hour in the browser, a day at the edge, and up to a week of
          serving the old one while the new one is fetched behind it. The
          worst case is somebody seeing yesterday's icon for a few hours, and
          the best case is that a returning player fetches none of it.
        */
        source: "/:file(favicon.png|og.png|arena-mark.svg)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
